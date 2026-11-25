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

## Decisions taken with the recommended option (founder to review after round 10)

1. Quick replies ON by default: short conversational turns use the helper model (Haiku); lessons, comparisons, visual and acting turns stay on the keeper's own model.
2. Linux and Windows builds move in-house to a bb-bench VM (Windows cross-built from Linux with cargo-xwin); until then a release carries the platforms actually built.
3. The repo stays public (founder: "leave it open").
