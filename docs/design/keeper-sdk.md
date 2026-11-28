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
| `instant` | Whether words alone ask for it, with no mind: `Instant::No` (most), `Instant::Also(reads)` or `Instant::Only(reads)` (see "Instant answers"). |
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
| `reminders/` | `remind`, `list-reminders`, `snooze` (words only) (and the clock behind it: repeats, what came due while closed) | Memory | all |
| `calendar/` | `upcoming` (and the heads-up watch) | Personal | all |
| `day/` | `brief`, `recent-work`, `week-review`, `start-focus`, `stop-focus` (words only) | Memory to Personal | all |
| `personal` | `add-event`, `find-contact` | Personal | all |
| `desktop/` | `open-app`, `open-website` | Open | all |
| `files/` | `edit-file`, `show-file`; `find`: `find-files`, `show-folder`, `open-folder` (words only) | Look, Open | all |
| `core` | `recall-actions`, `ask-memory`, `switch-engine`, `health` (the Settings health checks as a table); `what-you-know`, `tidy-memory` (words only) | Memory, Look | all |
| `computer/look` | `battery`, `wifi`, `open-apps`, `time-in` (a city, country or IANA zone), `list-shortcuts`: macOS; `disk-space`, `computer-status` (words only): all | Look | Mac (disk, status: all) |
| `computer/open` | `show-in-finder` (home folder only), `open-settings` (a pane by its everyday name), `define-word` (the Dictionary) | Open | Mac |
| `computer/change` | `dark-mode`, `set-volume` (0-100 or mute; no sound), `keep-awake` (0-480 minutes; Keeper owns the one `caffeinate`), `screen-off`, `lock-screen`, `copy-text`, `screenshot` (silent, into Pictures/Keeper, shown as a file panel), `new-note` (Apple Notes), `run-shortcut` (only one of the person's own, by name) | Change | Mac |
| `everyday/` | `calculate` (`maths`: + - * / ^, brackets, %, sqrt), `convert` (`units`: length, weight, cooking volume, temperature, speed, area, data, time; never money) | Memory | all |
| `routines` | `save-routine`, `list-routines`, `forget-routine` (words only); `expand` | Memory | all |
| `clipboard` | `work-on-copied` (words only; the helper model works on the copied text) | Change | all |

How the computer packs are built:
- Every OS call is one `platform` function (`platform/mod.rs`), done in `status_macos.rs` (readings)
  or `controls_macos.rs` (changes), with a twin in `unsupported.rs` that answers in plain words.
- Tools run with argv only and a time limit. Scripts are fixed text built from checked values (a
  bool, a number 0-100); the person's words (a note) reach AppleScript only as `argv` items.
- Each tool's reply is read by a pure parser tested on real output (`pmset`, `system_profiler`,
  `lsappinfo`, `date`); each change's arguments are built by a pure, tested function.
- Readings that are better seen than said come with a panel: battery and Wi-Fi as tables, disk
  space as a chart, open apps and Shortcuts as lists, a screenshot as a file.
- "What's my battery", "what Wi-Fi am I on" and "how much space do I have" are instant answers
  (`Instant::Also` on the ability): the turn runs it like any request, so the mode's rules apply
  and there is one implementation.
- Modes: System Administrator has every ability; Assistant the everyday ones (all but
  `run-shortcut`); Companion and Researcher only `calculate`, `convert` (and Companion
  `time-in`). A registry test keeps every mode that does not operate the computer below `Open`.

## Instant answers

Requests that need no AI at all, answered in well under a second and still shown on the Stage,
are abilities like any other (`sdk/instant.rs`); the fast path is declared by
the abilities, not written beside them. An ability's `instant` names a matcher, `reads`, that turns
the person's whole words into the ability's input (`{}` when it needs none), or None:

- `Instant::Also(reads)`: the mind may ask for it too, and these words also run it at once, in the
  modes that offer it (every everyday ability: see the table below). The turn runs it with the mind's requests: the mode's rules apply and it is recorded
  as a `desk:Action`.
- `Instant::Only(reads)`: only these words run it, in EVERY mode (the person said exactly this),
  and the mind never hears of it: no catalogue line, no mode lists it, the Studio does not offer
  it (`registry::for_the_mind` leaves it out; a registry test keeps it so). It names no `modes`.
  Its sentence and panels are the turn's whole answer, kept with the turn rather than as a
  `desk:Action` (an answer about the keeper or the person's things, not a deed, so the brief and
  the week in review do not list themselves).

`instant::asked(said, mode)` tries every ability this system offers, in registry order, and returns
the first that matches with its input; `assistant::source` (step 1 of the chain) runs it through
`registry::run`, so the input checks, `Done`, panels and the phone rule (`Change` only at the Mac)
are the same as for the mind's requests. Matching is conservative: whole phrasings, never keywords;
anything unclear goes to the mind. Where two abilities' words could overlap, the registry order
decides (the `day` pack comes before `core`, so "Good morning! What do you know about me?" is the
brief). `sdk/instant_tests.rs` holds the table of representative phrasings and what answers each,
captured from the fast lane before it moved into the SDK.

