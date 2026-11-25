//! Every engine the assistant can think with, in one catalogue, and how to tell which ones
//! work on this computer right now. Agent CLIs are driven the way Foreman drives them, using
//! the person's own subscriptions (Claude, ChatGPT/Codex, Google); nothing here holds a key.

pub mod claude;
pub mod cli;
pub mod codex;
pub mod gemini;
pub mod hermes;
pub mod ollama;

use serde::Serialize;

/// Where an engine thinks, for the person's privacy choice.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Place {
    /// On this computer.
    Device,
    /// The engine's own service (the person's subscription).
    Cloud,
}

pub struct EngineSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub blurb: &'static str,
    pub place: Place,
    /// Can it act on the computer (run commands, edit files) when allowed?
    pub can_act: bool,
}

pub const CATALOGUE: &[EngineSpec] = &[
    EngineSpec { id: "claude", label: "Claude Code", blurb: "Your Claude subscription, through the Claude Code app on this Mac.", place: Place::Cloud, can_act: true },
    EngineSpec { id: "codex", label: "Codex", blurb: "Your ChatGPT subscription, through OpenAI's Codex app.", place: Place::Cloud, can_act: true },
    EngineSpec { id: "gemini", label: "Gemini CLI", blurb: "Your Google account, through the Gemini CLI.", place: Place::Cloud, can_act: true },
    EngineSpec { id: "hermes", label: "Hermes + Blackbox", blurb: "The Hermes agent, with Agent Blackbox guarding every action.", place: Place::Cloud, can_act: true },
    EngineSpec { id: "ollama", label: "Local model", blurb: "A model running on this Mac through Ollama.", place: Place::Device, can_act: false },
    EngineSpec { id: "reflex", label: "Built-in mind", blurb: "No model: memory, reminders, apps. Always available.", place: Place::Device, can_act: false },
];

pub fn spec(id: &str) -> Option<&'static EngineSpec> {
    CATALOGUE.iter().find(|e| e.id == id)
}

pub fn label(id: &str) -> &'static str {
    spec(id).map(|e| e.label).unwrap_or("Built-in mind")
}

/// An engine as the window shows it: what it is and whether it works here right now.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub id: &'static str,
    pub label: &'static str,
    pub blurb: &'static str,
    pub place: Place,
    pub can_act: bool,
    pub available: bool,
    /// Why it is not available, as a next step for the person.
    pub problem: Option<String>,
    /// Models (Ollama only).
    pub models: Vec<String>,
}

/// Is the engine usable here? Cheap checks only (program present, signed in where the CLI says).
pub async fn detect_all() -> Vec<EngineStatus> {
    let mut out = Vec::new();
    for e in CATALOGUE {
        let (problem, models) = match e.id {
            "claude" => (missing("claude", "Install Claude Code (claude.com/claude-code) and sign in."), vec![]),
            "codex" => (codex_problem().await, vec![]),
            "gemini" => (missing("gemini", "Install the Gemini CLI and sign in."), vec![]),
            "hermes" => (missing("hermes", "Install Hermes (Agent Blackbox) first."), vec![]),
            "ollama" => {
                let models = ollama::models().await;
                (models.is_empty().then(|| "Install Ollama (ollama.com) and pull a model, such as llama3.2.".to_string()), models)
            }
            _ => (None, vec![]),
        };
        out.push(EngineStatus { id: e.id, label: e.label, blurb: e.blurb, place: e.place, can_act: e.can_act, available: problem.is_none(), problem, models });
    }
    out
}

fn missing(program: &str, help: &str) -> Option<String> {
    cli::program(program).is_none().then(|| help.to_string())
}

async fn codex_problem() -> Option<String> {
    let program = cli::program("codex")?;
    let out = tokio::process::Command::new(program).args(["login", "status"]).output().await.ok()?;
    let text = String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr);
    text.contains("Not logged in").then(|| "Codex is installed but not signed in: run `codex login`.".to_string())
}
