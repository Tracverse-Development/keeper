//! Skills: what the assistant can DO. Command pattern: a brain asks for an action by name
//! (`ActionRequest`), `run` validates the input and executes it, and the assistant writes the
//! outcome to the DKG as a `desk:Action` (so "what have you done?" is a query, not a log file).
//!
//! Adding a skill: one entry in `CATALOGUE` and one arm in `run`.

pub mod reminders;

use serde::{Deserialize, Serialize};

use crate::kernel::{time, DeskError, Result};
use crate::memory::{Memory, Reminder};
use crate::platform;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionRequest {
    pub skill: String,
    #[serde(default)]
    pub input: serde_json::Value,
}

/// A change a skill asks the app to make; the assistant applies it (skills never touch settings).
#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    SwitchEngine(String),
}

/// What a skill did, in words the assistant can say.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub skill: String,
    pub input: String,
    pub summary: String,
    pub succeeded: bool,
    #[serde(skip)]
    pub effect: Option<Effect>,
}

const CATALOGUE: &[(&str, &str)] = &[
    ("open-app", "{\"name\": \"Notes\"} opens a Mac app by name"),
    ("open-website", "{\"url\": \"https://umojaark.com\"} opens a website in the browser"),
    ("remind", "{\"text\": \"call Maya\", \"inSeconds\": 600} or {\"text\": \"pray\", \"atLocal\": \"17:30\"} speaks a reminder later"),
    ("add-event", "{\"title\": \"Dentist\", \"start\": \"2026-12-01T15:00:00-05:00\", \"end\": \"2026-12-01T16:00:00-05:00\"} puts an event on the person's calendar (RFC 3339 times with offset)"),
    ("find-contact", "{\"name\": \"Hannah\"} looks someone up in the person's contacts (phone numbers, emails)"),
    ("recall-actions", "{} lists what you have done for the person recently (from the DKG)"),
    ("ask-memory", "{\"question\": \"actions-recent\", \"days\": \"1\"} asks your DKG memory one catalog question (facts-all, facts-by-category+category, facts-by-mode+mode (what you learned while in a mode: assistant, system, researcher, tutor, companion), facts-recent+days, turns-recent+days, actions-recent+days, agent-steps, actions-failed, skills-used, reminders-upcoming, minds-used, memory-size)"),
    ("switch-engine", "{\"engine\": \"claude\"} changes which engine you think with: claude, codex, gemini, hermes, ollama or reflex"),
];

/// The skills a mode may use, as the engine is told them (it never hears of the others).
pub fn catalogue_for(mode: &crate::keepers::kit::roles::Role) -> String {
    let list: Vec<String> = CATALOGUE.iter().filter(|(name, _)| mode.allows(name)).map(|(name, what)| format!("- {name}: {what}")).collect();
    if list.is_empty() { "(none in this mode)".into() } else { list.join("\n") }
}

pub struct SkillEnv<'a> {
    /// Reaches the voice helper (calendar and contacts live behind it on macOS).
    pub app: &'a tauri::AppHandle,
    pub memory: &'a Memory,
    pub reminders: &'a reminders::Scheduler,
}

pub async fn run(req: &ActionRequest, env: &SkillEnv<'_>) -> Outcome {
    let input = req.input.to_string();
    if req.skill == "ask-memory" {
        let summary = ask_memory(&req.input, env).await;
        return match summary {
            Ok(s) => Outcome { skill: req.skill.clone(), input, summary: s, succeeded: true, effect: None },
            Err(e) => Outcome { skill: req.skill.clone(), input, summary: e.to_string(), succeeded: false, effect: None },
        };
    }
    if req.skill == "switch-engine" {
        return switch_engine(req, input);
    }
    let result = match req.skill.as_str() {
        "open-app" => open_app(&req.input),
        "open-website" => open_website(&req.input),
        "remind" => remind(&req.input, env).await,
        "recall-actions" => recall_actions(env).await,
        "add-event" => add_event(&req.input, env).await,
        "find-contact" => find_contact(&req.input, env).await,
        other => Err(DeskError::Invalid(format!("I don't have a skill called {other} yet."))),
    };
    match result {
        Ok(summary) => Outcome { skill: req.skill.clone(), input, summary, succeeded: true, effect: None },
        Err(e) => Outcome { skill: req.skill.clone(), input, summary: e.to_string(), succeeded: false, effect: None },
    }
}

/// One catalog question, answered in a sentence from its rows (at most eight shown).
async fn ask_memory(input: &serde_json::Value, env: &SkillEnv<'_>) -> Result<String> {
    let id = str_field(input, "question")?;
    let args: std::collections::HashMap<String, String> = ["days", "category", "chat", "skill", "mode"]
        .iter()
        .filter_map(|k| input[*k].as_str().map(|v| (k.to_string(), v.to_string())).or_else(|| input[*k].as_i64().map(|v| (k.to_string(), v.to_string()))))
        .collect();
    let (rows, trace) = env.memory.ask(id, &args).await?;
    if rows.is_empty() {
        return Ok(format!("{}: nothing in your memory graph yet.", trace.label));
    }
    let lines: Vec<String> = rows
        .iter()
        .take(8)
        .map(|r| ["text", "outcome", "said", "title", "skill", "category", "mind", "type", "day", "name"].iter().filter_map(|k| r.get(*k)).cloned().chain(["n", "facts", "turns", "times"].iter().filter_map(|k| r.get(*k).map(|v| format!("({v})")))).collect::<Vec<_>>().join(" "))
        .collect();
    Ok(format!("{} ({} found): {}.", trace.label, rows.len(), lines.join("; ")))
}

