# Lessons

### LES-001 — Working Memory scopes every query to one Knowledge Asset (2026-11-25)
- **Context:** Forgetting a fact writes a `desk:Retraction` KA; the first `FACTS` query left retracted facts out with `FILTER NOT EXISTS { ?r desk:retracts ?f }`. On the real node (10.0.26) the retracted fact still came back. A direct join (`?r desk:retracts ?f . ?f schema:text ?t`) returned nothing, and `MINUS` kept everything.
- **Lesson:** In Working Memory each KA is its own scope: patterns that span two assets match nothing, so filters across assets silently pass everything. A mocked client could never show this (LES-011 in umoja-ark).
- **Rule added:** Every query reads one class; joins across records happen in Rust (`memory::Memory::facts` filters retractions). The query test fails on `NOT EXISTS` or `MINUS`. Prove every new query on the real node before it ships.

### LES-002 — An agent with tools and nowhere to show things builds web pages (2026-11-25)
- **Context:** Asked to "pull up some tables and show me how math works", Claude Code (allowed to act) wrote `~/Documents/Math/math-tables.html` and opened the browser. The keeper had no way to show anything inside itself, so the agent used the tools it had.
- **Lesson:** Give the engine a first-class display surface and tell it to use it: a typed, validated panel protocol (the Stage) plus an explicit rule never to create files or pages just to show something. Proven live: the same request now answers with six panels and no tool calls.
- **Rule added:** Every engine prompt carries `stage::RULES`; panels are a closed, capped set (`stage::read`); renderers draw text only.

### LES-003 — Identity is composed from parts that trade separately (2026-11-25)
- **Context:** The founder defined a keeper as soul (who), role (what it can do), body (species + wearables) and memory (what it experienced, on the DKG), each shareable on its own, never memories.
- **Lesson:** Keep these four as separate data with separate stores and validators; compose them only at turn time (soul brief + role brief + recalled facts + stage rules). Packs carry data only (no code), validated against the catalog, so a stranger's pack is safe to load.
- **Rule added:** `keepers::kit` owns souls, roles, species, parts, packs and inventory; packs are validated by `kit::packs::read`; roles gate skills and acting in `assistant`.

### LES-004 — A written Knowledge Asset is final; anything that changes is a new version (2026-11-25)
- **Context:** The 0.6 live tests found that a second write under an asset name answers 409 (`KA_ASSERTION_ALREADY_FINALIZED`), and that treating every error as "node down" filled the outbox with writes that could never succeed. The same 409 means "graph already exists".
- **Lesson:** On the DKG an asset is immutable once written: a record that changes (a soul, a cached scene, a setting) is a series of versions read newest-first, never an overwrite. And an error class decides what happens next: "unreachable" may retry, "already there" is done, "refused" is reported. Never collapse them into one.
- **Rule added:** `DeskError::Exists` for 409; `Memory::write` and the outbox never queue it; changing records use time-versioned asset names with newest-first reads (`inventory::version_name`, `scene_cache`).

### LES-005 — Measure speed through the real app, not a shell (2026-11-25)
- **Context:** A shell test said Claude Code took 4.7 s cold and 0.93 s warm, which suggested a 5x win from warm processes. Through Keeper's own code the gain was about 0.3 s: the shell runs included 3 s the CLI spends waiting for stdin when it is started with a prompt argument and an open stdin. The real costs were the model's first token (2.0 s main model, 1.0 s Haiku), recall (85 ms) and DKG writes before the reply (55 ms each).
- **Lesson:** Speed claims come from the app's own path with its own timings (`TurnResult.timings`), repeated over several rounds, never from a lookalike shell command.
- **Rule added:** `scripts/bench/run.sh` drives an isolated real Keeper through its test link and reports first words and done per turn; every speed change is judged by it.

### LES-006 — A wearable reads the body's shape, never the species (2026-11-25)
- **Context:** The founder wants anything one keeper can wear (a jacket) to work on another. Slots held three floating parts placed by anchor position only; anything worn ON a body would have needed per-species code (a robot jacket, a dog jacket).
- **Lesson:** Make the body publish what a garment needs (the surface rings at the slot, depth, squareness, reach, lean, limbs) and make every wearable an Adapter over that shape. Take the measurements from the SAME constants the rig is built from (one `<species>-shape.ts` per species), or the published shape drifts from the body it describes.
- **Rule added:** Worn slots carry `follow` + `shape` (`skins/catalog.ts`); parts get `PartFit` and never branch on the species id; `wearables-fit.test.ts` builds every worn part on every body offering its slot (and a made-up boxy one) and fails if anything sinks in or floats off.

### LES-007 — A worktree's dev server needs its own dependency cache (2026-11-25)
- **Context:** A preview served from this worktree answered `504 Outdated Optimize Dep` and logged reloads for files from another worktree: `node_modules` is a link into the main checkout, so `node_modules/.vite` is shared by every worktree's Vite at once.
- **Lesson:** Two Vite servers on one shared `node_modules/.vite` re-optimise each other's dependencies. Any throwaway preview server in a worktree sets its own `cacheDir`.
- **Rule added:** Previews under `misc/` start Vite with a config whose `cacheDir` is inside the preview folder.

### LES-008 — Benchmark the setup people actually have (2026-11-25)
- **Context:** rounds 1–10 measured 0.8 s first words on a Companion keeper with acting off, while every new person's first keeper is a System Administrator with acting on; the founder's own Keeper took 6–19 s.
- **Lesson:** a speed claim holds only for the profile it was measured on. Measure the default first-run profile and the founder's real settings, not the easiest one.
- **Rule added:** `scripts/bench/run.sh` has `PROFILE=admin`; a speed change is reported with both profiles.

### LES-009 — Working Memory assets can be discarded, so erasure is possible (2026-11-25)
- **Context:** DESK-ERASE-001 assumed DKG writes are additive only; the node (10.0.26) discards a Working Memory asset by name, sealed or not, and its triples leave the node.
- **Lesson:** read the node's lifecycle routes before designing around a limit; "a written asset is final" (LES-004) is about changing it, not removing it.
- **Rule added:** personal records are one asset each, named so they can be erased alone; every forget/erase goes through `Memory::erase_fact` (discard first, retraction only as the offline fallback).

### LES-010 — A painted surface and a per-frame animation must not both own one value (2026-11-25)
- **Context:** Round E2 made each paint zone repaintable live. The robot's torso already wrote `sheen` every frame (it breathes with presence), so a painted "metal" torso would have had its sheen rewritten 60 times a second, and toggling a lobe on and off each frame recompiles the shader each frame.
- **Lesson:** A look is a REST value; animation rides on it. Paint writes the rest values once per change (`look/zone-paint.ts` `PaintableMaterial.painted`) and any per-frame write scales from that painted rest, never from a constant. Physical-material lobes (sheen, clearcoat, iridescence) may switch on or off only when the look changes, so three.js compiles a variant once, never per frame.
- **Rule added:** Skins paint only in `Skin.paint` (called on a look change or a new skin); a per-frame material write in a skin reads `PaintableMaterial.painted`. Every species zone has its own material (the puppy's coat was one shared caramel), so a zone repaints exactly its own meshes.

### LES-011 — A check that greps test output can pass a red test (2026-11-26)
- **Context:** a commit went in with a red window test: the check was `node --test … | grep "ℹ (pass|fail)" && git commit`, and grep succeeds whatever the counts say.
- **Lesson:** a gate must fail on the runner's exit code, not on finding a summary line.
- **Rule added:** commits go through `scripts/check.sh` (tsc, window tests, core tests; `set -e`, exits on the first red).
