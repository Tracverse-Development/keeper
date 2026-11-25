# Architecture

Umoja Desk is a Tauri 2 app: a Rust core (`src-tauri/src/`), a React window (`src/`) and a small
Swift helper for the voice (`native/voice/`). Its memory is the person's own OriginTrail DKG V10
node: every fact, conversation, action and reminder is a Knowledge Asset in a private Context Graph,
and every recall is a bounded SPARQL query. There is no other database.

```
 person ──speech──▶ umoja-voice (on-device recogniser) ──▶ voice ──▶ window ──▶ assistant::turn
                                                                          │
                     ┌──────────── recall (SPARQL, working memory) ◀──────┤
 DKG node ◀──────────┤                                                    ├──▶ brain (Ollama │ Hermes │ Reflex)
 (127.0.0.1)         └──────────── remember (Knowledge Assets) ◀──────────┤
                                                                          └──▶ skills (open, remind, recall-actions)
```

## Rust core (`src-tauri/src/`)

| Module | Owns | Entry |
|---|---|---|
| `kernel/` | Shared infrastructure owned by no feature: `error` (one error type, sentences only), `paths` (the app's folder, 0600 atomic writes), `settings` (the person's choices; missing fields keep defaults), `time` (RFC 3339 UTC), `slug` (stable hashes for KA names), `events` (every event name the window hears). | `kernel::*` |
| `dkg/` | The DKG seam: every call to the node. `client` (HTTP: status, context graph, Knowledge Asset write, SPARQL by layer), `node` (find / install / start a node; token and port from its home folder), `quads` (Builder: record → quads), `literal` (RDF literal encode/decode), `ontology` (`desk:` vocabulary over schema.org + PROV-O). | `dkg::DkgClient`, `dkg::AssetBuilder` |
| `memory/` | Facade over `dkg` for what the assistant remembers: `records` (Fact, Turn, ActionRecord, Reminder, Retraction; each knows its KA name and quads), `queries` (every SPARQL query, bounded, one class each), `rank` (which facts matter for what was said, in Rust), `outbox` (writes the node could not take wait here and retry). | `memory::Memory` |
| `brain/` | Strategy: who thinks. `engines/` = the catalogue of every engine and its detection (`mod.rs`), the shared CLI runner (`cli.rs`: find, run headless with a time limit, stream lines) and one adapter per engine: `claude` (Claude Code `-p`, stream-json), `codex` (`codex exec --json`), `gemini` (`gemini -p`), `hermes` (`hermes -z`, Blackbox-guarded), `ollama` (local model). Agent engines use the person's own subscriptions, driven as Foreman drives them; their tool calls come back as `AgentStep`s. `reflex` (built-in rules, Chain of Responsibility), `prompt` (the contract, acting rules), `context` (Context in, Thought out). A failed engine falls back to Reflex and the turn says so. | `brain::think` |
| `skills/` | Command pattern: what the assistant can do (`open-app`, `open-website`, `remind`, `recall-actions`, `switch-engine`), each validated at the boundary; a skill that changes the app returns an `Effect` the assistant applies; `reminders` (the clock; reminders reload from the DKG at launch). | `skills::run` |
| `voice/` | Bridge to the `umoja-voice` helper (JSON lines over stdin/stdout); `wake` (wake-word State machine); `eleven` (ElevenLabs text to speech, key from the Keychain; falls back to the Mac voice). | `voice::Voice` |
| `phone/` | The phone link: a LAN server (`server.rs`, token-guarded, rate-limited) and the QR pairing (`mod.rs`); `page.html` is the phone's chat page. Turns run through `assistant::run_turn`. | `phone::PhoneLink` |
| `updater/` | Auto-update from the signed GitHub releases (at launch, every 6 h, or on demand); restart into the new version. Releases: `scripts/release.sh`. | `updater::spawn_auto` |
| `platform/` | The OS seam: open apps and pages, notifications, Keychain secrets, the computer's name, the helper's path. Nothing outside it names an OS tool. `macos.rs`; `unsupported.rs` until other ports. | `platform::*` |
| `setup/` | The installer's commands: scan, install a node, create the graph (proven by read-back), probe Hermes, finish. | `setup::*` |
| `assistant/` | Mediator: one turn end to end (recall → think → act → remember), phases (including each agent tool call) sent to the window, every agent step recorded as a `desk:Action`; `change_engine` (save, record on the DKG, answer in character); `persona` (the assistant's own lines about itself). | `assistant::run_turn` |
| `state.rs`, `commands.rs`, `lib.rs` | Composition root: the live objects, the everyday commands, the command list. | `run()` |

Dependency rule: modules use `kernel` freely. `memory → dkg`; `brain → memory (types), skills (catalogue)`;
`skills → memory, platform`; `voice → platform`; `phone → assistant, state`; `updater → state`; `setup → dkg, brain, platform`; `assistant → memory, brain, skills`.
`kernel` never imports a module. `platform` is the only place that names an OS tool (`structure.test.ts`).

## Window (`src/`)

| Folder | Owns | Entry |
|---|---|---|
| `kernel/` | `ipc.ts` (the ONE bridge to the core: typed commands, event names mirrored from `events.rs`), `tokens.css` (Umoja Ark colours), `app.css` (base + shared parts), `Mark.tsx` (the brand mark). | `kernel/ipc.ts` |
| `character/` | The 3D character (three.js): `contract.ts` is its public interface; `index.ts` its only entry. Shared stage (scene, backdrop, halo, moods, animator) and `skins/` (Strategy: `robot` is the default, `puppy`), touch (click = poke, stroke = pat). | `character/index.ts` |
| `installer/` | The first-run installer: `InstallerScreen.tsx` (stage + stepper), `panels/` (one file per step), `steps.ts` (pure decisions, tested). | `InstallerScreen` |
| `dashboard/` | The everyday screen: composition, `TopBar`, `UpdateBanner`, `mood.ts` (which mood to show), `touch-lines.ts` (what it says when poked or patted); both pure and tested. | `Dashboard` |
| `conversation/` | `useAssistant` (turns and phases), `ConversationDock`, `DkgTrail` (the queries and writes behind an answer). | `ConversationDock` |
| `voice/` | `useVoice` (level, transcript, speaking, mouth). | `useVoice` |
| `memory/` | `MemoryDrawer` (what the graph holds; forget). | `MemoryDrawer` |
| `settings/` | `SettingsSheet` and its sections: `EnginePicker` (shared with the installer), `LookSection`, `VoiceSection` (Mac voice or ElevenLabs), `PhoneSection` (QR), `UpdatesSection`. | `SettingsSheet` |

## Native (`native/voice/`)

`main.swift`: on-device speech recognition (`requiresOnDeviceRecognition`) and system voices; its
`Info.plist` is linked into the binary. Built by `scripts/build-voice-helper.sh` into the Tauri sidecar
`src-tauri/binaries/umoja-voice-<triple>`.

## Guards

- `src/structure.test.ts`: this file lists every module that exists on disk (manifest), the kernel imports no
  module and only `platform/` runs OS tools (boundaries), no source file over 400 lines (size).
- `src/kernel/events.test.ts`: the window's event names equal the core's.
- `memory::queries` tests: every query is bounded, names a class, and never joins across assets (LES-001).