/// Only engines in the catalogue; the words are said by the assistant once the switch is applied.
fn switch_engine(req: &ActionRequest, input: String) -> Outcome {
    let id = req.input["engine"].as_str().unwrap_or_default();
    match crate::brain::engines::spec(id) {
        Some(spec) => Outcome { skill: req.skill.clone(), input, summary: format!("Switched to {}.", spec.label), succeeded: true, effect: Some(Effect::SwitchEngine(spec.id.into())) },
        None => Outcome { skill: req.skill.clone(), input, summary: format!("I don't know an engine called {id}."), succeeded: false, effect: None },
    }
}

fn str_field<'a>(input: &'a serde_json::Value, key: &str) -> Result<&'a str> {
    input[key].as_str().map(str::trim).filter(|s| !s.is_empty()).ok_or_else(|| DeskError::Invalid(format!("That needs a {key}.")))
}

/// App names are letters, digits, spaces and a little punctuation: never a path or a flag.
pub fn valid_app_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 60 && !name.starts_with('-') && name.chars().all(|c| c.is_alphanumeric() || " .&'+-".contains(c))
}

fn open_app(input: &serde_json::Value) -> Result<String> {
    let name = str_field(input, "name")?;
    if !valid_app_name(name) {
        return Err(DeskError::Invalid("That doesn't look like an app name.".into()));
    }
    platform::open_app(name)?;
    Ok(format!("Opened {name}."))
}

/// Only http(s) addresses; a bare domain gets https.
pub fn normalise_url(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.chars().any(char::is_whitespace) || raw.len() > 300 {
        return None;
    }
    let url = if raw.starts_with("http://") || raw.starts_with("https://") { raw.to_string() } else if raw.contains("://") { return None } else { format!("https://{raw}") };
    let host = url.split("://").nth(1)?.split(['/', '?', '#']).next()?;
    (host.contains('.') && host.chars().all(|c| c.is_alphanumeric() || ".-:".contains(c))).then_some(url)
}

fn open_website(input: &serde_json::Value) -> Result<String> {
    let url = normalise_url(str_field(input, "url")?).ok_or_else(|| DeskError::Invalid("That isn't a web address I can open.".into()))?;
    platform::open_url(&url)?;
    Ok(format!("Opened {url}."))
}

async fn remind(input: &serde_json::Value, env: &SkillEnv<'_>) -> Result<String> {
    let text = str_field(input, "text")?;
    let due = reminders::due_time(input, time::now()).ok_or_else(|| DeskError::Invalid("I need to know when: in some minutes, or a time like 5:30 pm.".into()))?;
    let reminder = Reminder::new(text, &time::iso(due), &time::now_iso());
    let receipt = env.memory.write(&reminder).await;
    env.reminders.schedule(reminder.clone());
    let when = due.with_timezone(&chrono::Local).format("%-I:%M %p").to_string();
    let saved = if receipt.queued { "It's saved here and will reach your memory node when it's back." } else { "It's in your memory graph." };
    Ok(format!("I'll remind you to {text} at {when}. {saved}"))
}

async fn recall_actions(env: &SkillEnv<'_>) -> Result<String> {
    let (actions, _) = env.memory.actions().await?;
    let done: Vec<String> = actions.iter().filter(|a| a.skill != "recall-actions").take(5).map(|a| a.outcome.trim_end_matches('.').to_lowercase()).collect();
    Ok(if done.is_empty() { "I haven't done anything for you yet. Ask me to open an app or set a reminder.".into() } else { format!("Recently I {}.", done.join("; then ")) })
}

fn field<'v>(input: &'v serde_json::Value, key: &str) -> Result<&'v str> {
    input.get(key).and_then(|v| v.as_str()).filter(|v| !v.trim().is_empty()).ok_or_else(|| DeskError::Invalid(format!("I need the event's {key}.")))
}

/// The calendar validates the span (RFC 3339, end after start, at most a year).
async fn add_event(input: &serde_json::Value, env: &SkillEnv<'_>) -> Result<String> {
    let event = crate::pim::create_event(env.app, field(input, "title")?, field(input, "start")?, field(input, "end")?).await?;
    Ok(format!("Added \"{}\" to your {} calendar.", event.title, event.calendar))
}

async fn find_contact(input: &serde_json::Value, env: &SkillEnv<'_>) -> Result<String> {
    let name = input.get("name").and_then(|v| v.as_str()).unwrap_or_default();
    let found = crate::pim::find_contacts(env.app, name, 3).await?;
    if found.is_empty() {
        return Ok(format!("I couldn't find {name} in your contacts."));
    }
    Ok(found.iter().map(|c| format!("{}: {}", c.name, c.phones.iter().chain(&c.emails).cloned().collect::<Vec<_>>().join(", "))).collect::<Vec<_>>().join("; "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_names_cannot_be_paths_or_flags() {
        assert!(valid_app_name("Notes"));
        assert!(valid_app_name("Visual Studio Code"));
        assert!(!valid_app_name("-a Terminal"));
        assert!(!valid_app_name("/System/Applications/Terminal.app"));
        assert!(!valid_app_name("Notes; rm -rf ~"));
    }

    #[test]
    fn only_web_addresses_open() {
        assert_eq!(normalise_url("umojaark.com").as_deref(), Some("https://umojaark.com"));
        assert_eq!(normalise_url("http://localhost.test/a").as_deref(), Some("http://localhost.test/a"));
        assert_eq!(normalise_url("file:///etc/passwd"), None);
        assert_eq!(normalise_url("javascript:alert(1)"), None);
        assert_eq!(normalise_url("not a url"), None);
    }
}
