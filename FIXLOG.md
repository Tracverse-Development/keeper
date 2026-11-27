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

### FIX-0017 — Reading the disk was stopped: quoted patterns and system report tools were taken for changes (2026-11-26)
- **Area:** `brain::guard` (read-only checks)
- **Symptom:** "How much free space is on my disk?" in System Administrator mode ended "I stopped. I was only going to look…".
- **Root cause:** the engine ran `df -H …; diskutil info / | grep -iE "Container (Total|Free)|Volume …"`: the guard split the chain on the `|` INSIDE the quoted grep pattern, so `Free)` looked like an unknown command; and `diskutil` (and other report tools) were not known reads at all.
- **Fix:** quoted strings are blanked before a chain is split (`unquoted`); report tools read with their reading sub-commands only (`diskutil list/info/apfs list`, `defaults read`, `launchctl list/print`, `networksetup -get…/-list…`, `scutil --get`, `pmset -g`, `sysctl` without `=`, `vm_stat`, `top`); their changing forms stay refused.
- **Guard:** guard test `disk_and_system_reports_are_reads_and_their_changing_forms_are_not` (the exact command passes; `diskutil eraseDisk`, `apfs deleteVolume`, `defaults write`, `sysctl -w`, `pmset sleep 0`, `launchctl unload`, and a real `rm` after a quoted echo are stopped).
- **Evidence:** real Keeper (bench): the same question now answers "about 559 gigabytes free out of roughly 995".

### FIX-0018 — Two saves of a soul, item or mode in the same second could come back in the wrong order (2026-11-26)
- **Area:** `keepers::kit::inventory` (save_soul, save_variant, save_mode, definitions)
- **Symptom:** found by the new mode live test: an edited mode then a reset within one second came back still edited.
- **Root cause:** versions were ordered only by `prov:generatedAtTime`, which has one-second steps; equal times came back in any order.
- **Fix:** every definition carries a millisecond save counter (`seq`); `definitions()` orders by it after the node's order (records from before stay first and in their order). Applies to souls, wardrobe items and modes.
- **Guard:** live test `live_modes_save_reload_and_reset_on_the_kit_graph` (save then reset in the same second ends reset).
- **Evidence:** memory live tests 14/14.

### FIX-0019 — A harmless network look was stopped: the guard judged a command cut at 160 characters (2026-11-26)
- **Area:** `brain/engines/claude.rs` `read_line`, `brain/guard.rs`, `platform/read_commands.rs`
- **Symptom:** In System Administrator mode, "show me what's going on with my home network" always answered "I stopped. I was only going to look…".
- **Root cause:** each tool call's input was shortened to 160 characters for the live phase text, and the SAME shortened copy went to the plan guard. A long chain of reads ended in "…" mid-word, which never matches a read command. Network tools (netstat, arp, ndp, route get, ipconfig get…, tailscale status, dscacheutil -q) and pipe filters (cut, tr, sed/awk in reading forms) were also missing.
- **Fix:** the guard gets the full input (up to 4,000 characters; anything longer is cut and refused); the phase text stays short. Network reads were added in their reading forms only, and full-path programs count by name only from system folders or /Applications. A stopped look gets one retry, told why it was stopped.
- **Guard:** `reads_tool_calls_and_the_result` (a long command reaches the guard whole), `the_founders_look_was_a_read…` (the real device-scan command), read_commands tests (reads pass; `ifconfig en0 down`, `sed -i`, `tailscale up`, `~/bin/ls`, `/usr/bin/../../Users/x/ls` refused).
- **Evidence:** live, System Administrator: "home network" → live dashboard + 3 tables, healthy-network answer (32 s); "how is my computer doing" → live dashboard (2.4 s).

