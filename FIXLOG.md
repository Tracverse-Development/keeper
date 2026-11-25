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
