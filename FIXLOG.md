# FIXLOG

Append-only memory of every solved bug: root cause and guard. Format:
`### FIX-NNNN — title (YYYY-MM-DD)` with **Area / Symptom / Root cause / Fix / Guard / Evidence** bullets.

### FIX-0001 — Forgotten facts were still recalled (2026-11-25)
- **Area:** `src-tauri/src/memory/queries.rs`, `memory/mod.rs`
- **Symptom:** After a retraction, the fact still appeared in recall (found before release, on the live node).
- **Root cause:** `FILTER NOT EXISTS` across two Knowledge Assets; Working Memory scopes patterns to one asset (LES-001).
- **Fix:** A separate bounded `RETRACTIONS` query; facts filtered in Rust; counts subtract retractions.
- **Guard:** `memory::queries::tests::every_query_is_bounded_and_typed` fails on `NOT EXISTS`/`MINUS`.
- **Evidence:** probe graph `umoja-desk-probe` on node 10.0.26: retraction row present, cross-asset join empty.

### FIX-0002 — The microphone was refused silently; Umoja Desk never appeared in Privacy settings (2026-11-25)
- **Area:** `src-tauri/tauri.conf.json` (bundle.macOS), `src-tauri/Entitlements.plist`
- **Symptom:** "Allow microphone and speech" did nothing visible; System Settings > Privacy & Security > Microphone did not list Umoja Desk (founder, v0.1).
- **Root cause:** Tauri signs the app and its sidecar with the hardened runtime (`flags=0x10002(adhoc,runtime)`); without the `com.apple.security.device.audio-input` entitlement macOS denies microphone access without prompting. (A separate crash report came from launching the helper from a shell, where the responsible process is the terminal app, whose Info.plist has no usage strings; not a bug in the app.)
- **Fix:** `Entitlements.plist` with `com.apple.security.device.audio-input`, wired as `bundle.macOS.entitlements`.
- **Guard:** `src/structure.test.ts` "the bundle declares the microphone entitlement" (config + plist checked).
- **Evidence:** `codesign -d --entitlements -` on the v0.1 bundle: none; on v0.2: audio-input true.

### FIX-0003 — The Keychain asked for permission again and again (2026-11-25)
- **Area:** `src-tauri/src/kernel/secrets.rs` (was `platform::secret_*` over the login Keychain)
- **Symptom:** macOS asked for Keychain access repeatedly while Keeper spoke with ElevenLabs (founder).
- **Root cause:** an ad-hoc-signed app's designated requirement is its build hash (`codesign -dr -` → `cdhash H"…"`); Keychain ACLs follow it, so "Always Allow" never survives a rebuild or update, and the key was read on every spoken reply.
- **Fix:** keys live in Keeper's private store (0600 file in the app folder), read once and cached.
- **Guard:** `kernel::secrets::tests::saves_reads_and_removes_privately` (0600 checked); `structure.test.ts` "no Keychain calls" (no `security-framework`, no `security add-generic-password`).
- **Evidence:** `codesign -dr - /Applications/Keeper.app` → `designated => cdhash H"61f4…"`.

### FIX-0004 — A reopened chat lost its scenes (2026-11-25)
- **Area:** `src-tauri/src/memory/catalog.rs` (question `chat-turns`)
- **Symptom:** caught before release by the live test: a turn's Stage panels were stored on the node, but reopening the chat returned none.
- **Root cause:** the query read `?panels` in an `OPTIONAL` block but its `SELECT` did not list it, so the value never left the store.
- **Fix:** `SELECT … ?panels`.
- **Guard:** `catalog::tests::every_optional_value_is_selected`; live test `live_scenes_come_back_with_their_chat` (quotes, braces, newlines round-trip exactly).
- **Evidence:** direct query showed the stored JSON; after the fix the live test passes.

