# The keeper ecosystem: Studio, rarity, levels, effects, marketplaces

Founder direction, 2026-11-25: "go as granular as possible in terms of customisation of a keeper":
a full-page editor that zooms in on the part being changed, colour per part of the body, swappable
effects (thinking, idle, celebrate) with rarity from common to mythical, voices you can test and
generate, species-only items (a dog's nail set, collars), personal items (a necklace or T-shirt
with your own photo) unlocked by levels the keeper earns by being used, an official marketplace
and a community one. This builds on the Keeper Kit (`keeper-kit.md`): species, slots, parts that
fit any body, one wardrobe per person, packs as data only.

## The pieces

| Piece | What it is | Where it lives | Rules |
|---|---|---|---|
| **Look** | colour and material per paint zone of the body | `KeeperProfile.look` (`zone → {color, material}`) | each species declares its zones (robot: head, face, body, base ring, antenna; dog: head, ears, muzzle, body, legs, paws, tail); materials: matte, gloss, metal, fur, feathers, glow. The standard body is smooth: fur (the dog, mythical) and feathers (the owl, legendary) are COATS a keeper obtains, never picks (`kit/look.rs` `OBTAINED_ONLY`, `KeeperProfile.obtained`) |
| **Outfit** | wearables in slots (existing) | wardrobe + `KeeperProfile.wearables` | unchanged; parts may now be species-only (`species: ["puppy"]`) |
| **Effects** | swappable add-ons for moments: thinking, idle, celebrate, speaking | effect slots (`kind: "effect"`) in the same wardrobe | one per moment; the built-in look of each moment is the "Classic" common effect |
| **Habits** | what this keeper does on its own: sleeps when left alone, stretches, hums, looks around, chases its tail | `KeeperProfile.habits` (weights) | unique per keeper; species may add their own (only a dog chases its tail) |
| **Voice** | system or ElevenLabs voice, tested in place; new voices designed from words with the person's ElevenLabs key | `KeeperProfile.voice` | per keeper (today one voice for all) |
| **Rarity** | common, uncommon, rare, legendary, mythical | on every part, variant and effect | shown as a frame colour and, for legendary and mythical, a moving shine; mythical effects are the most dramatic (the current thinking loader is a mythical effect) |
| **Level** | experience the keeper earns by being used | DERIVED from its own graph (turns, lessons, quiz answers right, actions done), never a stored counter | levels unlock items and features (photo necklace, printed T-shirt, effect slots); a derived level cannot be edited by hand |
| **Personal items** | a pendant or T-shirt print with the person's own image | the image stays in Keeper's private app folder; the item stores a hash and a local path, never the picture in a pack | level-locked; never shared in packs (a person's photo is personal data) |
| **Marketplaces** | Official: items Keeper ships (and later a signed catalogue feed, verified like updates). Community: `.keeper.json` packs people share | Studio "Marketplace" tab | official items unlock by level (no payments built; that is a founder decision); community packs are validated data only, never code, never URLs fetched |

## Experience and levels

XP = 10 per turn + 25 per lesson (a turn with panels) + 15 per quiz answer right + 20 per action
done on the computer, read from the keeper's graph by bounded count queries. Level n needs
`50 * n * (n + 1)` XP (level 1 at 100, level 5 at 1,500, level 10 at 5,500). Unlocks are one table
(`kit/levels.rs`): level 2 uncommon items, 3 a second effect slot (idle), 4 rare items, 5 the
photo pendant, 6 celebrate effects, 8 the printed T-shirt, 10 legendary items, 15 mythical items.
The person's first keeper starts with the Classic effects and the common wardrobe.

## The Studio (window)

A full page, not a settings section: the keeper large on the left, tabs on the right (Look,
Outfit, Effects, Habits, Voice, Soul, Level, Marketplace). Choosing a zone or a slot moves the
camera to it with a smooth ease (head, chest, paws, tail), so changing the fur colour zooms onto
the fur. Every change previews live and is saved on "Save" (or thrown away on "Cancel"). Locked
items show their level; rarity frames on every tile.

## Build order (rounds)

1. Core data: rarity, species-only parts, effect slots, habits, look zones, levels from the graph.
2. The rig: paint zones and materials on both species; dog nail set and collar; habits drive idle life (sleep).
3. The Studio page: layout, tabs, camera zoom to a zone, live preview, save/cancel.
4. Effects: thinking/idle/celebrate add-ons from common to mythical, swappable per keeper.
5. Voice per keeper: test voices; design a voice from words (ElevenLabs, with the person's key).
6. Marketplaces: Official catalogue with rarity and level locks; Community packs (import, export, share).
7. Personal items: photo pendant, printed T-shirt (local image, level-locked, never in packs).
8. Described items: "a neon jacket with gold trim" becomes a validated variant through the helper model.

## Decisions taken with the recommended option (founder to review)
- No payments: official items unlock by level; buying is a later decision (which store, which prices).
- XP is derived from the graph, so it cannot be bought or edited; a lost graph loses its level.
- Personal photos never leave the computer and are never put in packs.
- The community marketplace starts as pack files people share; a hosted community index (and its moderation) is a later decision.
