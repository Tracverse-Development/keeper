//! The names of every event the core sends to the window. One list, so the window's
//! `src/kernel/ipc.ts` and the core can never drift (`src-tauri/tests` and the TS mirror).

/// A turn's progress: recalling from the DKG, thinking, acting, remembering.
pub const ASSISTANT_PHASE: &str = "assistant://phase";
/// Something the assistant says on its own (a reminder that came due).
pub const ASSISTANT_SAYS: &str = "assistant://says";
/// The voice helper's events (ready, level, partial, final, speech-start, word, speech-end, error).
pub const VOICE_EVENT: &str = "voice://event";
/// A spoken command that passed the wake word (always-listening mode).
pub const VOICE_COMMAND: &str = "voice://command";
/// Installer progress lines (installing a node, creating the graph).
pub const SETUP_PROGRESS: &str = "setup://progress";
/// A write reached the DKG (the character pulses its memory halo).
pub const MEMORY_WRITTEN: &str = "memory://written";
/// A turn that came from the phone link (the window shows it).
pub const PHONE_TURN: &str = "phone://turn";
/// A newer version was installed; restart to use it.
pub const APP_UPDATE: &str = "app://update";
/// A turn finished (the talk window shows the reply).
pub const ASSISTANT_REPLY: &str = "assistant://reply";
