//! What a brain is given (`Context`) and what it must give back (`Thought`).
//! Every engine, agent CLI, local model or built-in rules, speaks this one contract.

use serde::{Deserialize, Serialize};

use crate::memory::{Fact, Turn};
use crate::skills::ActionRequest;

pub struct Context {
    pub said: String,
    pub assistant_name: String,
    /// Facts recalled from the DKG for this turn (already ranked).
    pub facts: Vec<Fact>,
    /// The last exchanges, newest first (from the DKG).
    pub recent: Vec<Turn>,
    /// Local time, written out ("Tuesday 25 November 2026, 10:42").
    pub now_local: String,
    /// May an agent engine act on this computer this turn?
    pub may_act: bool,
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
    /// Filled by agent engines from their event stream, never by the model's JSON.
    #[serde(skip_deserializing)]
    pub steps: Vec<AgentStep>,
}
