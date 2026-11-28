# The Keeper SDK

What a keeper can do is a set of **abilities**, each built to one contract (`src-tauri/src/sdk/mod.rs`).
An ability is plain data plus one function:

| Field | Meaning |
|---|---|
| `id` | The name the mind asks for (`open-app`). Unique; kebab-case; modes list abilities by it. |
| `how` | One line: an example input, then what it does. Told to the mind word for word. |
| `access` | What it touches: `Memory` < `Look` < `Personal` < `Open` < `Change`. |
| `platforms` | `ALL` or the systems it runs on (only these builds offer it). |
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