### FIX-0005 — A second write under the same asset name was retried forever; saving a soul twice failed (2026-11-25)
- **Area:** `src-tauri/src/dkg/client.rs`, `memory/mod.rs` (`write`), `memory/outbox.rs`, `keepers/kit/inventory.rs`, `memory/scene_cache.rs`
- **Symptom:** caught before release by the live tests: saving the same soul a second time failed with `409 KA_ASSERTION_ALREADY_FINALIZED`; the same answer would have sent any repeated record to the outbox, where it retried on every later write and never left (the "waiting" count only grew). The scene cache (new in 0.6) would have hit it on every re-cache.
- **Root cause:** a Working Memory asset is finalized when written, so a second write under its name is refused (409). The client turned every non-2xx into `DeskError::Node`, and `Memory::write` treats `Node` as "the node is down, keep it for later".
- **Fix:** 409 is its own error (`DeskError::Exists`). `write` reports it as "already in memory" (not queued); the outbox drops it; `ensure_graph` accepts it (the node answers 409 for an existing graph too). Records meant to change (souls, kit items, cached scenes) are written as new versions named by their time; readers take the newest (`ORDER BY DESC(?at)`).
- **Guard:** live tests `live_same_record_twice_is_not_queued`, `live_kit_soul_round_trip` (saves twice), `live_scene_cache_round_trip`.
- **Evidence:** `first: wm-sealed / again: already in memory`; every live node test passes (soul, scene, remember/recall/forget, streaks, catalog, reminders).

### FIX-0006 — In the collapsed keepers rail the active highlight sat off-centre from the keeper (2026-11-25)
- **Area:** `src/keepers/keepers.css` (rail mode)
- **Symptom:** founder's screenshot: the gold "active" box behind the robot badge stuck out up and to the left of it.
- **Root cause:** the rail leaves 40px inside its padding, but a keeper button is 52px (6px padding + 38px badge + border); squeezed to 40px, its fill stayed in the narrowed box while the badge overflowed 7px to the right.
- **Fix:** in rail mode the button has no padding, frame or fill and centres the badge; the badge alone shows active (gold edge, glow) and hover. The toggle is sized for the rail too.
- **Guard:** `src/keepers/rail.test.ts`.
- **Evidence:** headless WebKit measurement, badge left minus button left: before 7px, after 0px (all three rows); before shot reproduces the screenshot, after shows one frame.

### FIX-0007 — The double-blink guard never held: a double blink could chain into a triple (2026-11-25)
- **Area:** `src/character/blink.ts` (was `Animator.stepBlink`)
- **Symptom:** None reported; found while extracting the blink scheduler into a pure, tested helper. About 3% of blinks became three or more in a row.
- **Root cause:** The "no third blink" check read `pendingDoubleBlink`, which was always reset to false just before the next blink started, so every blink could draw another double.
- **Fix:** The scheduler remembers whether the playing blink is the second of a double (`secondOfDouble`) and never draws a double from it.
- **Guard:** `src/character/blink.test.ts` "a drawn double blink follows quickly, and never three in a row" (random fixed at 0, which always draws).
- **Evidence:** the test failed on the extracted original logic ("a triple blink") and passes with the fix.

### FIX-0008 — Recall silently ignored everything older than a keeper's newest 200 facts (2026-11-25)
- **Area:** `src-tauri/src/memory/queries.rs` (FACTS, RETRACTIONS)
- **Symptom:** found by the round-4 scale test: with 1,000 facts in a graph, the oldest 800 were never loaded, so a keeper that had learned a lot forgot its early facts with no sign of it.
- **Root cause:** the facts query carried `LIMIT 200` (and retractions `LIMIT 1000`), sized for per-turn querying; ranking only ever saw the newest 200.
- **Fix:** both limits raised to 5,000 (still bounded); hot memory loads them once per graph, so the cost is paid at the first recall only (94 ms cold for 1,000 facts; hot recall 7.5 ms).
- **Guard:** live test `live_scale_thousand_facts` asserts the oldest of 1,000 facts is in hot memory; `queries::tests::every_query_is_bounded_and_typed` keeps the queries bounded.
- **Evidence:** before: 200 facts loaded, oldest missing; after: 1000 loaded, oldest present.

### FIX-0009 — Keeper's own memory node never came back after a reboot (2026-11-25)
- **Area:** `src-tauri/src/dkg/own_node.rs` (new), `lib.rs` (launch)
- **Symptom:** found reading the code after the round-2 VM test: the node Keeper installs is started once, during setup; after a reboot or a crash nothing started it, so recall failed and the keeper answered without memory.
- **Root cause:** no launch-time check; the DKG daemon has no login item of its own.
- **Fix:** at launch, when the node in use is Keeper's own and does not answer, `dkg start` runs with Keeper's Node.js and Keeper waits up to a minute for it. A node the person runs themselves is never started or stopped.
- **Guard:** `own_node::tests::only_keepers_own_node_is_ever_started_or_stopped`; the VM reboot test in round 2.
- **Evidence:** VM: after quitting Keeper the daemon kept running, after deleting the app too (removal now stops it).

