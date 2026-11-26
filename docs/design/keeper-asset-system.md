# The keeper system: diagnosis, design and plan

Founder direction, 2026-11-26:
- Modes are locked to their scope and switch when asked for something else.
- The body is swappable down to eyes and limbs, with hybrids such as mechanical dog legs. Each part belongs to its species, class and habitat.
- Sets (a Guardian set and others) and backgrounds; some species live only in some habitats (a fish keeper under the ocean, with fish-only gear).
- Each mode has its own instructions, skills, resources (links) and memory on top of one shared intelligence.
- Mode instructions and souls are editable in the app.
- Keepers build their own skills from work they finish (a self-improving system), with a skills marketplace later.
- Everything is structured for the DKG. Nothing goes on a blockchain now; official equipment on-chain and open contributions are later ideas, kept in mind but not built.

Research for this document: an agent-led web review of 2023–2026 sources, cited inline.

---

## Part 1. Diagnosis: where the keeper system stands

### What is solid
- **One memory per keeper on the DKG**, with personal facts shared and work facts filed per mode, threads per chat, erasure that really erases, and hot memory for speed.
- **Bodies and clothes are separated cleanly.**
  - A wearable fits any body that offers its slot (parts fit to a published body shape, not per-species code).
  - Rules live in the core and are tested; the window draws.
- **Modes, styles and souls are separate axes.** Modes have their own tools and skills and are now locked to their scope.
- **Rarity and levels exist.** Levels are derived from the graph, not stored.
- **Quality gates are mechanical**: lockstep tests between core and window, size and boundary guards, live tests on the real node and engine, and a speed bench.

### Gaps, worst first

| # | Gap | Effect | Fix (Part 2 section) |
|---|---|---|---|
| G1 | The **body is fixed per species**: no swappable eyes, ears, limbs or tails, no hybrids | The founder's main customisation ask cannot be met by adding items | Anatomy sockets and components (2.2) |
| G2 | **The catalogue is code, in two languages kept in lockstep** (Rust table and TypeScript factories) | Every new species, part or set needs a release; contributors can't add anything; DESK-KIT-PARTS-001 | Data-driven catalogue on the DKG, with geometry as parametric "kits" (2.5) |
| G3 | **No classes, sets, habitats or backgrounds**; species have no traits | No Guardian set, no ocean, no fish-only gear | Taxonomy (2.1–2.4) |
| G4 | **Compatibility is spread out**: species slot lists, a part's species list, rarity levels, level gates | Every new rule (habitat, class, hybrid) would add another `if` | One compatibility rule over requirements (2.6) |
| G5 | **Modes and skills are hard-coded**: 5 modes, 8 skills, no user instructions, no resources (links/docs) per mode | Modes can't be edited or uploaded; there is no growth | Modes as data plus skills in the Agent Skills format (3.1–3.3) |
| G6 | **No learning**: a keeper does a task and forgets how | It doesn't get better at a domain | Skill learning loop (3.4) |
| G7 | **Mode switching costs a second model call**: the engine notices it's out of scope, then the new mode answers | +5–12 s on a switch (measured: vaccines question 12.3 s) | Route before answering (3.5) |
| G8 | **Souls are edited in Settings; the Studio has no Soul or Modes tab** | Personality and jobs feel hidden | Studio tabs (4) |
| G9 | **Official vs personal vs imported** is a string field (`source`), with no stable identifiers or provenance | Hard to version, attribute or later publish | DKG identifiers and PROV (2.5) |
| G10 | **Research mode takes about 70 s**, and lessons on Opus take about 10 s | Slow for the founder | Faster routing; Sonnet for research and lessons is a founder choice |

---

## Part 2. The asset system (bodies, gear, sets, habitats)

### 2.1 The axes
Every keeper is a combination of independent choices, each a small piece of data:

