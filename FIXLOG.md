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

### FIX-0028 — The God Keeper's glow washed out its engraving, plates and robe folds; a flare could white out the frame (2026-11-27)
- **Area:** `src/character/skins/god/god-skin.ts`, `parts/divine-finish.ts`, `parts/rarity-flourish.ts`, new `parts/divine-light.ts`.
- **Symptom:** On the celestial stage (and wearing a glowing set on any stage) the robe bloomed to a white blob and the gold mask, armour plates and folds disappeared; the crown flare stacked with "got it" could flood the frame white.
- **Root cause:** the body's own lit surfaces (ivory robe, polished gold, iridescent armour, plus each worn piece's tier glow and the chest lamp) went above the bloom pass's luminance threshold (1.05), so the bloom treated the whole body as a light; every flare multiplied the body lights with no ceiling (up to 4.7x).
- **Fix:** a soft ceiling on every God surface and every divinely finished item (`divine-light.ts`: luminance rolls off toward 0.96, below the threshold, keeping order and mid-tones), with the radiance moved to a fresnel rim added after the ceiling; the robe a shade under white; a restrained tier keeps half its flare and 70% of its sparkle; the body's lights take at most 1.8x of any flare (`BODY_FLARE_CAP`), so a flare is a burst of rays and halo.
- **Guard:** `parts/divine-light.test.ts` (the ceiling never reaches the bloom threshold, keeps order, a lit/half-lit fold keeps a real step; the patch lands after lighting, before output); `set-glow.test.ts` still green.
- **Evidence:** 471/471 TS tests; before/after shots in `misc/studio-preview/lineup/looks-*-god*.png` (default, celestial, close, regalia set, stacked flare).

### FIX-0029 — A level-up of several levels at once named only the last level's set progress (2026-11-27)
- **Area:** `src/studio/SetProgressToasts.tsx`, `src/studio/useLevelUp.ts`, `keepers/kit/levels.rs` (the level-up event).
- **Symptom:** after a jump of several levels (a long focus session, a burst of quizzes) the corner note counted only the pieces opened by the final level: from level 3 to 10, "Island Linen: every piece ready" never showed.
- **Root cause:** the window computed the notes from `level - 1` to `level`; the event did not carry the level the keeper came from, though the core knew it (`record_level`).
- **Fix:** the event carries `from` (`levels::level_up_event`); the window reads it through `levelBefore` (an older core without it still means one level).
- **Guard:** `levels.rs` test `a_jump_of_several_levels_says_where_it_came_from_and_opens_everything_between`; `set-progress.test.ts` "a jump of several levels counts every piece opened on the way".
- **Evidence:** cargo test (226 passed), node tests 462 passed.

### FIX-0030 — Outfit changes made by hand in a mode with a loadout were lost on the next mode change (2026-11-27)
- **Area:** `keepers/kit/loadout.rs`, `keepers/loadout_commands.rs`, `kernel/settings.rs` (`ModeOutfits`).
- **Symptom:** in a mode tied to a set the person swapped a piece or added one; after visiting another mode and coming back, the keeper was dressed from the set again and the change was gone.
- **Root cause:** a loadout was only "mode → set"; nothing remembered what was worn in that mode, so every arrival re-dressed from the set.
- **Fix:** changes made while in mode X belong to X: the profile keeps `modeOutfits` (the mode dressed for, and the outfit last worn in each loadout mode); leaving X saves what is worn as X's outfit, coming back puts it on (`loadout::change_mode`). The everyday outfit is untouched; tying another set to X forgets X's outfit; a remembered outfit that no longer fits is dropped. Pieces a set puts on that are already worn keep their colour.
- **Guard:** `loadout.rs` tests `changes_made_by_hand_in_a_loadout_mode_are_that_modes_and_come_back_with_it`, `a_set_piece_already_worn_keeps_its_colour`, `an_older_profile_has_no_mode_outfits_and_an_empty_one_is_not_written`.
- **Evidence:** cargo test (226 passed).

