# Keeper memory: ONE context graph, organised in sub-graphs

Founder direction, 2026-11-26: "you really want to use ONE context graph and then have your stuff
organized into subgraphs". This matches the fleet's single-graph pattern (Foreman DKG reference
§"single-graph pattern") and the V10 docs ("use the Context Graph boundary for a collaboration and
its policy; use sub-graphs to organize the knowledge within it").

## Today (measured 2026-11-26, node 10.0.26 edge)
- One context graph PER KEEPER (`umoja-desk-<hash>` for the first, `keeper-<hash>-<seed>` after),
  plus a separate kit graph (`keeper-kit-<hash>`) for souls, modes and wardrobe variants.
- No sub-graphs. The founder's Mac: Trini Boi in `umoja-desk-176b503b62`, kit in
  `keeper-kit-176b503b62`; five more test graphs on the node.

## Target
One context graph per person and computer account: the existing `umoja-desk-<hash>` keeps its
exact id (it already holds the first keeper's memory) and becomes the HOME graph.

| Sub-graph | Holds |
|---|---|
| `kit` | souls, modes (and their tombstones), wardrobe variants, packs |
| `keeper-<id>` | one keeper's memory: facts, turns, chats, actions, reminders, retractions, cached scenes, quiz answers, level records, its profile |

Tiers stay inside the graph (WM now; share and publish later move a record to SWM/VM in the SAME
graph and sub-graph). Privacy is the record's (WM, never shared), not a graph split.

## Proven on this node before building (scratch graph `umoja-desk-bench`)
- `POST /api/sub-graph/create {contextGraphId, subGraphName}` creates one; `GET /api/sub-graph/list`
  lists them with triple counts.
- `POST /api/knowledge-assets` with `subGraphName` writes into it (12 ms; the asset graph is
  `…/<cg>/<sub>/_working_memory/<author>/<n>`).
- `POST /api/query` with `subGraphName` reads only that sub-graph (a different name returns nothing).
- `POST /api/knowledge-assets/<name>/wm/discard` with `subGraphName` erases it.
- Unscoped queries see every sub-graph, so every Keeper read names its sub-graph.

## Moving existing memory (fail-safe)
1. Create the sub-graphs. 2. Read each record class from the old graph (bounded, by class) and
write it into its sub-graph under the SAME asset name, rebuilt from the record's own fields
(erasure goes by name: a moved record must stay erasable). 3. Compare counts per class, old vs new.
4. Only when every count matches, the keeper's settings switch to the new place (`memory_place`).
5. The old graphs are left in place (never deleted by the move); a later, separate step offers to
remove them once the founder is satisfied. A failed or partial move changes nothing the keeper
reads, and runs again next start (idempotent: same names, WM writes are additive per name).

## Checks every round (the scenario bench gains a memory scenario)
Tell a fact, ask it back in another chat (recall from the graph), ask it in another mode
(personal facts shared, work notes not), forget it (gone from the graph), timing of recall and write.
