# The Keeper Kit: soul, role, body, memory, and the Stage

Founder direction, 2026-11-25. A keeper is assembled from four independent parts, each one
replaceable and shareable on its own, and everything a keeper learns or owns lives on the DKG.

| Part | What it decides | Defined by | Stored | Shareable |
|---|---|---|---|---|
| **Soul** | WHO it is: personality, tone, humour, formality, catchphrases, greeting, how it reacts to being poked or patted | `Soul` (data) | a `desk:Soul` Knowledge Asset in the keeper's graph and in the person's kit graph | yes: a soul pack |
| **Role** | WHAT it can do: its job, instructions, the skills it may use, its scope | `Role` (data; built in for now: System Administrator, Companion) | the role id on the keeper profile, its definition in the keeper's graph | later: role packs |
| **Body** | HOW it looks and moves: a species (robot, dog) and wearables in slots (halo, base, aura…) | `Species` + `Part`s (data) | the keeper profile + `desk:KitItem` assets in the kit graph (the inventory) | yes: part variants in packs |
| **Memory** | WHAT it has experienced: facts, chats, actions, reminders | its own Context Graph | the keeper's graph (Working Memory) | never by a pack (memories are not traded) |

The memory grows ON the soul (the same soul with different experiences becomes a different
keeper), but trading a soul never carries memories.

## Species and parts (the body)
- A **species** owns the rig (geometry, how it moves, its built-in reactions: poke, pat, think,
  work, celebrate, sleep) and declares its **slots** and anchor points. A robot body can never be
  worn by a dog: species are not parts.
- A **part** (wearable) fills one slot, lists the species it fits, and carries declarative
  **effects** (colours, speeds, counts, glow) and **attributes** (what it adds: e.g. the Memory
  Halo shows memory writes as sparks). Built-in parts: Memory Halo (halo; any species), Ark Hull
  (base; any species), Star Aura (aura; any species). A dog wearing the Memory Halo is a "Halo Dog".
- A **variant** is a part with different effect values ("Ruby Halo": red, faster). Variants are the
  safe unit of sharing: data only, validated against the part's effect schema, never code.
- **Inventory**: the built-in parts plus variants the person imported, as `desk:KitItem` assets in
  their kit graph. Equipping is per keeper (`KeeperProfile.wearables`).

## Roles
A role is the keeper's job description: a title, a brief (instructions to the engine), the skills it
may use, and what it must refuse. Built in: **System Administrator** (files, folders, finding,
opening, organising, editing documents, apps) and **Companion**. Role ≠ soul: a System
Administrator keeper can have a calm soul or a playful one.

## Souls
A soul is a personality: name, a one-line summary, traits, tone, humour (0–10), formality (0–10),
emoji use, catchphrases, a greeting, lines for being poked and patted, and do/don't rules for
style. Built-in souls: **Steady** (calm, precise), **Island Vibes** (warm Caribbean banter),
**Sunny Pup** (bouncy, affectionate). The engine's instructions are composed as
soul (who) + role (what) + recalled memories (what it knows) + the Stage rules (how to show).

## Packs (`.keeper.json`)
`{ "format": "keeper-pack/1", "kind": "soul" | "variant" | "keeper", ... }`. Validated on import:
known species/slots/effects only, value ranges checked, text capped, no code, no URLs fetched. A
keeper pack carries name, species, role id, soul, wearables (and variants it needs), never memories.
Imported items are written to the kit graph (inventory) as Knowledge Assets.

## The Stage
Engines answer with typed **panels** (`src/stage/panel-spec.ts`, Rust `stage::Panel`): text, table,
steps, formula, cards, quiz, chart, files. Keeper draws them inside its own window as animated
panels, the keepers sidebar slides away, and pointing at any piece asks the keeper about exactly
that piece in the same chat. Engines are told never to build web pages or files just to show
something. While an agent works, its tool calls play as a live activity panel.

## Work animations
A `working` state driven by the turn's phase and the computer's load (CPU and memory from the
core): the robot's halo spins faster, its eyes shift colour and its core heats up; the dog's ears
perk, its tail wags faster and it pants. Each species defines its own; parts react through their
effects (the halo's spin speed follows the work level).

## Where things live (code)
- Core: `src-tauri/src/keepers/` (`kit/` species, parts, roles, souls, packs, inventory),
  `src-tauri/src/stage/` (panel validation), `src-tauri/src/system/` (load readings).
- Window: `src/character/` (species rigs as skins, wearables as attachable parts, reactions as
  data), `src/stage/` (panel renderers, the stage layout), `src/keepers/` (inventory, souls UI).
