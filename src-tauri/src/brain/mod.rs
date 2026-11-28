//! The brain: who thinks for a turn. A Strategy over the engines in `engines::CATALOGUE`
//! (agent CLIs, a local model, the built-in mind), all behind one contract
//! (`context::Context` in, `context::Thought` out). A chosen engine that fails falls back to
//! the built-in mind, and the turn says so (no silent failures).

pub mod context;
pub mod guard;
pub mod look_hook;
pub mod styles;
pub mod engines;
pub mod prompt;
pub mod redirect;
pub mod reflex;

use serde::Serialize;

pub use context::{AgentStep, Context, Progress, Thought};
use crate::kernel::settings::KeeperProfile;
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

/// Think with the keeper's engine and model. `progress` hears what an agent is doing as it does it.
/// When the person changes course mid-run (`engines::cli::redirect`), the engine is started
/// again with their correction and the steps already done (`redirect`), up to `redirect::MOST`
/// times; the answer then carries every step and correction of the turn.
pub async fn think(keeper: &KeeperProfile, ctx: &Context, progress: &(dyn Fn(Progress) + Sync)) -> (Thought, MindUsed) {
    let id = keeper.brain.as_str();
    let model = keeper.model.as_str();
    // Every step the runs of this turn reported, so a new run knows what was already done.
    let reported = std::sync::Mutex::new(Vec::<AgentStep>::new());
    let recording = |p: Progress| {
        if let Progress::Step(line) = &p {
            if let Ok(mut r) = reported.lock() {
                r.push(redirect::step_from(line));
            }
        }
        progress(p)
    };
    let mut corrections: Vec<String> = Vec::new();
    let mut before: Vec<AgentStep> = Vec::new();
    let mut asked = ctx.clone();
    let attempt = loop {
        let attempt = attempt(id, model, &asked, &recording).await;
        let redirected = matches!(&attempt, Some(Err(crate::kernel::DeskError::Brain(m))) if m == engines::cli::REDIRECTED);
        match redirected.then(engines::control::take_correction).flatten() {
            Some(correction) if corrections.len() < redirect::MOST => {
                progress(Progress::Redirected(correction.clone()));
                corrections.push(correction);
                before = reported.lock().map(|r| r.clone()).unwrap_or_default();
                asked = Context { said: redirect::prompt(&ctx.said, &corrections, &before), ..ctx.clone() };
            }
            _ => break attempt,
        }
    };
    let (mut thought, mind) = settle(id, model, ctx, attempt);
    thought.steps = before.into_iter().chain(thought.steps).collect();
    thought.corrections = corrections;
    (thought, mind)
}

/// One run of the keeper's engine (None: it has no engine of its own).
async fn attempt(id: &str, model: &str, ctx: &Context, progress: &(dyn Fn(Progress) + Sync)) -> Option<crate::kernel::Result<Thought>> {
    match id {
        "claude" => Some(engines::claude::think(ctx, model, progress).await),
        "codex" => Some(engines::codex::think(ctx, model, progress).await),
        "gemini" => Some(engines::gemini::think(ctx, model).await),
        "hermes" => Some(engines::hermes::think(ctx).await),
        "ollama" if !model.is_empty() => Some(engines::ollama::think(model, ctx).await),
        _ => None,
    }
}

/// The answer and the mind that gave it, from an engine's run (or the built-in mind's).
fn settle(id: &str, model: &str, ctx: &Context, attempt: Option<crate::kernel::Result<Thought>>) -> (Thought, MindUsed) {
    let builtin = |fell_back: Option<String>| MindUsed { id: "reflex".into(), label: "Built-in mind".into(), local: true, fell_back };
    match (attempt, engines::spec(id)) {
        (Some(Ok(thought)), Some(spec)) => {
            let label = match (spec.id, model) {
                ("ollama", m) => format!("{m} on this Mac"),
                (_, "") => spec.label.to_string(),
                (_, m) => format!("{} · {m}", spec.label),
            };
            (thought, MindUsed { id: spec.id.into(), label, local: spec.place == Place::Device, fell_back: None })
        }
        // The person pressed Stop (or changed course once too often): say so, never fall back.
        (Some(Err(crate::kernel::DeskError::Brain(m))), _) if m == engines::cli::STOPPED || m == engines::cli::REDIRECTED => {
            (Thought { reply: "Okay, I stopped.".into(), ..Thought::default() }, MindUsed { id: "stopped".into(), label: "Stopped".into(), local: true, fell_back: None })
        }
        (Some(Err(e)), _) => {
            crate::kernel::log::error("mind", &format!("{} did not answer: {e}", engines::label(id)));
            (reflex::think(ctx), builtin(Some(format!("{}: {e}", engines::label(id)))))
        }
        _ => (reflex::think(ctx), builtin(None)),
    }
}
