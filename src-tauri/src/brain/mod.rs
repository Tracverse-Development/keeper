//! The brain: who thinks for a turn. A Strategy over the engines in `engines::CATALOGUE`
//! (agent CLIs, a local model, the built-in mind), all behind one contract
//! (`context::Context` in, `context::Thought` out). A chosen engine that fails falls back to
//! the built-in mind, and the turn says so (no silent failures).

pub mod context;
pub mod engines;
pub mod prompt;
pub mod reflex;

use serde::Serialize;

pub use context::{AgentStep, Context, Thought};
use crate::kernel::settings::Settings;
use engines::Place;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MindUsed {
    pub id: String,
    pub label: String,
    /// Did this turn stay on the computer?
    pub local: bool,
    /// Why the chosen engine was not used, when it was not.
    pub fell_back: Option<String>,
}

/// Think with the chosen engine. `progress` hears what an agent is doing as it does it.
pub async fn think(settings: &Settings, ctx: &Context, progress: &(dyn Fn(&str) + Sync)) -> (Thought, MindUsed) {
    let id = settings.brain.as_str();
    let attempt = match id {
        "claude" => Some(engines::claude::think(ctx, progress).await),
        "codex" => Some(engines::codex::think(ctx, progress).await),
        "gemini" => Some(engines::gemini::think(ctx).await),
        "hermes" => Some(engines::hermes::think(ctx).await),
        "ollama" if !settings.ollama_model.is_empty() => Some(engines::ollama::think(&settings.ollama_model, ctx).await),
        _ => None,
    };
    let builtin = |fell_back: Option<String>| MindUsed { id: "reflex".into(), label: "Built-in mind".into(), local: true, fell_back };
    match (attempt, engines::spec(id)) {
        (Some(Ok(thought)), Some(spec)) => {
            let label = if spec.id == "ollama" { format!("{} on this Mac", settings.ollama_model) } else { spec.label.to_string() };
            (thought, MindUsed { id: spec.id.into(), label, local: spec.place == Place::Device, fell_back: None })
        }
        (Some(Err(e)), _) => (reflex::think(ctx), builtin(Some(format!("{}: {e}", engines::label(id))))),
        _ => (reflex::think(ctx), builtin(None)),
    }
}