### FIX-0020 — Looks ended at the first unfamiliar command; computer work trickled in confusingly (2026-11-26)
- **Area:** `brain/look_hook.rs` (new), `brain/engines/claude.rs`, `assistant/approval.rs`, `assistant/turn.rs`; window `stage/activity.ts`, `ActivityPanel.tsx`, `dashboard/mood.ts`, `conversation/useAssistant.ts`, `ConversationDock.tsx`
- **Symptom:** (founder screenshots, 0.9.0) "which devices are on my network" ended in "I stopped"; while it worked, two identical empty live panels appeared, every step read "Working on your computer", the line under the reply showed the raw command ("Bash: ping -c 2…"), the reply said "I'll take a look… I'm looking… now", and "reached level 4!" replaced the answer.
- **Root cause:** the read-only guard could only kill the engine (no way to refuse one call); the look's second engine call streamed its own reply and panels on top of the plan call's; the step narrator knew no network tools; the phase line printed the step text as-is; the level-up was announced as a new exchange, and the compact dock shows only the last one.
- **Fix:** Keeper runs itself as a Claude Code PreToolUse hook during looks (`keeper --look-guard`): a refused call is denied with its reason and the engine carries on; the stream checks each refused call came back denied and stops the run if not (backstop). A look keeps the plan's opening line and shows only steps until the answer is done; computer work holds its panels until the finished answer. Network and system tools are narrated by what they find out, chains as "X and Y", repeats grouped (× n), the status line in words only. A level-up is a note under the answer.
- **Guard:** `look_hook` tests (reads pass, writes denied with the mark, bad input denied, backstop trips only when a refused call ran); `activity.test.ts` (network narration, no command in the status line, grouping).
- **Evidence:** live, System Administrator, 0 guard stops: "which devices are on my network" → 2 tables + live, found 5 Tailscale devices (35 s); "show me my home network" → live, 2 tables, diagram (28 s). Earlier experiment: a hook-denied `touch` never created its file and the run continued.

### FIX-0021 — A forgotten fact survived in the action log; personal facts filed as "general" were lost in other modes (2026-11-26)
- **Area:** `assistant/turn.rs` (`stored_outcome`), `memory/records.rs` (`WORK`, `learned_in`, `belongs_in`), `brain/prompt.rs`
- **Symptom:** (memory bench) after "forget my bench test cat", a memory-lookup Action record still held "Your bench test cat is called Biscuit Moon"; in Tutor mode the keeper did not know the cat's name the Assistant had learned.
- **Root cause:** the ask-memory skill's answer (quoting facts) was stored whole as the Action's outcome; facts in every category except a fixed personal list were tagged with the mode they were learned in, and "general" (pets, misc personal facts) was not on the list.
- **Fix:** an ask-memory action keeps only its heading ("What I learned recently (6 found)"); only "work" facts belong to one mode, everything else the person tells is personal and recalled in every mode (also older facts tagged before); the prompt names "work" as the one per-mode category.
- **Guard:** `stored_outcome_tests`, records tests (personal in every mode, work notes in their mode).
- **Evidence:** live, test copy: remember 2.7 s, recall new chat 1.4 s, recall in Tutor 2.9 s (was "I do not have it"), forget 3.3 s; afterwards the DKG holds the words only in the conversation's own turns (deleted with the chat).

