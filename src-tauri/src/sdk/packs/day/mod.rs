//! The person's day, answered instantly from the keeper's own graph and this computer, with no
//! mind (instant-only abilities: only these words run them, in every mode):
//!
//! - `brief`        "brief me", "good morning", "what's on today": the morning brief (`brief`)
//! - `recent-work`  "what was I working on yesterday", "my recent files": files changed lately
//! - `week-review`  "week in review", "how was my week": the week from memory (`week`)
//! - `start-focus`, `stop-focus`  "focus for 25 minutes", "stop the focus session" (`crate::focus`)

mod brief;
mod week;

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;
use tauri::Manager;

use super::super::{instant, Ability, Access, Cx, Done, Instant, ALL};
use crate::kernel::Result;
use crate::state::AppState;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "brief",
        how: "\"brief me\", \"good morning\": today's agenda, the files changed lately and what the keeper did, in one scene",
        access: Access::Personal,
        platforms: ALL, modes: &[], instant: Instant::Only(brief_words),
        run: |_, cx| Box::pin(async move { Ok(brief::compose(cx.app, cx.memory, &keeper_name(cx)?).await) }),
    },
    Ability {
        id: "recent-work",
        how: "\"what was I working on yesterday\", \"show me my recent files\": the files changed lately, newest first",
        access: Access::Look,
        platforms: ALL, modes: &[], instant: Instant::Only(recent_words),
        run: |input, _| Box::pin(recent_work(input)),
    },
    Ability {
        id: "week-review",
        how: "\"week in review\", \"how was my week\": the week from the keeper's graph (talk per day, what it learned and did, chats, reminders ahead)",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(week_words),
        run: |_, cx| Box::pin(async move { Ok(week::compose(cx.memory, &keeper_name(cx)?).await) }),
    },
    Ability {
        id: "start-focus",
        how: "\"focus for 25 minutes\", \"start a pomodoro\": a focus session that holds reminders until it ends",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(start_focus_words),
        run: |input, cx| Box::pin(async move { start_focus(input, cx) }),
    },
    Ability {
        id: "stop-focus",
        how: "\"stop the focus session\": ends the focus session early (held reminders come back)",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(stop_focus_words),
        run: |_, cx| Box::pin(async move { Ok(stop_focus(cx)) }),
    },
];

/// A prefix: "Good morning! What's new?" is the brief too.
const BRIEF_ASKS: &str = r"(?i)^(?:brief me|morning brief|good morning|what(?:'s| is) on (?:today|my day)|catch me up)\b.*$";
/// "What was I working on yesterday?", "what files did I change today", "my recent files" (the
/// rest of the words say since when).
const RECENT_ASKS: &str = r"(?i)^(?:please\s+)?(?:can you (?:see|tell me|show me)\s+)?(?:what (?:was i|were i|have i been|i was|i have been|i(?:.ve)? been) (?:working on|doing on (?:my|the) (?:computer|mac))|what (?:files )?did i (?:work on|change|edit)|(?:show (?:me )?)?(?:my )?recent (?:files|work))\b([^?]*)\??$";
/// The words that start a session ("focus for 40 minutes", "start a pomodoro") or end one.
const START_FOCUS_ASKS: &str = r"(?i)^(?:please\s+)?(?:(?:let(?:'s| us)|i want to|help me)\s+)?(?:start|begin|do)?\s*(?:a |my )?(?:focus(?: session| time| timer)?|pomodoro)(?:\s+(?:for|of)\s+(\d{1,3})\s*(?:min(?:ute)?s?)?)?\s*[.!]?$|^(?:please\s+)?(?:let me |help me )?focus\s+for\s+(\d{1,3})\s*(?:min(?:ute)?s?)\s*[.!]?$";
const STOP_FOCUS_ASKS: &str = r"(?i)^(?:please\s+)?(?:stop|end|cancel|finish)\s+(?:the |my |this )?(?:focus(?: session| time| timer)?|pomodoro)\s*[.!]?$";

fn brief_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, BRIEF_ASKS, said)
}

