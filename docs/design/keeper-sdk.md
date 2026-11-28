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
| `desktop` | `open-app`, `open-website` | Open | all |
| `files/` | `edit-file`, `show-file`; `find`: `find-files`, `show-folder`, `open-folder` (words only) | Look, Open | all |
| `core` | `recall-actions`, `ask-memory`, `switch-engine`; `what-you-know`, `tidy-memory` (words only) | Memory | all |
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
  modes that offer it (`battery`, `wifi`, `disk-space`, `list-reminders`, `upcoming` for "what's on
  tomorrow"). The turn runs it with the mind's requests: the mode's rules apply and it is recorded
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
beside the ability (`instant::whole` for no input, `instant::pattern` to read captures), and
`instant: Instant::Only(…_words)` on the ability. Engine-style JSON panels go through
`Done::showing_raw` (checked and capped by `stage::read`, like the mind's).

| Ability | Pack | Words |
|---|---|---|
| `find-files`, `show-folder`, `open-folder` | `files/find` | "find my NZCC deck", "where is my Downloads folder", "open my documents" |
| `computer-status` | `computer/look` | "how's my computer", "system status" |
| `brief`, `recent-work`, `week-review`, `start-focus`, `stop-focus` | `day/` | "brief me", "good morning", "what was I working on yesterday", "how was my week", "focus for 25 minutes" |
| `what-you-know`, `tidy-memory` | `core` | "what do you know about me", "tidy my memory" |
| `snooze` | `reminders/` | "snooze for 15 minutes" |
| `save-routine`, `list-routines`, `forget-routine` | `routines` | "save that as my Friday tidy routine", "what routines do I have" |
| `work-on-copied` | `clipboard` | "shorten what I copied", "translate my clipboard into French" (only at the Mac) |

Not an answer but turn plumbing: "run my Friday tidy" is expanded into the routine's own request
before the turn (`packs::routines::expand`, called by the assistant), so it is treated exactly like
typed words.