### FIX-0022 — Test copies of Keeper wrote into the real home and kit graphs (2026-11-26)
- **Area:** `keepers/mod.rs` (`install_base`), `keepers/kit/inventory.rs` (`graph_id`)
- **Symptom:** found while building the one-graph move: a test copy (`KEEPER_HOME=misc/bench-home`) derives the home graph id from the home folder and computer name, so it would have moved bench data into the founder's real graph; the kit graph id already did this (bench souls/modes went to the real `keeper-kit-…`, which held 0 assets when checked).
- **Root cause:** graph ids were derived from the computer account only, ignoring the test copy's own folder.
- **Fix:** `install_base()` uses `KEEPER_HOME` when set (a test copy gets its own home graph); real installs are unchanged (same id).
- **Guard:** the live relocation test and the bench run against `umoja-desk-09ec185b58` (the test copy's home), never the real one.
- **Evidence:** bench move: 620 assets into `umoja-desk-09ec185b58/keeper-bench`, verified; the real `umoja-desk-176b503b62` untouched (88 assets).

### FIX-0023 — A malformed or cut-off answer lost every panel; "make a folder in /tmp" skipped the plan (2026-11-26)
- **Area:** `brain/prompt.rs` (`read`, `from_value`, `salvage`), `assistant/intent.rs`, `assistant/approval.rs` (LOOKING)
- **Symptom:** (scenario bench round 3) a research follow-up showed raw JSON and no panels after 57 s; "Make a folder called keeper-bench-fix in /tmp" went to the quick model, which claimed a skill it lacks and offered no plan (nothing was created); "how much storage do I have left" took 101 s.
- **Root cause:** the answer was parsed all-or-nothing into `Thought` (one field of the wrong shape, or a cut-off end, discarded everything); "make" was not an action word and absolute paths (`/tmp`) were not seen as computer work; the look rule still allowed du over the whole home folder.
- **Fix:** answers are read field by field (bad fields dropped), and JSON that does not parse is salvaged (reply + every complete panel via the panel stream); "make" counts with a computer thing named (never "make a cake for my sister"), absolute paths count; free space is `df -h /` alone, du only for named folders when asked.
- **Guard:** `a_bad_field_or_a_cut_off_answer_keeps_the_reply_and_panels`; intent tests (make-folder and /Applications recognised, the cake and "and/or" not).
- **Evidence:** bench rerun 9/9 kinds, judge 4.33: research follow-up 4 panels; folder -> approval plan (22 s); storage 31 s (was 101 s); memory turns 2.0 / 2.2 / 5.4 s.

### FIX-0024 — Settings buttons were squeezed flat, Memory tab names overflowed, installer steps ran off the window (2026-11-26)
- **Area:** `src/dashboard/dashboard.css`, `src/installer/installer.css`, every stylesheet (spacing).
- **Symptom:** In Settings, "Soul and modes are in the Studio" and "Open the Studio" were drawn about 18px tall with their text spilling out. In the Memory drawer the "Conversations" tab name ran into "Knowledge". The installer's sixth step name was cut off at the window's edge. Spacing and text sizes differed from screen to screen (27 text sizes, 30 spacing values).
- **Root cause:** The settings sheet is a scrolling flex column, and its children were allowed to shrink (a button shrinks to its text height). Six tabs shared the drawer's width in equal parts with no room for the longest name. Six step names were shown in half a window. Lengths were written by hand in each stylesheet, with no scale.
- **Fix:** Sheet children never shrink (`.sheet > * { flex-shrink: 0 }`); tabs size to their names and scroll; only the current step is named. One spacing scale (`--space-*`, a 4px grid), one type scale (`--text-*`) and three control heights in `kernel/tokens.css`, and every stylesheet moved onto them.
- **Guard:** `structure.test.ts` "spacing and type": a gap, padding, margin or font size outside the scale fails the suite (proved by adding `padding: 7px 10px; font-size: 13.5px`, which failed, then removing it).
- **Evidence:** `scripts/check.sh`: 251 window tests and 145 core tests pass; `vite build` succeeds; before/after screenshots of Studio, dashboard, Settings, Memory and the installer at 1280x820 and 900x620 (`misc/studio-preview/before`, `after`).

### FIX-0025 — The first panel on a network question showed two numbers and explained nothing (2026-11-26)
- **Area:** `src/stage/panels/LivePanel.tsx`, `src/stage/live-net.ts`, `src-tauri/src/system/mod.rs`, `src-tauri/src/assistant/approval.rs`.
- **Symptom:** (founder screenshot, 0.10.0) "What is going on with my computer network?" opened a card titled "Your computer, live" holding only "↓ 15 KB/s ↑ 24 KB/s" and a small line, in a mostly empty box; the useful panels arrived later.
- **Root cause:** the live dashboard's network part was written as one row inside the whole-computer dashboard (beside gauges and apps). Shown alone it had no words for what the speeds mean, no context (is this Mac even on a network), and the general title.
- **Fix:** the network part is its own section: a reading in words ("Connected and quiet. Almost nothing is moving: only small background check-ins."), speed in and out each with its own history and the last minute's peak, this Mac's address and the totals since it started (new fields on the live reading, from the interfaces that hold a real address). No address reads "Not on a network" with what to check. A dashboard of one thing is named for it ("Your network, right now").
- **Guard:** `live-net.test.ts` (every level of traffic is named and explained; no address means offline whatever the counters say); `a_live_reading_has_memory_and_a_disk` (the address is empty or a real IPv4; loopback and self-assigned addresses do not count).
- **Evidence:** `scripts/check.sh` green; preview screenshot of the panel alone at 900 px.

### FIX-0026 — After the move to sub-graphs the Studio said "Your memory node isn't answering" and the level could not be read (2026-11-26)
- **Area:** `src-tauri/src/memory/mod.rs` and every caller: `keepers/kit/levels.rs`, `memory/panel_events.rs`, `memory/pinned_scenes.rs`, `memory/scene_cache.rs`, `memory/routines.rs`, `keepers/kit/seasons.rs`.
- **Symptom:** (founder screenshot, 0.10.0, the first version that moved real memory into its sub-graph) the Studio opened with "The memory node did not answer: Your memory node isn't answering, so the level can't be read right now." The node was running and answering.
- **Root cause:** `Memory::graph()` returned the hot-memory KEY (`graph/sub`), and six places passed it to the node as the graph to read (`client.query(memory.graph(), …)`), where a `&str` silently becomes a whole-graph place. Before the move the key equalled the graph id, so it worked. After it, the node was asked for a context graph called `umoja-desk-…/keeper-1`: it looked that name up as a registered chain name and answered 503 when the chain was not reachable (node log 16:34:02: "read authority unavailable … chain-name-binding-unavailable", four times: the level's four counts), or zero rows when it was. So the level was unreadable or 0, and pins, quiz streaks, the scene cache, routines and season progress read nothing. The live tests all ran on whole scratch graphs, never in a sub-graph, so none saw it.
- **Fix:** the key is `hot_key()` (a label for caches and for showing); the address is `Memory::place()`; every node read, write and erase uses `place()`. Class, not instance: all six callers changed in one pass.
- **Guard:** `structure.test.ts` "the node is always addressed by place(), never by the cache key"; the routines and season live tests now run in a SUB-GRAPH and read the level, pins and counts there.
- **Evidence:** live tests green in a sub-graph on this Mac's node; read-only on the real graph: the corrected address returns 42 turns, 16 lessons and 15 actions for keeper-1 in about 10 ms, the old one returns 0 or 503.

### FIX-0027 — An independent review of 0.10 to 0.11.1 found data-loss, security and child-profile holes (2026-11-26)
- **Area:** reminders, memory replacement, backup restore, dropped files and copied text, the child profile, the Studio, routines, timers. Found by a separate read-only review of the 9,600 lines added since 0.9.1.
- **Symptom / root cause, each:**
  - Reminders: the reload read the 50 OLDEST reminders, and past occurrences are kept, so after about 50 days nothing was scheduled; a repeating reminder missed by more than a day never came back.
  - Replacement: the "one at a time" rule was a bare prefix match, so "You moved to the night shift" erased your address and "Your car is in the shop" erased "Your car is a blue Corolla", for good.
  - Restore: every install's first keeper is keeper-1, so another Mac's keeper-1 was merged into this one's and its profile dropped.
  - Material fence: a fixed "=====" fence was closed by any heading underline in a document, and a turn about a dropped file still ran the mind's forget and skill requests.
  - Dropped files: Keeper's own folder (API keys) was readable, a device such as /dev/zero was accepted, and web pages went through a converter that could fetch what they point to.
  - Child profile: an edited Tutor (which could carry the web) was used; modes and souls could still be edited; deleting one file turned it off; a running phone link stayed on; touch lines written for an adult could be spoken; copied-text requests carried no child rules.
  - Studio: the draft was never matched to what the core kept (sorted, lower case), so it saved every 0.7 s for ever; a failed save retried for ever; a change made during a save was lost on Done.
  - Also: "save that as a PDF" became a routine; replacing a routine could lose it; timers paused while the Mac slept; the backup listing could truncate silently; outbox lines from before the move could strand; a touch-line refill could block for ever; a phone could read the Mac's clipboard; a slow chat list could land on another keeper.
- **Fix:** reminders read newest first and every repeating one comes round however long Keeper was closed; automatic replacement only for certain cases (name, address, phone, email, birthday, a favourite, "you live in <Place>"), the broad guess only SUGGESTS ("tidy my memory"); a keeper from another computer is restored as a new keeper; a random fence per turn and no forget or skills on material turns; regular files only, never Keeper's or the node's folders, web pages read as text; the built-in modes only and no editing on a child profile, the lock kept twice, the phone link stopped, pools per profile, child rules on copied text; the Studio takes the saved values, does not retry a failed draft, and Done sends the latest; "routine" required to save one; routine replace through the outbox; timers count the wall clock; listing filtered by place and refused at the limit; outbox flushed before the move; refill marks only when it will run; phone clipboard requests refused; stale chat lists dropped.
- **Guard:** tests in `memory/meaning.rs` (the review's sentences replace nothing), `assistant/attach.rs` (a fresh tag, only the real end closes it, /dev/zero refused, tags stripped), `backup/mod.rs` (another computer's keeper-1 gets its own id, the same backup twice lands once), `assistant/mod.rs` (a child's chats use built-in modes without tools), `fastlane/routines.rs` ("save that as a PDF" is not a routine), `skills/reminder_actions.rs`.
- **Evidence:** `scripts/check.sh` green; `scripts/proof.sh` and the end-to-end smoke green.

### FIX-0028 — A level-up of several levels at once named only the last level's set progress (2026-11-27)
- **Area:** `src/studio/SetProgressToasts.tsx`, `src/studio/useLevelUp.ts`, `keepers/kit/levels.rs` (the level-up event).
- **Symptom:** after a jump of several levels (a long focus session, a burst of quizzes) the corner note counted only the pieces opened by the final level: from level 3 to 10, "Island Linen: every piece ready" never showed.
- **Root cause:** the window computed the notes from `level - 1` to `level`; the event did not carry the level the keeper came from, though the core knew it (`record_level`).
- **Fix:** the event carries `from` (`levels::level_up_event`); the window reads it through `levelBefore` (an older core without it still means one level).
- **Guard:** `levels.rs` test `a_jump_of_several_levels_says_where_it_came_from_and_opens_everything_between`; `set-progress.test.ts` "a jump of several levels counts every piece opened on the way".
- **Evidence:** cargo test (226 passed), node tests 462 passed.

### FIX-0029 — Outfit changes made by hand in a mode with a loadout were lost on the next mode change (2026-11-27)
- **Area:** `keepers/kit/loadout.rs`, `keepers/loadout_commands.rs`, `kernel/settings.rs` (`ModeOutfits`).
- **Symptom:** in a mode tied to a set the person swapped a piece or added one; after visiting another mode and coming back, the keeper was dressed from the set again and the change was gone.
- **Root cause:** a loadout was only "mode → set"; nothing remembered what was worn in that mode, so every arrival re-dressed from the set.
- **Fix:** changes made while in mode X belong to X: the profile keeps `modeOutfits` (the mode dressed for, and the outfit last worn in each loadout mode); leaving X saves what is worn as X's outfit, coming back puts it on (`loadout::change_mode`). The everyday outfit is untouched; tying another set to X forgets X's outfit; a remembered outfit that no longer fits is dropped. Pieces a set puts on that are already worn keep their colour.
- **Guard:** `loadout.rs` tests `changes_made_by_hand_in_a_loadout_mode_are_that_modes_and_come_back_with_it`, `a_set_piece_already_worn_keeps_its_colour`, `an_older_profile_has_no_mode_outfits_and_an_empty_one_is_not_written`.
- **Evidence:** cargo test (226 passed).