Writing one: a `const ASKS: &str` with the whole phrasing, a `fn …_words(said) -> Option<Value>`
beside the ability, in its pack (a `words.rs` / `<area>_words.rs` file where there are several;
`instant::whole` for no input, `instant::pattern` to read captures, `instant::seconds_in` for "10
minutes" / "an hour", `instant::to_second_person` for the person's words said back), and
`instant: Instant::Also(…_words)` or `Instant::Only(…_words)` on the ability. Guard the words
with what the ability can really do: an app only when it is installed (`platform::app_installed`),
a place only when its time zone is known, a sum only when it is digits and operators that work
out, units only when both are known and of one kind. A phrasing that is unclear ("remind me at
5": morning or evening?) goes to the mind.

The built-in mind (`brain/reflex.rs`) has NO copies of these: it is conversation and memory only
(name, "remember that", statements, recall, greetings, the time here, help). Before FIX-0053 it
held its own `remind`, `open` and `switch engine` rules, which misread "show me a video…" as an
app and could not read "remind me in 10 minutes to…"; a reflex test now pins its rule list. Engine-style JSON panels go through
`Done::showing_raw` (checked and capped by `stage::read`, like the mind's).

| Ability | Pack | Words |
|---|---|---|
| `find-files`, `show-folder`, `open-folder` | `files/find` | "find my NZCC deck", "where is my Downloads folder", "open my documents" |
| `remind` (Also) | `reminders/words` | "remind me to stretch in 10 minutes", "remind me in an hour to call Maya", "remind me to pray at 5:30 pm", "remind me at 5pm to …" (a bare "at 5" or a day word goes to the mind) |
| `list-reminders` (Also) | `reminders/` | "what reminders do I have" |
| `upcoming` (Also) | `calendar/` | "what's on tomorrow" |
| `open-app`, `open-website` (Also) | `desktop/words` | "open Notes" (installed apps only; never a folder, a Settings pane or a file), "open youtube.com", "go to bbc.co.uk" |
| `battery`, `wifi`, `disk-space` (Also) | `computer/look` | "what's my battery", "what Wi-Fi am I on", "how much space do I have" |
| `time-in`, `list-shortcuts` (Also) | `computer/look_words` | "what time is it in Tokyo", "time in Paris" (known places only), "what shortcuts do I have" |
| `open-settings`, `define-word` (Also) | `computer/open_words` | "open Wi-Fi settings", "define grace", "what does serendipity mean" (one word) |
| `dark-mode`, `set-volume`, `keep-awake`, `screenshot`, `lock-screen`, `screen-off`, `new-note`, `run-shortcut` (Also; at the Mac only) | `computer/change_words` | "turn on dark mode", "switch to light mode", "set the volume to 30", "mute", "keep my Mac awake for 2 hours", "stop keeping my Mac awake", "take a screenshot", "lock my Mac", "turn off the display", "make a note: …", "note that …", "run my Morning shortcut" |
| `calculate`, `convert` (Also) | `everyday/words` | "what's 15% of 86", "what is 12 * 7", "calculate …" (digits and operators only), "convert 5 km to miles", "5 km in miles", "how many cups is 500 ml" |
| `find-video` (Also), `find-movies` (Also) | `video/words`, `video/` | "show me a video on how to tie a tie", "play a short video about volcanoes", "find my movies" |
| `switch-engine`, `health` (Also) | `core` | "switch your brain to Claude", "use Codex", "is everything working?", "run a health check" |
| `computer-status` | `computer/look` | "how's my computer", "system status" |
| `brief`, `recent-work`, `week-review`, `start-focus`, `stop-focus` | `day/` | "brief me", "good morning", "what was I working on yesterday", "how was my week", "focus for 25 minutes" |
| `what-you-know`, `tidy-memory` | `core` | "what do you know about me", "tidy my memory" |
| `snooze` | `reminders/` | "snooze for 15 minutes" |
| `save-routine`, `list-routines`, `forget-routine` | `routines` | "save that as my Friday tidy routine", "what routines do I have" |
| `work-on-copied` | `clipboard` | "shorten what I copied", "translate my clipboard into French" (only at the Mac) |

Not an answer but turn plumbing: "run my Friday tidy" is expanded into the routine's own request
before the turn (`packs::routines::expand`, called by the assistant), so it is treated exactly like
typed words.

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
| `email` | Email | An email the keeper opened in the person's own mail app (To, Subject, the words; Copy). Never sent by Keeper. Shown by `draft-email` only. |
| `file` | File | A file to open or show in Finder. |
| `draft` | Draft to save | A change to one text file, saved only by the person. |
