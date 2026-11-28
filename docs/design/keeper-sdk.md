# The Keeper SDK

What a keeper can do is a set of **abilities**, each built to one contract (`src-tauri/src/sdk/mod.rs`).
An ability is plain data plus one function:

| Field | Meaning |
|---|---|
| `id` | The name the mind asks for (`open-app`). Unique; kebab-case; modes list abilities by it. |
| `how` | One line: an example input, then what it does. Told to the mind word for word. |
| `access` | What it touches: `Memory` < `Look` < `Personal` < `Open` < `Change`. |
| `platforms` | `ALL` or the systems it runs on (only these builds offer it). |
| `modes` | The built-in modes that offer it by default (`assistant`, `researcher`, `tutor`, `companion`; System Administrator offers everything). The built-in modes never list abilities themselves. |
| `run` | Checks the input (`sdk::input`) and does it; returns `Done`: a sentence, panels to show (`Done::said(…).showing(panel)`), rarely an `Effect`. An ability that answers a question returns `Done::answer(…)`: the mind wrote its reply before the ability ran, so the answer replaces that guess. |

Abilities live in **packs** (`sdk/packs/<area>`), each exporting `ABILITIES`. The **registry**
(`sdk/registry.rs`) is the one list of packs; the mind's catalogue, the modes, "What I can do"
and running a request all read it. Adding an ability is one entry in its pack. Adding a pack is
one file and one line in `PACKS`.

**Watches** (`sdk/watch.rs`) are what a keeper checks on its own: a `Watch` is an id, how often it
looks, and `tick`, which returns notices (usually none). `registry::WATCHES` lists them; one runner
per watch starts at launch, looks only after setup and never during a focus session, and says each
notice the way a due reminder is said (`watch::say`: notification, the line in the window, the
voice). First watch: the calendar heads-up (`packs/calendar/heads_up.rs`).

**Agendas** (`sdk/agenda.rs`): events and reminders become rows of one `agenda` panel in time
order; reminder rows carry their id, and the panel offers Delete for them.

Rules:
- Validate at the boundary with `sdk::input`; errors are plain sentences the keeper can say.
- Never touch settings: return an `Effect` and let the assistant apply it.
- Anything that changes the computer is `Access::Change` and goes through the person's approval.
- A change to a text file is a DRAFT (`sdk::drafts`, the `edit-file` ability): the person sees it beside the old text and only their Save writes the file (refused if the file changed meanwhile).
- Read and write the person's things on this computer only; nothing leaves it without the person asking.
- Each pack has unit tests for its input checks; `registry` tests that names are unique.

## The packs

| Pack | Abilities | Access | Systems |
|---|---|---|---|
| `reminders/` | `remind` (and the clock behind it: repeats, snooze, what came due while closed) | Memory | all |
| `personal` | `add-event`, `find-contact` | Personal | all |
| `desktop` | `open-app`, `open-website` | Open | all |
| `core` | `recall-actions`, `ask-memory`, `switch-engine` | Memory | all |
| `computer/look` | `battery`, `wifi`, `open-apps`, `time-in` (a city, country or IANA zone), `list-shortcuts`: macOS; `disk-space`: all | Look | Mac (disk: all) |
| `computer/open` | `show-in-finder` (home folder only), `open-settings` (a pane by its everyday name), `define-word` (the Dictionary) | Open | Mac |
| `computer/change` | `dark-mode`, `set-volume` (0-100 or mute; no sound), `keep-awake` (0-480 minutes; Keeper owns the one `caffeinate`), `screen-off`, `lock-screen`, `copy-text`, `screenshot` (silent, into Pictures/Keeper, shown as a file panel), `new-note` (Apple Notes), `run-shortcut` (only one of the person's own, by name) | Change | Mac |
| `everyday/` | `calculate` (`maths`: + - * / ^, brackets, %, sqrt), `convert` (`units`: length, weight, cooking volume, temperature, speed, area, data, time; never money) | Memory | all |

How the computer packs are built:
- Every OS call is one `platform` function (`platform/mod.rs`), done in `status_macos.rs` (readings)
  or `controls_macos.rs` (changes), with a twin in `unsupported.rs` that answers in plain words.
- Tools run with argv only and a time limit. Scripts are fixed text built from checked values (a
  bool, a number 0-100); the person's words (a note) reach AppleScript only as `argv` items.
- Each tool's reply is read by a pure parser tested on real output (`pmset`, `system_profiler`,
  `lsappinfo`, `date`); each change's arguments are built by a pure, tested function.
