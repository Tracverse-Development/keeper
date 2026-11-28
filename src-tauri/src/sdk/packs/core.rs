//! The keeper itself: asking its memory graph, what it has done for the person, and which mind
//! it thinks with.

use super::super::{input, Ability, Access, Cx, Done, Effect, ALL};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "recall-actions",
        how: "{} lists what you have done for the person recently (from the DKG)",
        access: Access::Memory,
        platforms: ALL,
        run: |_, cx| Box::pin(recall_actions(cx)),
    },
    Ability {
        id: "ask-memory",
        how: "{\"question\": \"actions-recent\", \"days\": \"1\"} asks your DKG memory one catalog question (facts-all, facts-by-category+category, facts-by-mode+mode (what you learned while in a mode: assistant, system, researcher, tutor, companion), facts-recent+days, turns-recent+days, actions-recent+days, agent-steps, actions-failed, skills-used, minds-used, memory-size)",
        access: Access::Memory,
        platforms: ALL,
        run: |input, cx| Box::pin(ask_memory(input, cx)),
    },
    Ability {
        id: "switch-engine",
        how: "{\"engine\": \"claude\"} changes which engine you think with: claude, codex, gemini, hermes, ollama or reflex",
        access: Access::Memory,
        platforms: ALL,
        run: |input, _| Box::pin(async move { switch_engine(input) }),
    },
];

async fn recall_actions(cx: &Cx<'_>) -> Result<Done> {
    let (actions, _) = cx.memory.actions().await?;
    let done: Vec<String> = actions.iter().filter(|a| a.skill != "recall-actions").take(5).map(|a| a.outcome.trim_end_matches('.').to_lowercase()).collect();
    Ok(Done::answer(if done.is_empty() { "I haven't done anything for you yet. Ask me to open an app or set a reminder.".to_string() } else { format!("Recently I {}.", done.join("; then ")) }))
}

/// One catalog question, answered in a sentence from its rows (at most eight shown).
async fn ask_memory(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let id = input::text(input, "question")?;
    let args: std::collections::HashMap<String, String> = ["days", "category", "chat", "skill", "mode"]
        .iter()
        .filter_map(|k| input[*k].as_str().map(|v| (k.to_string(), v.to_string())).or_else(|| input[*k].as_i64().map(|v| (k.to_string(), v.to_string()))))
        .collect();
    let (rows, trace) = cx.memory.ask(id, &args).await?;
    if rows.is_empty() {
        return Ok(Done::answer(format!("{}: nothing in your memory graph yet.", trace.label)));
    }
    let lines: Vec<String> = rows
        .iter()
        .take(8)
        .map(|r| ["text", "outcome", "said", "title", "skill", "category", "mind", "type", "day", "name"].iter().filter_map(|k| r.get(*k)).cloned().chain(["n", "facts", "turns", "times"].iter().filter_map(|k| r.get(*k).map(|v| format!("({v})")))).collect::<Vec<_>>().join(" "))
        .collect();
    Ok(Done::answer(format!("{} ({} found): {}.", trace.label, rows.len(), lines.join("; "))))
}

/// Only engines in the catalogue; the words are said by the assistant once the switch is applied.
fn switch_engine(input: &serde_json::Value) -> Result<Done> {
    let id = input::optional(input, "engine").unwrap_or_default();
    let spec = crate::brain::engines::spec(id).ok_or_else(|| DeskError::Invalid(format!("I don't know an engine called {id}.")))?;
    Ok(Done { effect: Some(Effect::SwitchEngine(spec.id.into())), ..Done::said(format!("Switched to {}.", spec.label)) })
}