### FIX-0031 — The man's face: a bulbous nose, a mouth that read odd, and a gap in the beard (2026-11-27)
- **Area:** `src/character/skins/human/` (`human-face.ts` nose, `human-mouth.ts` lips, `human-beard.ts` beard, `human-hair.ts`, `human-shape.ts` `MAN_NOSE`)
- **Symptom:** close up, the man's nose was a cluster of round blobs; his mouth showed two dark brackets above a half ring that hung below the lips (deep as a horseshoe at a full smile, cutting into the beard); bare skin ran between the moustache and the chin at the mouth's corners.
- **Root cause:** one shared button nose for every human frame; the smile line was a half torus up to 0.9 of its radius deep, wider than the lips; the beard was three separate pieces (chin cap, stippled band, torus moustache) with nothing joining them beside the mouth.
- **Fix:** a nose shape per frame (the man's slimmer, longer bridge, smaller tip, tucked wings; the woman and the God Keeper keep theirs); the mouth moved to `human-mouth.ts` with a fine seam only as wide as the lips whose smile depth stays inside them and an upper lip that rises out of the skin; the beard is one shell over a per-vertex region (moustache, mouth corners, chin, jaw, sideburns; lips bare) with a noise edge, crisp at the moustache and feathered up the cheeks.
- **Guard:** `human-beard.test.ts` (no bare point beside the mouth from moustache to chin; lips, nose, eyes and cheekbones bare; the cheek edge feathers). The nose and mouth have no numeric guard (taste, proven by eye): before/after shots in `misc/studio-preview/lineup/faces-man-*.png`.
- **Evidence:** window tests 468/468, `tsc` clean; shots compared side by side with the woman.

### FIX-0032 — The keeper said "Switching to Tutor mode" again on the next message (2026-11-27)
- **Area:** `src/conversation/useAssistant.ts` (the chat's mode), `src-tauri/src/assistant/source.rs` (the mode handoff), `kernel/events.rs` `MODE_SWITCHED`
- **Symptom:** asked about algebra in System Administrator mode, the keeper answered "Switching to Tutor mode for this." and taught; the mode picker still said System Administrator for the whole answer, and the next message switched to Tutor again.
- **Root cause:** the window moved the chat to the new mode only when the whole turn returned, and only through React state. A message sent while the answer was still coming was queued, and the queue ran it straight after the turn returned, before React re-rendered: `modeRef` still held the old mode, so the core was asked in System Administrator mode again.
- **Fix:** the core emits `assistant://mode-switched` the moment it decides to answer in another mode (the picker follows at once); every change of the chat's mode goes through `follow()`, which updates the ref immediately as well as the state.
- **Guard:** none automatic: the race lives in a React hook and this repo's window tests are node tests with no React renderer. The ref-and-state helper is the single path (`setMode` is no longer exported raw), and the comment on `follow()` names why.
- **Evidence:** `scripts/check.sh` (below in the commit).

### FIX-0033 — A lesson replayed from memory said "Switching to Tutor mode for this." (2026-11-27)
- **Area:** `src-tauri/src/memory/scene_cache.rs` (`CachedScene::replay_reply`), `src-tauri/src/assistant/source.rs` (the scene cache hit). Follows FIX-0032.
- **Symptom:** in the bench, the "lesson", "lesson-again" and "follow-up" turns answered from the cache all opened with "Switching to Tutor mode for this." while the turn returned `switched: None`: the reply announced a switch that did not happen.
- **Root cause:** the switch line was stripped only when a scene was SAVED (`without_switch` in `CachedScene::new`); scenes kept before that change still carried it, and the cache hit used `scene.reply` as stored.
- **Fix:** the replay reads `replay_reply()`, which strips the line on the way out as well, so no replay ever claims a switch whatever was stored.
- **Guard:** `scene_cache.rs` test `an_old_kept_scene_replays_without_the_switch` (a scene built with the old line, bypassing the save-side cleaning).
- **Evidence:** `cargo test --lib`: 245 passed, 0 failed.

### FIX-0034 — The keeper switched modes to answer a one-line fact (2026-11-27)
- **Area:** `src-tauri/src/keepers/kit/roles.rs` (`mode_rule`), new `src-tauri/src/assistant/handoff.rs`, `src-tauri/src/assistant/source.rs` (`find`).
- **Symptom:** in System Administrator mode, "What's the capital of Japan?" answered "Switching to Assistant mode for this. The capital of Japan is Tokyo." and moved the chat; "I want to run a marathon this spring, any tips?" switched too.
- **Root cause:** the mode rule allowed only greetings and small talk outside the mode's scope, so any question in another mode's scope (the Assistant's scope names "quick questions") was a switch; and the core announced and moved the chat for every switch the mind asked for.
- **Fix:** the rule now keeps a quick question answerable in a line or two with no tools in the current mode, and reserves switching for real work (a lesson, research with sources, the computer). Deterministic guard in `handoff`: a short conversational question asked of a talking mode (no web, no computer, never the Tutor) only BORROWS that mode: no announcement, the chat stays; if the borrowed answer turns out to be real work (panels, a skill, a long answer) it is announced as a switch after all. The first answer's own "Switching to …" words are held back (`HoldSwitchLine`) and `find` says the line itself only when it really switches. A lesson request in System Administrator still switches to the Tutor.
- **Guard:** `handoff.rs` tests `quick_questions_borrow_quietly_and_lessons_switch` (the two bench questions, a lesson, homework, research, tidying files), `panels_or_skills_make_it_real_work`, `a_switch_line_is_held_and_other_words_pass`; `roles.rs` test `the_mode_rule_keeps_quick_questions_here`.
- **Evidence:** `cargo test --lib`: 245 passed, 0 failed.

### FIX-0035 — A storage question repeated the same free-space figure in four panels (2026-11-27)
- **Area:** `src-tauri/src/stage/mod.rs` (`RULES`), `src-tauri/src/assistant/approval.rs` (`LOOKING`), `roles.rs` (System Administrator brief), new `src-tauri/src/stage/echo.rs`, `src-tauri/src/assistant/turn.rs`.
- **Symptom:** "How much storage do I have left?" showed the reply, a text panel, a table, a chart and the live panel, each giving the same free-space number.
- **Root cause:** the Stage rules asked for a text panel FIRST whenever numbers or a status were shown, and nothing limited a simple status answer, so the mind restated one figure in every kind it could.
- **Fix:** the rules say no panel only repeats the reply, each figure appears in one panel, and a simple status question gets one live panel plus at most one supporting panel (the same line in the look note and the System Administrator brief). Deterministically, `stage::without_echoes` drops a text panel (no bullets) whose words are nearly all in the reply. Computer-work panels still arrive together (the turn's panel hold is untouched).
- **Guard:** `echo.rs` tests `a_text_panel_that_restates_the_reply_is_dropped`, `a_text_panel_that_adds_something_stays`.
- **Evidence:** `cargo test --lib`: 245 passed, 0 failed.

### FIX-0036 — The setup step bar's "Welcome" ran into the "2" on a 1024 px window (2026-11-27)
- **Area:** `src/installer/installer.css` (`.stepper`).
- **Symptom:** on the VM's ~1024 px display the first step's name showed as "Welc" overlapping the second step's dot.
- **Root cause:** all six steps shared the row equally (`flex: 1; min-width: 0`), so the named step got a sixth of ~400 px, narrower than its dot plus "Welcome", and the unclipped name overflowed into its neighbour.
- **Fix:** the named step never shrinks below its dot and name (`flex: 1 0 auto`, at most half the row) and the name can only ellipsize; the other steps share what is left.
- **Guard:** `steps.test.ts` "the named step in the step bar never shrinks under its name" (reads the stylesheet); before/after shots at 1024 and 1440 in `misc/studio-preview/lineup/fixes-*.png`.
- **Evidence:** node tests 591 passed.

### FIX-0037 — A chart's unit was cut inside its brackets ("% absorbed (") (2026-11-27)
- **Area:** `src-tauri/src/stage/cap.rs` (`clip_unit`), `stage/mod.rs` (chart kind in `RULES`).
- **Symptom:** a chart showed "% absorbed (" after every value.
- **Root cause:** the unit was cut at 12 characters wherever that fell; "% absorbed (per dose)" lost everything after the open bracket.
- **Fix:** a cut that leaves a bracket open ends before the bracket ("% absorbed"); the rules ask for a short unit (%, GB, kg).
- **Guard:** `cap.rs` test `a_chart_unit_is_never_cut_inside_brackets`.
- **Evidence:** `cargo test --lib`: 245 passed, 0 failed.

### FIX-0038 — Stop left the command the keeper was running alive (2026-11-27)
- **Area:** `src-tauri/src/brain/engines/cli.rs` (`spawn`, `drive`), `brain/engines/control.rs`, `platform::signal_group`
- **Symptom:** found while building pause: pressing Stop (or a time-out) ended Claude Code, but a command it had started through its Bash tool (a long `find`, a `sleep`, a script) kept running as an orphan.
- **Root cause:** `kill_on_drop` kills only the direct child; the engine's own children were in Keeper's process group and nothing ever signalled them.
- **Fix:** every engine is spawned as the leader of its own process group (`process_group(0)`); a run that ends by Stop, Change course or time-out has its whole group continued (in case it was paused) and asked to end (SIGTERM) before the engine is killed.
- **Guard:** `brain::engines::cli::tests::a_real_run_pauses_resumes_and_stops_while_paused` starts a real `sh` that runs `sleep 30`, pauses, stops, and checks both the engine and the command are gone (fails with the group signal removed: "the command it ran is gone (state S)").
- **Evidence:** `cargo test --lib` in the commit.

### FIX-0039 — A reminder was said twice, and "what reminders do I have" contradicted itself (2026-11-27)
- **Area:** `src-tauri/src/assistant/compose.rs` (`compose_reply`, moved out of `turn.rs`), `sdk/mod.rs` (`Done::answer`, `Outcome.answers`), `sdk/packs/core.rs`, `sdk/packs/personal.rs`
- **Symptom:** in Assistant mode, "Remind me tomorrow at 9am to call the dentist" answered "I will remind you tomorrow, Saturday at 9am, to call the dentist. I'll remind you to call the dentist at 9:00 AM. It's in your memory graph."; "What reminders do I have?" answered "I'll check your upcoming reminders now. The dentist reminder from this chat is one I need to confirm. Reminders still ahead (1 found): call …".
- **Root cause:** the mind writes its reply BEFORE the abilities run, and `compose_reply` always kept the whole reply and appended each ability's sentence unless the reply contained that sentence word for word. A paraphrase of the same outcome was said twice; a question's answer followed the mind's guess at it.
- **Fix:** two general rules in `compose_reply`: (1) an ability that answers a question returns `Done::answer` (ask-memory, recall-actions, find-contact, list-reminders, upcoming): the mind's reply is dropped, the answer said; (2) a sentence of the reply that mostly repeats a successful ability's sentence (two or more of its topic words, and at least half, are in it) is dropped. A failed ability never replaces the reply. `remind` now names the day ("tomorrow at 9:00 AM"), and "what reminders do I have" goes to the new `list-reminders` ability (instant phrasing in `fastlane`, the catalog question removed from ask-memory's how line).
- **Guard:** `assistant/compose.rs` tests `what_an_ability_already_says_is_said_once`, `an_answer_replaces_the_minds_guess`, `skill_outcomes_are_always_told`; `fastlane` test `reminder_and_tomorrow_phrasings_ask_the_agenda`.
- **Evidence:** cargo test (see commit), window tests 592/592.

### FIX-0040 — "Show me a video on how to tie a tie" answered with a YouTube search page, not a video (2026-11-27)
- **Area:** `src-tauri/src/sdk/packs/video/` (new `find-video`), `stage/mod.rs` `RULES`, `src/stage/panels/MediaPanel.tsx`
- **Symptom:** the 0.17 test pass: "Show me a video on how to tie a tie" gave a `web` panel opening a YouTube search ("I can't vouch for one specific video link"); "Play a short video about how volcanoes erupt" gave a `media` panel holding a search address, which the media panel cannot play.
- **Root cause:** a mind cannot know a real video address, and nothing in Keeper could look one up: the only guidance was "something to watch → media", so a careful mind fell back to search links.
- **Fix:** `find-video` asks YouTube for exactly the person's words (HTTPS, no cookies, 6 s), reads the results page's embedded data with a pure parser, picks an ordinary video (no live streams or Shorts unless nothing else; under six minutes first when "short") and shows it playing in place with two alternatives. `RULES` and the ability's own line tell every mind to use it, never a search link or a guessed address; every built-in mode lists it. The search page is shown only when nothing on it can be read.
- **Guard:** `youtube.rs` tests on a saved, trimmed results page (`testdata/youtube-search-tie.html`: a live stream, a Short, a Shorts shelf, five videos), query cleaning, the pick; `registry` test keeps the three new names; `cap` test for media panels (web or local, choices filtered). Live: `cargo test live_youtube -- --ignored --nocapture`.
- **Evidence:** live search from this Mac: tie → "How to Tie a Four-In-Hand Knot | Men's Fashion" (Howcast, 1:24); volcanoes (short) → "Volcanic eruption explained" (TED-Ed, 5:34).

### FIX-0041 — What's new showed half of each item, with ** marks as text (2026-11-28)
- **Area:** `src-tauri/src/updater/whats_new.rs` (`entries`), `src/dashboard/WhatsNew.tsx`, new `src/dashboard/whats-new-text.ts`
- **Symptom:** in the test VM after installing 0.17.0, every Added item ended mid-sentence ("Ask a keeper to change a text file ("fix the spelling in") and began "**Edit in Keeper, then save.**" with the asterisks shown.
- **Root cause:** the parser took only lines starting "- ", so a bullet wrapped onto indented lines lost its rest; the window printed the changelog's markdown bold as plain text.
- **Fix:** indented continuation lines are joined onto their bullet; the window splits `**bold**` into a bold run.
- **Guard:** `whats_new.rs` test `a_wrapped_bullet_is_read_whole`; `whats-new-text.test.ts`.
- **Evidence:** check.sh in the commit.

### FIX-0042 — On a 1024 x 768 screen the window opened past the left edge (2026-11-28)
- **Area:** new `src-tauri/src/kernel/window_fit.rs`, `lib.rs` setup
- **Symptom:** in the test VM the window's left side (the Keeper logo panel, the start of the What's new sheet) was off screen.
- **Root cause:** the window is designed at 1280 x 820 and `center: true` cannot fit a window wider than the screen.
- **Fix:** at launch the main window shrinks to the screen's room (minus the menu bar and Dock), never below 900 x 620, and is centred.
- **Guard:** `window_fit.rs` test `a_small_screen_gets_a_window_that_fits_and_a_big_one_keeps_the_design`.
- **Evidence:** check.sh in the commit; seen again in the VM after the next build.

### FIX-0043 — A Mac change timed out while macOS was still asking for permission (2026-11-28)
- **Area:** `src-tauri/src/platform/controls_macos.rs` (`MAY_ASK`)
- **Symptom:** in the test VM, "dark mode on" answered "Keeper may need permission…" after 10 s while the "control System Events" dialog was still on screen; the dialog then vanished and macOS treated it as refused.
- **Root cause:** every control call shared a 10 s limit, too short for a person to read and answer a permission dialog.
- **Fix:** calls that can make macOS ask first (AppleScript to another app, lock, screenshot) get 90 s; plain calls keep 10 s.
- **Guard:** none automatic (a timing of a system dialog); the limit is named and explained beside the constant.
- **Evidence:** seen in the VM; check.sh in the commit.

### FIX-0044 — YouTube videos would not play inside Keeper (Error 153) (2026-11-28)
- **Area:** new `src-tauri/src/stage/player.rs`, `src/stage/media.ts` (`playingEmbed`), `src/stage/panels/MediaPanel.tsx`, `tauri.conf.json` (`frame-src`)
- **Symptom:** pressing Play on a found video showed "Video player configuration error, Error 153" in the panel (also when the embed is opened as a page on its own).
- **Root cause:** YouTube's embedded player now requires the address of the page it is embedded in; Keeper's window has an app address (`tauri://`) that is never sent.
- **Fix:** a small loopback server (127.0.0.1, random port) serves a one-line page that embeds the privacy-enhanced player; the panel loads that page, so YouTube sees a normal address. It answers only `/youtube/<valid id>`.
- **Guard:** `player.rs` tests (only a valid id gets a page; loopback only); `media.test.ts` (the panel only ever loads the loopback player).
- **Evidence:** check.sh in the commit; proven in the VM after the rebuild.

### FIX-0045 — An agenda's Delete button covered the reminder's words (2026-11-28)
- **Area:** `src/stage/panels-work.css` (agenda row), `src/stage/Stage.tsx` (a lone panel is wide), `src/stage/stage.css` (the stage heading)
- **Symptom:** on a 1024-px screen "stretch" ran under its Delete button, "call the plumber" broke one word per line, and the card used half the Stage with the rest empty; a long scene title made "Biscuit is showing you" stack in four lines.
- **Root cause:** Delete was absolutely positioned over a narrow card; a single panel kept its half-width column; the heading's eyebrow could shrink.
- **Fix:** Delete is its own column beside the entry; a panel shown alone takes the full width; the eyebrow keeps one line and the scene title gives way.
- **Guard:** visual, proven by VM screenshots before and after (`misc/studio-preview/lineup/vm-*`).
- **Evidence:** the VM pass.

### FIX-0046 — The set-progress notes covered Send and the microphone (2026-11-28)
- **Area:** `src/dashboard/dashboard.css` (`.set-toasts`)
- **Symptom:** "Deep Space: 1 of 5 ready" sat over the message box's buttons.
- **Fix:** the notes sit above the message row, bottom right.
- **Guard:** visual (VM screenshot).

### FIX-0047 — The draft's Save row was half under the scene strip (2026-11-28)
- **Area:** `src/stage/panels-draft.css`, `src/stage/panels/registry.tsx` (draft help line)
- **Symptom:** on a 768-px screen Throw away / Change something / Save were cut by the strip; after saving, the card still said "Nothing is saved until you press Save."
- **Fix:** the button row sticks to the bottom while the changes scroll, the changes list is capped at 38% of the window height, and the help line no longer claims nothing is saved.
- **Guard:** `registry.test.ts` (help line rules); visual in the VM.

### FIX-0048 — "500 ml is 2.113 cup" (2026-11-28)
- **Area:** `src-tauri/src/sdk/packs/everyday/` (`counted_unit`, the cups unit)
- **Fix:** word units are counted (cup / cups, day / days…); symbols never change.
- **Guard:** test `word_units_are_counted_and_symbols_never_change`.

### FIX-0049 — "Added Dentist to your Calendar calendar" (2026-11-28)
- **Area:** `src-tauri/src/sdk/packs/personal.rs` (`added_words`)
- **Fix:** the default calendar is "your calendar".
- **Guard:** test `the_default_calendar_is_just_your_calendar`.

### FIX-0050 — "What's on today" said "Nothing on your calendar" when it could not read it (2026-11-28)
- **Area:** `src-tauri/src/sdk/packs/calendar/mod.rs` (`read_events`)
- **Symptom:** with the calendar permission dialog unanswered, the answer came after 120 s as "Nothing on your calendar or reminders today."
- **Fix:** asked and still unanswered says so: answer the question macOS is showing, then ask again.
- **Guard:** none automatic (needs the system dialog); the case is a named match arm with the reason.

### FIX-0051 — "Find my notes" found nothing on a Mac with Spotlight off (2026-11-28)
- **Area:** `src-tauri/src/pim/files.rs` (`find`, `walk_where`, `name_matches`)
- **Symptom:** the test VM has Spotlight indexing off; `~/Documents/notes.txt` was not found.
- **Fix:** when Spotlight finds nothing, Desktop, Documents and Downloads are walked by name (bounded, never inside a git working tree) before saying so; the recent-files walk shares the same walker.
- **Guard:** `files_tests.rs` test `a_name_holds_every_word_asked_for`.

### FIX-0052 — "Find my movies" looked for files named "movies" (2026-11-28)
- **Area:** `src-tauri/src/sdk/packs/files/find.rs` (`find_words`), `sdk/packs/video/mod.rs` (`find-movies` instant phrasings, `is_movies_word`)
- **Symptom:** in the VM, "find my movies" answered "I couldn't find anything called movies on this computer" though a movie was in ~/Movies.
- **Root cause:** the file search's "find my X" phrasing caught it before the movies ability, which had no phrasings of its own.
- **Fix:** find-movies answers "find/list/play my movies|videos|films" at once; the file search leaves those words to it ("show me my videos" still opens the Movies folder view).
- **Guard:** `instant_tests.rs` rows for "find my movies", "find my videos", "show me my videos".

### FIX-0053 — The built-in mind opened "a video on how to tie a tie" as an app, and could not do what Keeper can (2026-11-28)
- **Area:** `src-tauri/src/brain/reflex.rs`; the phrasings of every everyday ability (`sdk/packs/reminders/words.rs`, `desktop/words.rs`, `computer/{look,open,change}_words.rs`, `everyday/words.rs`, `video/words.rs`, `core.rs`); new `health` ability (`core.rs` over `health::all`); `platform::app_installed`.
- **Symptom:** on a fresh Mac with the built-in mind, System Administrator mode: "Show me a video on how to tie a tie" → "I couldn't find an app called a video on how to tie a tie"; "Remind me in 10 minutes to stretch", "Turn on dark mode", "Keep my Mac awake for an hour", "Take a screenshot", "Is everything working?" → the built-in mind's refusal; "What time is it in Tokyo?" → the local time; "My name is Amos and I love cricket" → the name "Amos and I love cricket".
- **Root cause:** the built-in mind kept its own copies of abilities (`remind`, `open`, `switch_engine`, the list-reminders branch): "show me X" was its open-app rule, its remind rule took the time only at the end, and the abilities that exist (dark mode, keep awake, screenshot, time-in, the health checks) had no words of their own, so with no AI connected nothing could ask for them. The name rule took up to 40 letters and spaces.
- **Fix:** every everyday ability declares conservative whole phrasings (`Instant::Also`) in its own pack, guarded by what it can really do (an installed app, a known time zone, a sum of digits and operators, known units, a clear clock time); a `health` ability shows the Settings checks as a table. Reflex keeps only conversation and memory rules, its time rule no longer answers "time in X", its help says what works with no AI, and a name stops at punctuation or a joining word, with the rest learned when it is a statement. Change abilities still run only at the Mac.
- **Guard:** `sdk/instant_tests.rs` (every new phrasing, near misses that stay with the mind, the inputs read, changes refused from the phone), `reflex::tests::the_built_in_mind_holds_no_ability_rules` (the rule list is pinned; each old ability phrasing is answered by its ability), `a_name_stops_at_a_joining_word_and_the_rest_is_learned_too`, per-pack word tests.
