# Keeper modes, styles, memory and threads

Founder direction, 2026-11-25: a keeper switches modes for different work (builder, system
administrator, researcher, tutor…), and in each mode it knows only that mode's skills and keeps
that mode's working memory, so a keeper in Builder mode never thinks it is a System
Administrator. It should feel like one personal assistant that understands everything, while
each conversation stays its own train of thought. Answer styles (explainer, brief…) are a
separate choice.

## Three separate questions

| Question | Name | Examples | Chosen by |
|---|---|---|---|
| What job is it doing? | **Mode** | Assistant, System Administrator, Builder, Researcher, Tutor, Companion | per chat (a chat remembers its mode); the keeper's default for new chats |
| How should it show the answer? | **Style** | Balanced, Explainer, Brief, Chat | per keeper, any time; a mode may suggest one |
| Who is it? | **Soul** | Steady, Island Vibes, Sunny Pup | per keeper (unchanged) |

Today's "role" (System Administrator, Companion) becomes the first two modes. The "modes"
committed as answer styles become Styles; Research and Tutor move to Modes, since they change the
job and the tools, not just the look.

## A mode is a job description

Each mode is one row of data (built-ins now, mode packs later):

- **Instructions:** who it is in this job and what it must refuse ("You are this person's
  Builder: you write and change code inside the project folder they choose…").
- **Skills:** the Keeper skills it may use (remind, add-event, open-app…). A skill outside the
  mode is refused in a sentence, as roles do today.
- **Tools:** what it may touch:
  - `none`: talk only
  - `web`: search and read the web
  - `look`: read the computer without changing it
  - `act`: change the computer, under the approval plan
  - `code`: change files only inside the chosen project folder, under the approval plan
- **Style it suggests** (Researcher suggests Explainer with sources; Builder suggests Brief).
- **Memory scope:** which working memory it reads and writes (below).

| Mode | Tools | Skills | Notes |
|---|---|---|---|
| Assistant (default) | look | reminders, calendar, contacts, brief, open app/site, ask memory | the everyday personal assistant |
| System Administrator | act | all | files, folders, apps, tidying |
| Builder | code | ask memory | a project folder; git status; tests; never outside the folder |
| Researcher | web | ask memory | cites sources (the research rules) |
| Tutor | none | quiz, flashcards, ask memory | teaches by asking |
| Companion | none | reminders, ask memory | conversation, wellbeing |

## Memory: one person, many desks

- **Personal memory, shared by every mode:** who you are, your people, your preferences, what you
  told it about your life. Recalled in every mode and every chat. This is what makes it one
  assistant that knows you.
- **Mode memory, one desk per mode:** working notes of the job. For example, the Builder's
  project facts ("the Keeper repo uses Tauri 2"), the System Administrator's machine facts ("your
  screenshots go to ~/Desktop/Shots"), the Researcher's findings. A fact is written with the mode it
  came from (`desk:mode` on the Knowledge Asset), recalled first in that mode, and not recalled in
  other modes unless asked ("what did the builder learn about X?").
- **Deciding which:** the engine already sorts each new fact into a category. Identity, person,
  preference, health and schedule are personal; work facts are filed under the current mode.
- **Actions:** what it did on the computer stays recorded per mode, so the Builder's timeline
  shows code work and the System Administrator's shows file work.

## Threads: each chat is its own train of thought

- The conversation an engine sees is the CURRENT chat's last exchanges only. The bug: the last
  six turns of every chat were mixed together, so "what did I ask you here?" was answered from
  another chat.
- It still knows the rest. It gets one labelled line per other recent chat ("Elsewhere recently:
  Foreman looks blank, 7:35 PM, System Administrator"), and can open any chat's turns through
  memory when asked.
- A chat keeps the mode it was started in. Switching mode mid-chat is said out loud in the thread
  ("Switched to Builder mode"), so the history reads right.

## What the person sees

- A mode chip by the message box ("Assistant ▾"): choose a mode for this chat. Saying "switch to
  builder mode" or using ⌘K does the same. The chat list shows each chat's mode.
- A style control beside it (Balanced, Explainer, Brief, Chat).
- The Studio's Modes tab: which modes this keeper works in and its default, and each mode's skills
  and tools, read only for built-ins.

## Real-time work, shown not spoken

- While it works, the Stage plays each step as a friendly live card ("Looking in Applications for
  Foreman", "Opening report.pdf", "Editing notes.md") with an animation for the kind of step:
  - a folder opening, a search sweeping, a page turning, a file being written
  - the raw command stays available, folded under the card
- The voice never reads commands, paths or flags. It says what is happening in plain words, once
  per step at most, and only when the step takes longer than a moment.
- Messages from the plan guard are written for people ("I stopped before changing anything"),
  never with the command line in them.

## Build order

1. Threads: current-chat context plus the "elsewhere" line (bug fix). The guard: more read commands
   (ps, pgrep, lsof…), and no command text in anything spoken.
2. Styles: rename the answer modes to styles (Balanced, Explainer, Brief, Chat), with a style
   control in the window.
3. Modes replace roles: data, instructions, skills, tools (Researcher's web rules and Tutor's
   rules move here); per-chat mode; mode chip, voice switch, ⌘K; chats list shows the mode.
4. Mode memory: facts and actions tagged with their mode; recall by scope; "what did the builder
  learn" works.
5. Builder mode: a chosen project folder, code tools limited to it, under the approval plan.
6. Live work cards with animations per step kind; plain-words narration.

## Decisions taken with the recommended option (founder to review)
- One shared personal memory, plus a working memory per mode (not separate memories per mode for
  everything): it stays one assistant that knows you.
- A chat keeps its mode; the keeper's default mode applies to new chats.
- Built-in modes only for now; mode packs (shareable modes) come later, like role packs.
