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
