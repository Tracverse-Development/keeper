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

## Decisions taken with the recommended option (founder to review after round 10)

1. Quick replies ON by default: short conversational turns use the helper model (Haiku); lessons, comparisons, visual and acting turns stay on the keeper's own model.
2. Linux and Windows builds move in-house to a bb-bench VM (Windows cross-built from Linux with cargo-xwin); until then a release carries the platforms actually built.
3. The repo stays public (founder: "leave it open").
4. Keeper installs its own private Node.js (official build, SHA-256 checked) when a Mac has none, rather than asking the person to install it.
5. "Remove Keeper from this Mac" keeps keepers and memories by default (a reinstall brings them back); deleting everything is the second choice.
6. Asking for the brief is when Keeper asks for calendar access (if it never asked before).
8. Keeper installs Claude Code itself on request (pinned 2.1.322, a release at least two weeks old; it updates itself afterwards); sign-in happens in Claude Code's own Terminal flow.
7. Items in the wardrobe are designs by default (any number of keepers can wear one); "one of a kind" items are worn by one keeper at a time.
