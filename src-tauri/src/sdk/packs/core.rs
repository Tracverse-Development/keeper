//! The keeper itself: asking its memory graph, what it has done for the person, which mind it
//! thinks with ("switch your brain to Claude" also runs `switch-engine` with no mind), whether
//! everything it needs is working (`health`: the same checks as Settings, as a table); and, only
//! by their words, what it knows about the person (`what-you-know`) and what in its memory is
//! out of date (`tidy-memory`), each as facts to forget or pin.

use std::sync::OnceLock;

use regex::Regex;
use tauri::Manager;

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
        platforms: ALL, modes: &["assistant", "companion"], instant: Instant::Also(engine_words),
        run: |input, _| Box::pin(async move { switch_engine(input) }),
    },
    Ability {
        id: "health",
        how: "{} runs every health check now (memory node, memory, mind, voice, calendar, spending) and shows what each found, problems first",
        access: Access::Look,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(health_words),
        run: |_, cx| Box::pin(health(cx)),
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
/// "Switch your brain to Claude", "use Codex", "change your engine to the local model".
const ENGINE_ASKS: &str = r"(?i)^(?:please\s+)?(?:switch|change|set|swap|use|think with)\s+(?:your\s+)?(?:brain|engine|mind|model)?\s*(?:to|with)?\s*(?:the\s+)?(claude(?: code)?|codex|gemini|hermes|ollama|local model|local|built-in(?: mind)?|builtin|reflex)\s*[.!]?$";
/// "Is everything working?", "run a health check", "is anything broken?".
const HEALTH_ASKS: &str = r"(?i)^(?:please\s+)?(?:is everything (?:working|ok|okay|alright|all right)|(?:run|do) a (?:health )?check(?:[- ]?up)?|health check|is anything (?:broken|wrong)|check (?:that )?everything(?: is)? working)\s*[?.!]?$";
/// The most facts a panel lists.
const MOST_FACTS: usize = 40;
const UNREADABLE: &str = "I couldn't read your memory just now. Try again in a moment.";

fn tidy_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, TIDY_ASKS, said)
}

/// `{"engine"}` for "switch your brain to Claude" (a whole phrasing: "use Claude to write my
/// essay" is for the mind).
fn engine_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, ENGINE_ASKS).captures(said.trim())?;
    let engine = match c[1].to_lowercase().as_str() {
        s if s.starts_with("claude") => "claude",
        "codex" => "codex",
        "gemini" => "gemini",
        "hermes" => "hermes",
        "ollama" | "local model" | "local" => "ollama",
        _ => "reflex",
    };
    Some(serde_json::json!({ "engine": engine }))
}

fn health_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, HEALTH_ASKS, said)
}

/// Every health check, run now (`health::all`, the list Settings shows), said in one line and
/// shown as a table, problems first.
async fn health(cx: &Cx<'_>) -> Result<Done> {
    let state = cx.app.state::<crate::state::AppState>();
    let checks = crate::health::all(cx.app, &state).await;
    Ok(Done::answer(health_sentence(&checks)).showing(health_table(&checks)))
}

/// The summary, then each problem's own words ("1 thing is not working. Voice: the voice helper is missing…").
fn health_sentence(checks: &[crate::health::Check]) -> String {
    let problems: Vec<String> = checks.iter().filter(|c| c.level != crate::health::Level::Ok).map(|c| format!("{}: {}", c.name, c.detail)).collect();
    [crate::health::summary(checks)].into_iter().chain(problems).collect::<Vec<_>>().join(" ")
}

/// Problems first, then things to know, then what is fine (the Settings list's order); a
/// problem's state cell glows.
fn health_table(checks: &[crate::health::Check]) -> Panel {
    use crate::health::Level;
    let rank = |l: Level| match l {
        Level::Bad => 0,
        Level::Warn => 1,
        Level::Ok => 2,
    };
    let mut sorted: Vec<&crate::health::Check> = checks.iter().collect();
    sorted.sort_by_key(|c| rank(c.level));
    let state = |l: Level| match l {
        Level::Ok => "Fine",
        Level::Warn => "To know",
        Level::Bad => "Not working",
    };
    let rows = sorted.iter().map(|c| vec![serde_json::Value::from(c.name), serde_json::Value::from(state(c.level)), serde_json::Value::from(c.detail.as_str())]).collect();
    let highlight = sorted.iter().enumerate().filter(|(_, c)| c.level == Level::Bad).map(|(row, _)| crate::stage::panel::Cell { row, col: 1 }).collect();
    let caption = Some("The same checks as Settings, under Health, where each fix is one button.".to_string());
    Panel::Table { id: "health".into(), title: "Is everything working?".into(), caption, columns: vec!["Check".into(), "State".into(), "What I found".into()], rows, highlight }
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
    fn the_engine_and_health_phrasings() {
        assert_eq!(super::engine_words("switch your brain to Claude Code").unwrap()["engine"], "claude");
        assert_eq!(super::engine_words("use codex").unwrap()["engine"], "codex");
        assert_eq!(super::engine_words("change your engine to the local model.").unwrap()["engine"], "ollama");
        assert!(super::engine_words("use claude to write my essay").is_none());
        assert!(super::health_words("Is everything working?").is_some() && super::health_words("run a health check").is_some());
        assert!(super::health_words("is everything working at the church").is_none());
    }

    #[test]
    fn health_is_said_and_shown_problems_first() {
        use crate::health::{Check, Level};
        let checks = vec![
            Check { id: "node", name: "Memory node", level: Level::Ok, detail: "Running.".into(), fix: None },
            Check { id: "voice", name: "Voice", level: Level::Bad, detail: "The voice helper is missing.".into(), fix: None },
        ];
        assert_eq!(super::health_sentence(&checks), "1 thing is not working. Voice: The voice helper is missing.");
        let super::Panel::Table { rows, highlight, .. } = super::health_table(&checks) else { panic!("a table") };
        assert_eq!((rows[0][0].as_str(), rows[0][1].as_str()), (Some("Voice"), Some("Not working")));
        assert_eq!(highlight, vec![crate::stage::panel::Cell { row: 0, col: 1 }]);
    }

    #[test]
    fn what_you_know_is_asked_anywhere_in_the_words() {
        assert!(super::know_words("So, what do you know about me?").is_some() && super::know_words("show me your memory").is_some());
        assert!(super::know_words("what do you know about Rome").is_none());
    }
}