fn week_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, week::ASKS, said)
}

fn recent_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, RECENT_ASKS).captures(said)?;
    let rest = c.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
    let since = ["today", "yesterday", "week"].into_iter().find(|w| rest.contains(w)).unwrap_or("lately");
    Some(json!({ "since": since }))
}

/// The minutes asked for (absent: the default); `crate::focus::start` checks the range.
fn start_focus_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, START_FOCUS_ASKS).captures(said)?;
    let minutes = c.get(1).or_else(|| c.get(2)).and_then(|m| m.as_str().parse::<u32>().ok()).unwrap_or(crate::focus::DEFAULT_MINUTES);
    Some(json!({ "minutes": minutes }))
}

fn stop_focus_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, STOP_FOCUS_ASKS, said)
}

/// The acting keeper's name (the brief and the review say what it did).
fn keeper_name(cx: &Cx<'_>) -> Result<String> {
    Ok(cx.app.state::<AppState>().keeper_or_active(cx.keeper)?.name)
}

/// How far back "since" reaches, and the words for it.
fn span(since: &str) -> (u32, &'static str) {
    match since {
        "today" => (1, "today"),
        "yesterday" => (2, "since yesterday"),
        "week" => (7, "this week"),
        _ => (3, "lately"),
    }
}

async fn recent_work(input: &serde_json::Value) -> Result<Done> {
    let (days, when) = span(input["since"].as_str().unwrap_or("lately"));
    Ok(brief::recent_work(days, when).await)
}

fn start_focus(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let minutes = input["minutes"].as_u64().and_then(|m| u32::try_from(m).ok()).unwrap_or(crate::focus::DEFAULT_MINUTES);
    let session = crate::focus::start(cx.app, cx.keeper, minutes)?;
    Ok(Done::said(format!("Focus session started: {} minutes. I'll hold your reminders until it ends.", session.minutes)))
}

fn stop_focus(cx: &Cx<'_>) -> Done {
    Done::said(match crate::focus::stop(cx.app) {
        Some(ended) => format!("Focus session ended early, with {} of {} minutes left. Your reminders are back on.", crate::focus::minutes_left(&ended, crate::kernel::time::now()), ended.minutes),
        None => "There's no focus session running.".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recent_work_phrasings_say_since_when() {
        assert_eq!(recent_words("Can you see what I was working on yesterday?").unwrap()["since"], "yesterday");
        assert_eq!(recent_words("what files did I change today").unwrap()["since"], "today");
        assert_eq!(recent_words("show me my recent files").unwrap()["since"], "lately");
        assert!(recent_words("what was I saying about the embolism?").is_none(), "conversation goes to the mind");
        assert_eq!(span("yesterday"), (2, "since yesterday"));
    }

    #[test]
    fn the_words_that_start_and_stop_a_session() {
        let minutes = |said: &str| start_focus_words(said).map(|i| i["minutes"].as_u64().unwrap());
        assert_eq!(minutes("start a focus session"), Some(25));
        assert_eq!(minutes("Focus for 40 minutes"), Some(40));
        assert_eq!(minutes("let's do a pomodoro"), Some(25));
        assert_eq!(minutes("start a focus session for 50 min"), Some(50));
        assert_eq!(minutes("focus for 500 minutes"), Some(500), "out of range is said by focus::start, not started");
        assert_eq!(minutes("help me focus on my essay about rivers"), None, "a real question goes to the mind");
        assert_eq!(minutes("what is a pomodoro"), None);
        assert!(stop_focus_words("stop the focus session").is_some() && stop_focus_words("End my pomodoro.").is_some());
        assert!(stop_focus_words("stop").is_none());
    }

    #[test]
    fn the_brief_and_the_week_are_asked_in_whole_words() {
        assert!(brief_words("Good morning! What's new?").is_some() && brief_words("brief me").is_some());
        assert!(brief_words("give me a brief history of Rome").is_none());
        assert!(week_words("How was my week?").is_some() && week_words("review my essay").is_none());
    }
}
