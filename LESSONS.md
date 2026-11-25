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