### FIX-0010 — With the memory node stopped, every turn failed with "Finish setup first" (2026-11-25)
- **Area:** `src-tauri/src/dkg/node.rs` (`locate`)
- **Symptom:** round-5 VM test: after the node stopped, the phone link and the window got HTTP 400 "Keeper is not connected to a memory node yet. Finish setup first." for every message.
- **Root cause:** a stopped node removes its `api.port`; `locate` needed it, so no client could be built and the turn aborted before it could answer without memory.
- **Fix:** `locate` falls back to the node's configured `apiPort` (config.json); the turn then answers (hot memory or none) and queues its writes in the outbox.
- **Guard:** `node::tests::a_stopped_node_is_found_by_its_configured_port`; VM test (turns answered in 3–13 ms with the node down).
- **Evidence:** before: 400 on every turn; after: answers, writes held (5 → 7 in the outbox).

### FIX-0011 — A memory node that died mid-session stayed dead, and its writes waited forever (2026-11-25)
- **Area:** `src-tauri/src/dkg/own_node.rs` (`watch`), `assistant/turn.rs`
- **Symptom:** round-5 VM test: hot memory hid the dead node (turns still answered and remembered), so nothing restarted it; the outbox only flushed on the next successful write, which never came.
- **Root cause:** restart only at launch (FIX-0009); the outbox flush rode on a successful write.
- **Fix:** a watchdog every 20 s starts Keeper's own node if it stopped answering (single flight) and flushes the outbox once it answers; a recall failure also triggers a restart at once.
- **Guard:** VM test; `own_node` only ever touches Keeper's own node (`is_own` test).
- **Evidence:** node killed mid-session → back (200) within a minute, outbox 3 → 0; after a cold relaunch the graph held the facts learned while the node was down.

### FIX-0012 — A System Administrator keeper took 6–19 s to its first words on every message (2026-11-25)
- **Area:** assistant turn routing (`assistant/source.rs`, `assistant/approval.rs`, new `assistant/intent.rs`), `brain/guard.rs`
- **Symptom:** founder: "asking anything takes a long time". On the founder's setup (keeper #1, the System Administrator role, acting on, ask before acting) "hello" took 6.2 s to first words and a lesson 13–19 s; the bench said 0.7 s because it only ever ran a Companion keeper that never acts.
- **Root cause:** a keeper that may act was treated as acting on EVERY turn: each message first went through a silent plan-only Opus call (no live text), then, when the plan was empty, a second full Opus call with tools; the quick model and the scene cache were both skipped for acting keepers, and tool-mode turns never matched a warm spare.
- **Fix:** a turn gets tools only when its words ask for computer work (`intent::wants_computer`, no model). Other turns are chat turns (quick model, warm spare, scene cache); their engine may answer `"needsComputer": true` and the turn is run again as computer work. The plan step is one streamed call whose answer IS the turn's answer when nothing needs to change, and a plan made only of "look" steps runs at once under a read-only guard (`PlanGuard::read_only`). The guard now reads chained shell commands piece by piece (`cd ~ && find … | head` is a read; a substituted command, a redirect into a file or `find -delete` is not).
- **Guard:** unit tests `assistant::intent::tests`, `approval::tests` (look-only plans), `guard::tests::a_looking_turn_stops_at_any_change`; the bench's `PROFILE=admin` runs the founder's own setup (`scripts/bench/run.sh`) and two computer turns.
- **Evidence:** admin bench, release build: first words median 7,968 ms → 480 ms, p90 13,192 → 849 ms; "hello" 6,167 → 731 ms; repeated lesson 13,110 → 25 ms (cache); "Tidy up my desktop" plans in 2.7 s first words.