| Axis | What it is | Examples |
|---|---|---|
| **Body plan** | the skeleton: which sockets exist and how they move | biped-orb (robot), quadruped (dog), swimmer (fish), avian (bird) |
| **Species** | a body plan plus its traits and the habitats it can live in | Robot (biped-orb, any habitat), Dog (quadruped, land), Fish (swimmer, ocean only) |
| **Class** (material lineage) | what a component is made of; drives looks and hybrid rules | Organic, Mechanical, Crystal, Spectral |
| **Habitat** | the world the keeper stands in: background, light, ambient life, physics hints | Starfield (today's), Ocean, Forest, City, Desert |
| **Rarity** | how special an item is (existing) | Common → Mythical |
| **Set** | a named collection of components, wearables and effects with set bonuses | Guardian, Voyager (sci-fi), Ark Pilgrim |

### 2.2 Anatomy: sockets and components (G1)
- **Sockets:** a body plan declares its anatomy sockets. A quadruped has head, eyes, ears, muzzle, torso, front limbs, hind limbs and tail; a swimmer has head, eyes, body, fins and tail.
  - Each socket has a **shape key** (`eye.round`, `limb.quadruped.fore`, `fin.pectoral`) and a **mount**: the bone and the fit data the rig already publishes for worn slots.
- **Components:** a component is a swappable body part for one shape key. For example:
  - "LED eyes" (mechanical, `eye.*`)
  - "Slit eyes" (organic, `eye.*`)
  - "Hydraulic forelegs" (mechanical, `limb.quadruped.fore`)
  - "Crystal tail" (crystal, `tail.*`)

  It declares its class, rarity, the shape keys it fits, and its geometry kit (2.5).
- **Hybrids** come for free: a dog with Organic everywhere except Mechanical forelegs is a hybrid.
  - Its derived tag is "Mecha-hybrid" when 1–3 sockets are mechanical, and "Cyborg" when more than half are.
  - The tags drive cosmetic extras, such as sparks at the joints.
  - A species can forbid classes: a Spectral fish is fine, a Mechanical ghost is not.
- **Paint zones** (built) become per-component: each component carries its own zones, so "the mechanical arm's plating" is a zone.
- **Wearables** (built) mount on sockets instead of fixed slots. A jacket mounts on `torso` and puts sleeves on whichever limb components are present, as it does today.

### 2.3 Habitats and backgrounds (G3)
- A habitat is the stage's world:
  - backdrop and fog
  - light rig
  - ambient particles (bubbles, leaves, dust)
  - a sound bed (optional)
  - physics hints (a floating bob, a swimming sway)
- **Species declare the habitats they can live in.**
  - A Fish lives only in Ocean (choosing it switches the habitat).
  - Robot and Dog live anywhere, with a "land" default.
- **Habitat-exclusive gear:** an item may require a habitat ("Diving Helmet": Ocean only; "Snow Cloak": Tundra).
- **Backgrounds** are habitat skins: the same Ocean with a reef or a shipwreck. They are sold and earned like items, with rarity.

### 2.4 Sets
- A set lists its pieces (components, wearables, effects) and **bonuses at thresholds**:
  - 2 pieces: an aura tint
  - 4 pieces: a unique idle emote
  - the full set: a mythical effect and the set's title on the keeper ("Guardian Pup")
- Bonuses are cosmetic and behavioural only, never more intelligence: the mind is the same.
- First three sets, as **design proposals for the founder**:
  - **Guardian:** heavy plated, gold and navy, a shield aura, a protective stance.
  - **Voyager:** sci-fi, white and cyan, a visor, a jet pack, a hologram effect.
  - **Ark Pilgrim:** cloth and wood, cream and gold, a lantern, a stars-following effect.

### 2.5 Data on the DKG, geometry as kits (G2, G9)
- **Definitions are data, one Knowledge Asset each**, in an **official catalogue graph** that Keeper ships and syncs: every species, body plan, socket, component, wearable, effect, set, habitat and background.
  - Each definition is versioned (LES-004: a new version is a new asset).
  - The person's own items stay in their **kit graph**; a keeper's equipment is in its own **keeper graph**.
- **Proposed classes** (namespace `desk:`):
  - `desk:BodyPlan`, `desk:Socket` (shapeKey, mount)
  - `desk:Species` (bodyPlan, livesIn → Habitat, forbidsClass)
  - `desk:Component` (fits → shapeKey, class, rarity, kit)
  - `desk:Wearable` (mountsOn → socket kind), `desk:Effect` (moment)
  - `desk:Set` (hasPiece, bonus), `desk:Habitat`, `desk:Background`
  - `desk:Rarity`, `desk:Class`
  - `desk:Keeper` (species, equips → item, livesIn → habitat)
- **Provenance:** with PROV-O, `prov:wasAttributedTo` says who made a definition, `prov:wasRevisionOf` gives its history, and a `desk:origin` of official, personal or imported replaces today's `source` string.
  - Later, an official item can be **published to Verifiable Memory** (on chain) by the founder per item. That is the "official equipment on the blockchain" idea; it is noted here and not built.
- **Geometry kits:** data can't carry code (packs are data only, by design), so geometry comes from **parametric kits** the app ships: a limb kit, an eye kit, a fin kit, a cloth kit.
  - A definition picks a kit and its parameters: segment count, joint style, plating pattern, emissive lines.
  - New items no longer need a release; new **kits** still do, and that is the right line.
- **The window caches the catalogue**, so drawing never waits on the DKG; it refreshes from the graph in the background.

### 2.6 One compatibility rule (G4)
Every item states `requires`: body plan, shape keys, species, classes allowed, habitat, level (from rarity) and set membership. One pure function decides "can this keeper wear this here", and its one sentence explains why not ("Hydraulic forelegs fit four-legged bodies; Kofi stands on a base."). The core decides; the window asks.

---

## Part 3. Modes as knowledge contexts, and skills that grow

### 3.1 Base intelligence plus a mode layer
- **Every mode has the same base:** the engine (Claude) plus the soul (personality) plus personal memory (who you are). That is the "general degree of base intelligence".
- **A mode adds its own layer**, all data:
  - instructions (its brief, editable)
  - scope (for routing and locking: built)
  - tools (none, web, look, act: built)
  - skills (3.3)
  - resources: links and documents it should use (a Researcher's trusted sources, a System Administrator's Apple support pages, a Builder's docs)
  - working memory desk (built)

### 3.2 Modes as editable data
- A mode is a `desk:Mode` Knowledge Asset in the kit graph: id, title, scope, instructions (Markdown), tools level, skills, resources, routing examples.
- **Built-in modes** ship as defaults; editing one makes a personal version, with a "reset to Keeper's version" button.
- **The Studio's Modes tab:** pick a mode, edit or **upload its instructions (a .md file)**, add resource links, see its skills.
- **Tools stay a closed list:** a person can't grant a mode "act" by writing it into instructions. Tools are set by the control, checked in the core.

### 3.3 Skills in the open Agent Skills format
- **Format:** the open **Agent Skills** standard, a `SKILL.md` per skill with YAML frontmatter and Markdown.
  - The spec is at agentskills.io/specification; Anthropic donated it to the Linux Foundation's Agentic AI Foundation on 22 Oct 2026, and it is used across 70+ tools.
  - Use **only the six standard fields** (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`), so skills move between Keeper, Claude Code and any marketplace.
  - Keeper's own data goes in `metadata`: `keeper.modes`, `keeper.domain`, `keeper.status` (draft/approved), `keeper.version`, `keeper.source-run`, `keeper.sha256`, `keeper.risk` (read-only / runs-commands).
- **Loading needs no extra machinery:** the engine reads each skill's name and description (about 100 tokens each) and loads the body only when it matches. This is "progressive disclosure", and Claude Code already does it.
  - Keeper exports each mode's **approved** skills into that mode's skills folder, so in a mode the engine sees only that mode's skills.
- **On the DKG:** one Knowledge Asset per skill **version**:
  - typed `pko:Procedure` (the Procedural Knowledge Ontology, ESWC 2025, built on PROV-O and P-Plan) and `schema:HowTo`
  - with the SKILL.md text, mode and domain, content hash, `prov:wasDerivedFrom` (the run it was learned from) and `prov:wasRevisionOf`
  - and the **approval keyed to the hash it approved** (LES-010)

  The graph is the truth; the folder on disk is a cache, and a file whose hash doesn't match is never used.

### 3.4 The learning loop (self-improving, safely)
Modelled on Letta's skill learning (reflect, then write a skill, with background consolidation) and gated like EvoSkill and Voyager (keep only what verifies). One 2026 result matters: **skills an agent writes before doing the work barely help** (SkillEvolBench). So Keeper learns only from **finished, checked** work.

1. **Notice:** a task in a mode finishes and was checked: exit codes are clean, and the person confirmed it worked or the result can be seen.
2. **Reflect:** a background Haiku pass writes what worked, the pitfalls, and how success was checked.
3. **Draft:** the reflection becomes a SKILL.md draft. It updates an existing skill in small edits if one is close (the ACE method), rather than adding a near-duplicate. The mode and domain are tagged automatically (for example `system` / `macos.storage`).
4. **Verify:** the skill's own check steps are re-run read-only where possible.
5. **Approve:**
   - A person approves **every skill that runs commands and every new skill**, in the Studio's Skills tab, seeing the full text.
   - Read-only reference skills could auto-approve after a few successful uses. The threshold is a founder decision.
6. **Use:** approved skills load in that mode next time, and the keeper's domain knowledge grows. The Studio shows each mode's skills by domain, as a growing skill tree.

### 3.5 Routing before answering (G7)
- **First, a local embedding router on every message**, with each mode's scope and examples. This follows semantic-router (MIT, local embeddings); it decides in milliseconds and is the default.
- **Then Haiku, only when the router is unsure or two modes are close.** Call the API directly, not a spawned CLI.
- **Every correction teaches the router:** a "no, this is research" becomes a new example.
- **The engine's switch flag (built) stays as the safety net.** Result: most switches cost nothing, instead of a second model call.

### 3.6 Safety for skills (documented risks)
**The risks are measured:**
- Agents follow instructions injected into skill files (SkillInject).
- Scans found malicious community skills at real rates: 157 of 98,380 in one scan, 76 of 3,984 in another.

**Rules:**
- **Where learned skills come from:** only Keeper's own checked runs, never fetched web, email or document text. Outside text is stripped of instruction-like content before reflecting.
- **Permissions:** never trust a skill's `allowed-tools` (it grants and doesn't restrict). Tools come only from the mode and the plan guard.
- **Embedded commands:** reject skills with embedded command execution (`` !`cmd` ``).
- **Scripts:** anything a skill would run goes through the existing plan approval, showing the script.
- **No personal data in skills:** a redaction pass before saving, since skills may be shared later.
- **Marketplace skills (later):** pinned by hash, scanned, installed as drafts needing approval.

---

## Part 4. The Studio after this

The tabs become: **Look** · **Body** (anatomy components per socket, hybrids) · **Inventory** · **Forge** · **Sets** · **World** (habitat and background) · **Soul** (moved in from Settings) · **Modes** (instructions, resources, skills) · **Skills** (skill tree per mode, drafts to approve) · **Habits** · **Voice** · **Level** · **Marketplace**.

To stay usable, these group into three: **Appearance** (Look, Body, Inventory, Forge, Sets, World), **Mind** (Soul, Modes, Skills, Habits, Voice) and **Progress** (Level, Marketplace).

---

## Part 5. Plan, in order

| Round | What | Why first |
|---|---|---|
| A1 | Studio **Soul** and **Modes** tabs: edit or upload mode instructions, resources, scope (modes as `desk:Mode` data with built-in defaults) | Founder ask; unlocks routing and skills |
| A2 | **Routing before answering**: local router plus a Haiku fallback; corrections become examples | Removes the 5–12 s switch cost |
| A3 | **Skills**: the Agent Skills format, a per-mode skills folder exported from the graph, a Skills tab (view, install a SKILL.md, approve) | The foundation for learning and the marketplace |
| A4 | **The learning loop**: reflect, draft, verify, approve; skill tree per mode by domain | The self-improving system |
| B1 | **Catalogue as data on the DKG** (official graph, versioned, PROV) with the one compatibility rule | Every asset feature below depends on it |
| B2 | **Anatomy sockets and components**: eye, limb and tail kits; hybrids; per-component paint zones | The main customisation ask |
| B3 | **Habitats and backgrounds**: Ocean first, with a Fish species (swimmer body plan) and ocean-only gear | Proves "species that live only in certain settings" |
| B4 | **Sets**: Guardian, Voyager and Ark Pilgrim with bonuses | Collection and fun |
| Later | Official items to Verifiable Memory (on chain); open contributions; a skills marketplace; payments | Founder decisions |

## Decisions taken with the recommended option (founder to review)
- Skills use the open Agent Skills format (six standard fields), so they work beyond Keeper.
- New skills, and any that run commands, need a person's approval; nothing that runs commands is learned silently.
- Set bonuses are looks and behaviour, never extra intelligence.
- A species' habitat limits are hard: a fish keeper lives in the ocean.
- Routing: a local embedding router first, Haiku only when it's unsure.
- **Needs the founder:** how many successful uses before a read-only skill auto-approves; the final names and looks of the three sets; whether research and lessons move to Sonnet for speed.
