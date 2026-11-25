//! What a brain is given (`Context`) and what it must give back (`Thought`).
//! Every engine, agent CLI, local model or built-in rules, speaks this one contract.

use serde::{Deserialize, Serialize};

use crate::memory::{Fact, Turn};
use crate::skills::ActionRequest;

pub struct Context {
    pub said: String,
    pub assistant_name: String,
    /// Who this keeper is and what it can do: its soul's brief, then its role's brief.
    pub identity: String,
    /// Facts recalled from the DKG for this turn (already ranked).
    pub facts: Vec<Fact>,
    /// The last exchanges, newest first (from the DKG).
    pub recent: Vec<Turn>,
    /// Local time, written out ("Tuesday 25 November 2026, 10:42").
    pub now_local: String,
    /// May an agent engine act on this computer this turn?
    pub may_act: bool,
    /// Show this answer visually on the Stage (panels), or in words?
    pub visual: bool,
}

/// What an engine reports while it works: a tool step it took, or a Stage panel it finished
/// writing (streamed, so it can be shown before the answer is complete).
pub enum Progress<'a> {
    Step(&'a str),
    Panel(crate::stage::Panel),
    /// The spoken reply, ready before the rest of the answer.
    Reply(String),
}

/// Something learned about the person, written in the second person ("Your sister is Maya").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Learned {
    pub text: String,
    #[serde(default = "general")]
    pub category: String,
}

fn general() -> String {
    "general".into()
}

/// One thing an agent engine did on the computer (a tool call), recorded on the DKG.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AgentStep {
    /// The engine's tool name ("Bash", "Edit", "command").
    pub tool: String,
    /// What it did, short ("ls ~/Desktop", "edited notes.md").
    pub detail: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Thought {
    pub reply: String,
    #[serde(default)]
    pub remember: Vec<Learned>,
    /// Words describing facts to retract ("my old address").
    #[serde(default)]
    pub forget: Vec<String>,
    #[serde(default)]
    pub actions: Vec<ActionRequest>,
    /// What to show on the Stage (raw from the engine; `stage::read` validates and caps it).
    #[serde(default)]
    pub panels: serde_json::Value,
    /// Filled by agent engines from their event stream, never by the model's JSON.
    #[serde(skip_deserializing)]
    pub steps: Vec<AgentStep>,
    /// The steps the engine WOULD take on the computer (asked for before acting; see
    /// `assistant::approval`). Raw from the engine; validated where it is used.
    #[serde(default)]
    pub plan: serde_json::Value,
    /// Panels only the core may show (a plan to approve, your facts); never from the model.
    #[serde(skip)]
    pub core_panels: Vec<crate::stage::Panel>,
}