### FIX-0013 — "Forget" only hid a fact; its words stayed on the node (2026-11-25)
- **Area:** memory erasure (`memory/mod.rs` `erase_fact`, `dkg/client.rs` `discard`), the three forget paths (spoken "forget", the facts panel's Forget, `memory_forget_fact`)
- **Symptom:** after "forget my old address" the fact was no longer recalled, but its triples stayed in the node's Working Memory (a retraction is additive), so the person's words were never actually erased (DESK-ERASE-001).
- **Root cause:** Keeper assumed DKG writes could not be undone; the node has a per-asset Working Memory discard (`POST /api/knowledge-assets/{name}/wm/discard`, `dkg ka discard`) that removes even a sealed asset.
- **Fix:** one erase path, `Memory::erase_fact`: discard the fact's asset (`desk-fact-<id>`, one asset per fact), update hot memory; write a retraction only when the node cannot discard (offline, still in the outbox). All three forget paths call it.
- **Guard:** live test `live_remember_recall_forget` runs a raw query for the fact's text before (finds it) and after forgetting (finds nothing); `discard` refuses names that are not Keeper's own (`desk-…`).
- **Evidence:** probe on the bench graph: an asset written (`wm-sealed`), queried (found), discarded (`{"discarded": true}`), queried (empty); memory live tests 10/10.

### FIX-0014 — Unused engine spares lived until Keeper quit, ~265 MB each (2026-11-25)
- **Area:** warm spares (`brain/engines/warm.rs`), app start (`lib.rs`)
- **Symptom:** the founder's Keeper held two idle Claude Code spares 58 and 73 minutes old (265 MB and 268 MB resident) though spares are meant to retire after 20 minutes.
- **Root cause:** a spare's age was only checked when a turn tried to TAKE it (or `fill` looked at its key); a spare nobody asked for again (another mode or model) was never looked at, so it never retired.
- **Fix:** `warm::prune()` drops every spare that is too old or has exited (spares are `kill_on_drop`, so dropping ends the process); `warm::spawn_sweeper()` runs it every minute from app start.
- **Guard:** unit test `the_sweep_ends_spares_that_are_too_old_or_gone` (an old spare retired, a fresh one kept).
- **Evidence:** `ps` on the founder's Mac before the fix (PIDs 53019, 71594); cargo test --lib warm 2/2.

### FIX-0015 — Every chat saw every other chat's last messages as its own (2026-11-25)
- **Area:** recall (`memory::recall`, `memory::thread`, `queries::RECENT_TURNS`, hot memory), the turn prompt (`brain::prompt::turn_message`)
- **Symptom:** founder: in the chat "Hey how are you?", "what did I ask you here?" was answered with a question from another chat ("what is going on with your foreman application").
- **Root cause:** the turn's "recent conversation" was the keeper's last 6 turns across ALL chats, given to the engine as one conversation.
- **Fix:** recent turns now carry their chat; recall gives the engine the CURRENT chat's last 6 exchanges ("This chat so far (its own train of thought)") and, separately, one labelled line per other recent chat ("Other chats going on (SEPARATE topics…)"), so it knows about them without mixing them in; hot memory keeps 40 recent turns to split. Facts stay one shared memory (design: docs/design/keeper-modes.md).
- **Guard:** unit test `thread_tests::a_chat_sees_its_own_thread_and_only_names_the_others`; live memory tests pass.
- **Evidence:** real Keeper (bench), two chats: in chat B "What did I ask you in this chat?" -> "you asked, 'Hey how are you?' That is the only message so far."; "what was the other chat about?" -> "planning your trip to Tobago".

### FIX-0016 — Looking at the computer was stopped by `ps`, and the stop message read a command line aloud (2026-11-25)
- **Area:** `brain::guard` (read commands, verdict wording), `brain::engines::stopped_by_plan`, the acting instructions (`brain::prompt::ACTING`)
- **Symptom:** founder: "Foreman looks blank" ended "I stopped… (ls /Applications … | grep -i fore; mdfind … ps aux | grep …)", and the voice read the command ("dash grep…").
- **Root cause:** `ps` (and pgrep, lsof, which…) were not known read commands, so the read-only guard stopped a harmless look; the verdict and the reply embedded `step.detail` (the raw command) and paths.
- **Fix:** more read commands (ps, pgrep, lsof, uptime, whoami, which, sw_vers, uname, system_profiler, basename, dirname, realpath); verdicts name a place by its name, never a path or command; the stopped reply says what to do next in words; the acting instructions forbid commands, flags, code and long paths in the spoken reply.
- **Guard:** guard test `the_founders_look_was_a_read_and_verdicts_are_words_not_commands` (the exact command passes; verdicts contain no "/", "~" or command text).
- **Evidence:** cargo test --lib guard 5/5.
