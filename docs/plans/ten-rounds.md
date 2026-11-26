# Ten rounds (founder 2026-11-25)

Goal: fast responses, a fast interface, fun robots, a proper core structure, parts that swap
between keepers, scenes that make sense and are easy to navigate, real-time chat. Everything
built and tested in-house (this Mac, the bb-bench tart VMs, DigitalOcean droplets); CI runs only
the basic Linux checks. Decisions that need the founder are taken with the recommended option
and listed at the end (below), to be revisited after round 10.

Speed is judged by `scripts/bench/run.sh` (a real, isolated Keeper driven through its test link).

| Round | Theme | Result |
|---|---|---|
| 1 | Speed core: hot memory, writes after the reply, warm spares, quick replies, live typing, timings | first words ~0.8 s on model turns (was ~2.2 s); recall 85 ms → 0.06 ms; cached lessons 11–46 ms; 22/22 turns ok |
| 2 | Real-time chat + VM: Stop ends a turn, messages queue while busy; clean-Mac VM install (tart): own Node.js, node restart after reboot, Remove Keeper, honest brief | Stop in 1.5 s; VM: node installs with no Node.js present, comes back 14 s after a reboot; calendar read into the brief; 11/11 VM turns ok |
| 3 | Scenes + face: breadcrumbs, scene strip, arrow keys; emotes, screen faces, particles, idle life; wardrobe merged | navigation click-tested (0 page errors); 60 fps held (p95 21 → 18 ms) |
| 4 | Scale: recall window 200 → 5,000 facts (FIX-0008) | 1,000 facts: all in reach; cold 94 ms, hot 7.5 ms |
| 5 | Robustness: node dies mid-session (FIX-0010, FIX-0011): answers go on from hot memory, writes wait in the outbox, a watchdog restarts the node and flushes | VM: 3–13 ms answers with the node down; node back within a minute; 0 writes lost |
| 6 | Useful for a new person: "Set up Claude Code for me" + "Sign in to Claude"; the phone link keeps one chat per session; the setup button reachable by VoiceOver | VM: Claude Code 2.1.322 installed by Keeper on a Mac with neither Node.js nor Claude Code; Terminal opens on its sign-in |
| 7 | Fast interface: the command palette (⌘K): switch keeper, new chat, brief, stop, settings, memory, scenes, pinned scenes; anything else is asked of the keeper | WebKit: "pu" + Enter switched to Pup, free text was sent; ranking tested |
| 8 | Wardrobe in the real app: dress one keeper, give the jacket to another; robot skin label "Robot" (was "Umoja"); Esc closes Settings and Memory | VM: Ark Jacket worn by Kofi (robot) → Move → worn by Pup (puppy), refitted with sleeves; saved state agrees |
| 9 | Regression: release-build bench, every live test, leak check; a bad warm spare retries | 22/22 turns, model first words 0.65–1.3 s; 24/24 live tests; 0 leaked processes |
| 10 | Release 0.7.0 in-house (both Macs built here); release script fixed to create its own draft and require only the platforms built | published; clean VM: 0.6.2 updated itself to 0.7.0 in 5 s and runs it |

## Decisions taken with the recommended option (founder to review after round 10)

1. Quick replies ON by default: short conversational turns use the helper model (Haiku); lessons, comparisons, visual and acting turns stay on the keeper's own model.
2. Linux and Windows builds move in-house to a bb-bench VM (Windows cross-built from Linux with cargo-xwin); until then a release carries the platforms actually built.
3. The repo stays public (founder: "leave it open").
4. Keeper installs its own private Node.js (official build, SHA-256 checked) when a Mac has none, rather than asking the person to install it.
5. "Remove Keeper from this Mac" keeps keepers and memories by default (a reinstall brings them back); deleting everything is the second choice.
6. Asking for the brief is when Keeper asks for calendar access (if it never asked before).
8. Keeper installs Claude Code itself on request (pinned 2.1.322, a release at least two weeks old; it updates itself afterwards); sign-in happens in Claude Code's own Terminal flow.
7. Items in the wardrobe are designs by default (any number of keepers can wear one); "one of a kind" items are worn by one keeper at a time.

## Second set (founder 2026-11-25: "you didn't do the rounds"; "asking anything takes a long time")

Each round: use the installed app as the founder does (his settings: System Administrator keeper,
acting on, ask before acting, ElevenLabs voice), measure with `PROFILE=admin`, fix, ship, update.

| Round | Theme | Result |
|---|---|---|
| 1 | The founder's slowness (FIX-0012): acting keepers took the plan path on every message | admin bench first words median 7,968 → 480 ms, p90 13,192 → 849 ms; 0.7.1 |
| 2 | Questions like the founder's: "what was I working on yesterday" answers instantly from the files changed (fastlane `RECENT_WORK`); release script makes its own draft (the 0.7.1 publish waited 10 min) | "computer-miss" 8,788 ms → 43 ms with the real file list; admin bench median 467 ms, p90 1,068 ms; 0.7.1 published |
| 3 | Lessons: fewer, tighter panels (usually 2 to 4, at most 5); the speed line shows when the first picture arrived (`Timings.panel_ms`) | fresh lesson on the admin bench: first words 1.9 s, first picture 4.5 s, done 9.8 s (was 11.7 to 13 s done) |
| 4 | Approve and do: the phone link can approve or refuse a plan (`/api/plan`, steps + buttons on the phone page; it showed "Umoja" as the name); acting turns skip the person's Claude Code settings; the acting process starts while the plan is read | bench "make a folder in /tmp": approve → done 12.3 s → 6.2 s, folder made; 6/6 live tests |
| 5 | DKG off the lesson path: hot memory knows every cached scene's key (loaded with recall's data) and holds scenes once read or written; a new question costs no DKG query; 0.7.2 published (the release script made its own draft) | repeated lesson 16–31 ms → 0 ms; new lessons skip a query (8–300 ms on the founder's node); live memory tests 10/10 |
| 6 | Speak sooner: the first whole sentence is spoken as soon as it is written, the rest queued after it (voice helper `queue`, rotating ElevenLabs files, in-order rendering); `Timings.speak_ms` | quick replies speakable at 0.77–1.29 s, lessons at 3.5 s; queue proven in the VM (queued: start, start, end; cut off: start, end, start, end) |
| 7 | Real erasure (FIX-0013, DESK-ERASE-001 partly): "forget" discards the fact's asset from Working Memory, one path for every forget; retraction only when offline | live test proves the fact's words are gone from the node (found before, nothing after); memory live tests 10/10 |
| 8 | Delete a conversation: × on a chat, then "Delete for good", erases every turn and the chat from the node (`Memory::erase_chat`, `chat_delete`); the open chat is replaced by a fresh one | live test: a 2-turn chat erased, a raw query for its words finds nothing; window tests 214/214 |
| 9 | Fewer false "computer work" turns: a changing verb needs a computer thing, a path or "my" ("run a marathon", "save money", "a chat to delete" stay chat); 0.7.3 published | "I want to run a marathon…" now the quick model, 1.6 s to first words (before: the Opus plan path); computer turns still plan; approve → folder made |
