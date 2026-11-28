//! The keeper itself: asking its memory graph, what it has done for the person, and which mind
//! it thinks with; and, only by their words, what it knows about the person (`what-you-know`)
//! and what in its memory is out of date (`tidy-memory`), each as facts to forget or pin.

use std::sync::OnceLock;

use regex::Regex;

use super::super::{input, instant, Ability, Access, Cx, Done, Effect, Instant, ALL};
use crate::kernel::{DeskError, Result};
use crate::memory::Fact;
use crate::stage::panel::FactRow;
use crate::stage::Panel;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "recall-actions",
        how: "{} lists what you have done for the person recently (from the DKG)",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "researcher", "companion"], instant: Instant::No,
        run: |_, cx| Box::pin(recall_actions(cx)),
    },
    Ability {
        id: "ask-memory",
        how: "{\"question\": \"actions-recent\", \"days\": \"1\"} asks your DKG memory one catalog question (facts-all, facts-by-category+category, facts-by-mode+mode (what you learned while in a mode: assistant, system, researcher, tutor, companion), facts-recent+days, turns-recent+days, actions-recent+days, agent-steps, actions-failed, skills-used, minds-used, memory-size)",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "researcher", "tutor", "companion"], instant: Instant::No,
        run: |input, cx| Box::pin(ask_memory(input, cx)),
    },
    Ability {
        id: "switch-engine",
        how: "{\"engine\": \"claude\"} changes which engine you think with: claude, codex, gemini, hermes, ollama or reflex",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "companion"], instant: Instant::No,
        run: |input, _| Box::pin(async move { switch_engine(input) }),
    },
    Ability {
        id: "tidy-memory",
        how: "\"tidy my memory\": the facts something newer has replaced, each with Forget beside it",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(tidy_words),
        run: |_, cx| Box::pin(tidy_memory(cx)),
    },
    Ability {
        id: "what-you-know",
        how: "\"what do you know about me\", \"show me your memory\": what the memory graph holds about the person, to forget or pin",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(know_words),
        run: |_, cx| Box::pin(what_you_know(cx)),
    },
];

/// "Tidy my memory", "clean up your memory", "what's out of date in my memory?".
const TIDY_ASKS: &str = r"(?i)^(?:please\s+)?(?:(?:tidy|clean)(?:\s+up)?\s+(?:my|your)\s+memory|what(?:'s| is)\s+out of date in\s+(?:my|your)\s+memory)\s*[?.!]?$";
/// Anywhere in what was said ("so, what do you know about me?"); the abilities before this one
/// in the registry (the brief) are tried first.
const KNOW_ASKS: &str = r"(?i)(what do you (?:know|remember) about me|what have you learned about me|show (?:me )?(?:your|my) memory)";
/// The most facts a panel lists.
const MOST_FACTS: usize = 40;
const UNREADABLE: &str = "I couldn't read your memory just now. Try again in a moment.";

fn tidy_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, TIDY_ASKS, said)
}

fn know_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, KNOW_ASKS, said)
}

fn rows(facts: &[&Fact]) -> Vec<FactRow> {
    facts.iter().take(MOST_FACTS).map(|f| FactRow { id: f.id.clone(), text: f.text.clone(), category: f.category.clone() }).collect()
}

async fn tidy_memory(cx: &Cx<'_>) -> Result<Done> {
    let Ok((facts, _)) = cx.memory.facts().await else { return Ok(Done::said(UNREADABLE)) };
    let old = rows(&crate::memory::meaning::outdated(&facts));
    if old.is_empty() {
        return Ok(Done::said("Your memory looks tidy: nothing in it has been replaced by something newer."));
    }
    let said = format!("I found {} that something newer has replaced. Forget the ones that are no longer true.", if old.len() == 1 { "1 thing".to_string() } else { format!("{} things", old.len()) });
    Ok(Done::said(said).showing(Panel::Facts { id: "outdated".into(), title: "These look out of date".into(), facts: old }))
}

async fn what_you_know(cx: &Cx<'_>) -> Result<Done> {
    let Ok((facts, _)) = cx.memory.facts().await else { return Ok(Done::said(UNREADABLE)) };
    if facts.is_empty() {
        return Ok(Done::said("I don't know anything about you yet. Tell me about yourself."));
    }
    let known = rows(&facts.iter().collect::<Vec<_>>());
    let said = format!("Here's what your memory graph holds about you: {} thing{}. Forget or pin any of them.", known.len(), if known.len() == 1 { "" } else { "s" });
    Ok(Done::said(said).showing(Panel::Facts { id: "facts".into(), title: "What I know about you".into(), facts: known }))
}

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

#[cfg(test)]
mod tests {
    #[test]
    fn tidy_memory_phrasings() {
        assert!(super::tidy_words("Tidy my memory").is_some() && super::tidy_words("please clean up your memory.").is_some() && super::tidy_words("What's out of date in my memory?").is_some());
        assert!(super::tidy_words("tidy my downloads").is_none() && super::tidy_words("clean up my memory card photos").is_none());
    }

    #[test]
    fn what_you_know_is_asked_anywhere_in_the_words() {
        assert!(super::know_words("So, what do you know about me?").is_some() && super::know_words("show me your memory").is_some());
        assert!(super::know_words("what do you know about Rome").is_none());
    }
}