- Readings that are better seen than said come with a panel: battery and Wi-Fi as tables, disk
  space as a chart, open apps and Shortcuts as lists, a screenshot as a file.
- The instant lane (`fastlane/computer.rs`) answers "what's my battery", "what Wi-Fi am I on" and
  "how much space do I have" by NAMING the ability; the turn runs it like any request, so the
  mode's rules apply and there is one implementation.
- Modes: System Administrator has every ability; Assistant the everyday ones (all but
  `run-shortcut`); Companion and Researcher only `calculate`, `convert` (and Companion
  `time-in`). A registry test keeps every mode that does not operate the computer below `Open`.

## Panels

A **panel** is what a keeper SHOWS on the Stage inside Keeper (never a web page or a file). An
ability shows one with `Done::said(…).showing(panel)`; the mind can also put panels in its answer.
Panels are an SDK on both sides, so a new kind is a short, fixed recipe.

**Core side** (Rust, `src-tauri/src/stage/`):
- `panel.rs`: one variant of `enum Panel` (serde tag `kind`, lowercase), with `#[serde(default)] id: String` and `title: String` first.
- `cap.rs`: its arm in `Panel::cap` (clip every string and list to the limits in `panel.rs`), in `has_content` (when it is an empty card and dropped) and in `set_id`.
- `mod.rs`: its JSON shape in `RULES`, if the mind may make it itself (an ability-only panel such as `draft` stays out).
- Tests in the module: the cap and the empty-card rule.

**Window side** (TypeScript, `src/`):
- `kernel/panel-spec.ts`: one line in the `Panel` union mirroring the Rust variant (a `PanelAction` too, if the person can DO something in it).
- `stage/panels/<Kind>Panel.tsx`: the renderer, taking `PanelProps<'kind'>` (shows things; calls `onPick` with the words for the piece pointed at, made by a helper in `stage/focus.ts`) or `ActingPanelProps<'kind'>` (also reports through `onAction`). Plain text only, never HTML. Reuse the shared pieces: `stagger`, `Breadcrumbs`, `Icon`, `Celebration`.
- `stage/panels/registry.tsx`: ONE entry in `PANELS`, the window's panel SDK: `label` (the eyebrow word), `help` (one plain sentence on what the person can do with it, 20 to 70 characters), `wide` (`true`, `false`, or a rule on its content such as `(panel) => panel.cards.length > 2`) and `draw` (the renderer). `PanelBody`, `PanelCard` and `Stage` read it; nothing else changes. The mapped type makes a missing entry a type error.
- Styles in the panels css file that fits (`panels.css`, `panels-visual.css`, `panels-work.css`, `panels-draft.css`), on the card's `is-<kind>` class and the renderer's own classes, with spacing and type from `kernel/tokens.css`.

Guards: `src/structure.test.ts` (the Rust enum, `panel-spec.ts` and the registry name the same
kinds) and `src/stage/panels/registry.test.ts` (one kit per kind, a plain help line, a label and
its own renderer). Check it on the preview harness's Stage before landing.

Today's kinds (label, then what it shows):

| Kind | Label | Shows |
|---|---|---|
| `text` | Notes | Paragraphs and bullets. |
| `table` | Table | Columns and rows, cells highlightable. |
| `steps` | Step by step | Numbered steps with math lines; a walk-through on request. |
| `formula` | Formula | An expression and what each symbol means. |
| `cards` | Ideas | Idea cards with an emoji. |
| `quiz` | Quick check | One question, checked in the panel, reported. |
| `chart` | Chart | Bars with values. |
| `files` | Files | What was done to which files. |
| `diagram` | Diagram | Boxes and arrows. |
| `timeline` | Timeline | Moments in order. |
| `folder` | Folder | One folder's entries and their changes. |
| `sliders` | What if | A formula with sliders and a live result. |
| `flashcards` | Practice | Cards to turn over, known or not reported. |
| `agenda` | Agenda | Events, reminders and tasks in time order; Delete on reminders. |
| `checklist` | Checklist | Tickable items, ticks remembered. |
| `form` | Fill this in | Fields whose answers become the next message. |
| `approval` | Plan to approve | A plan of computer work; nothing runs until approved. |
| `facts` | What I know | What the keeper remembers; forget or pin. |
| `sources` | Sources | The sources a research answer cites. |
| `live` | Live | This Mac's readings, updating. |
| `media` | Watch | A video, song or picture, played only on Play. |
| `web` | Visit | A page to open in the browser. |
| `file` | File | A file to open or show in Finder. |
| `draft` | Draft to save | A change to one text file, saved only by the person. |
