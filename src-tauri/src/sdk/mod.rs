//! The Keeper SDK: what a keeper can DO, as abilities built to one contract.
//!
//! An [`Ability`] is plain data plus one function: its name (what the mind asks for), how to call
//! it (one line with an example input, exactly what the mind is told), what it touches
//! ([`Access`]), the systems it runs on ([`Platform`]), and `run`. Abilities come in packs
//! (`packs/`: one file or folder per area, each exporting `ABILITIES`); the [`registry`] is the
//! only place that lists the packs, and everything else (the mind's catalogue, the modes that
//! allow a skill, "What I can do", running a request) reads the registry. One source of truth:
//! adding an ability is one entry in its pack, nothing else.
//!
//! Pattern: Command (an [`ActionRequest`] names an ability; `registry::run` validates and runs it;
//! the assistant writes the [`Outcome`] to the DKG as a `desk:Action`). An ability never changes
//! the app's settings itself: it returns an [`Effect`] the assistant applies.
//!
//! Writing one:
//! ```ignore
//! Ability {
//!     id: "copy-text",
//!     how: "{\"text\": \"hello\"} puts text on the clipboard",
//!     access: Access::Change,
//!     platforms: ALL,
//!     run: |input, _cx| Box::pin(async move {
//!         let text = input::text(input, "text")?;
//!         crate::platform::clipboard_write(text).await?;
//!         Ok(Done::said("It's on your clipboard."))
//!     }),
//! }
//! ```

pub mod agenda;
pub mod input;
pub mod packs;
pub mod registry;
pub mod watch;

use std::future::Future;
use std::pin::Pin;

use serde::{Deserialize, Serialize};

use crate::kernel::Result;
use crate::memory::Memory;

pub use registry::{catalogue_for, names, run};

/// What the mind asks for: an ability by name with its input (`{"skill": "remind", "input": {…}}`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionRequest {
    pub skill: String,
    #[serde(default)]
    pub input: serde_json::Value,
}

/// A change an ability asks the app to make; the assistant applies it (abilities never touch settings).
#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    SwitchEngine(String),
}

/// What an ability did, in words the assistant can say (recorded on the DKG as a `desk:Action`).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub skill: String,
    pub input: String,
    pub summary: String,
    pub succeeded: bool,
    #[serde(skip)]
    pub effect: Option<Effect>,
    /// What it shows on the Stage (a draft, a video, an agenda), after the mind's own panels.
    #[serde(skip)]
    pub panels: Vec<crate::stage::Panel>,
    /// The summary is the answer to a question (see [`Done::answer`]).
    #[serde(skip)]
    pub answers: bool,
}

/// What a finished ability hands back: the sentence to say, the panels to show, rarely an [`Effect`].
#[derive(Debug, Clone, Default)]
pub struct Done {
    pub summary: String,
    pub effect: Option<Effect>,
    pub panels: Vec<crate::stage::Panel>,
    /// The summary answers a question the person asked (see [`Done::answer`]).
    pub answers: bool,
}

impl Done {
    /// The usual answer: one sentence, nothing to show.
    pub fn said(summary: impl Into<String>) -> Done {
        Done { summary: summary.into(), ..Done::default() }
    }

    /// The answer to a question ("what reminders do I have"): one sentence that IS the answer.
    /// The mind wrote its own reply before this ran, so it could only guess; the keeper says this
    /// sentence instead of that guess (`assistant::turn::compose_reply`).
    pub fn answer(summary: impl Into<String>) -> Done {
        Done { answers: true, ..Done::said(summary) }
    }

    /// Adds a panel to show with the sentence (`Done::said("…").showing(panel)`).
    pub fn showing(mut self, panel: crate::stage::Panel) -> Done {
        self.panels.push(panel);
        self
    }
}

/// What an ability touches, from least to most. Shown on "What I can do"; a mode or a child
/// profile can be limited by it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // `Look` and `Change` are for the packs that read or change this computer.
pub enum Access {
    /// Only the keeper's own memory graph.
    Memory,
    /// Reads this computer (files, settings, status) and changes nothing.
    Look,
    /// The person's own records: calendar, contacts.
    Personal,
    /// Opens something for the person: an app, a website.
    Open,
    /// Changes something on this computer (a setting, the clipboard, a file).
    Change,
}

/// The systems an ability runs on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Platform {
    Mac,
    Windows,
    Linux,
}

/// Every system (an ability made only of the keeper's own memory, or of `platform` calls that
/// answer in plain words where a system lacks them).
pub const ALL: &[Platform] = &[Platform::Mac, Platform::Windows, Platform::Linux];

/// The system this build runs on.
pub const fn this_platform() -> Platform {
    if cfg!(target_os = "macos") {
        Platform::Mac
    } else if cfg!(target_os = "windows") {
        Platform::Windows
    } else {
        Platform::Linux
    }
}

/// An ability's running answer.
pub type Run<'a> = Pin<Box<dyn Future<Output = Result<Done>> + Send + 'a>>;

/// One thing a keeper can do. Plain data in a pack's `ABILITIES`; see the module doc for an example.
pub struct Ability {
    /// The name the mind asks for ("open-app"). Unique across every pack (a test checks).
    pub id: &'static str,
    /// How to call it: an example input, then what it does, in one line. Told to the mind verbatim.
    pub how: &'static str,
    pub access: Access,
    pub platforms: &'static [Platform],
    /// Validates the input and does it. Errors are plain sentences the keeper can say.
    pub run: for<'a> fn(&'a serde_json::Value, &'a Cx<'a>) -> Run<'a>,
}

/// What an ability may reach while it runs.
pub struct Cx<'a> {
    /// Reaches the voice helper (calendar and contacts live behind it on macOS) and the window.
    pub app: &'a tauri::AppHandle,
    pub memory: &'a Memory,
    pub reminders: &'a packs::reminders::Scheduler,
    /// The keeper acting (a repeating reminder is written back to its memory each time).
    pub keeper: &'a str,
}
