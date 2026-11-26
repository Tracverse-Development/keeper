//! The week in review: one scene built from the keeper's own graph, no AI and nothing sent
//! anywhere: how much you talked each day, what it learned about you (forgettable right there),
//! what it did for you, the chats you had and the reminders still ahead. Asked with "week in
//! review", "how was my week" and the like.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Local, Utc};
use serde_json::json;

use crate::brain::Thought;
use crate::kernel::settings::KeeperProfile;
use crate::kernel::time;
use crate::memory::{Chat, Fact, Memory, Reminder};
use crate::stage::panel::FactRow;
use crate::stage::Panel;

const DAYS: i64 = 7;
/// How many of each thing a scene lists (the reply still counts them all).
const SHOWN: usize = 8;

/// The phrasings that mean the week in review (whole requests only; anything else is a question
/// for the mind).
pub const ASKS: &str = r"(?i)^(?:please\s+)?(?:(?:show (?:me )?)?(?:my |the |our )?week(?:ly)? (?:in )?review|review (?:my|our|the) week|how (?:was|did) (?:my|our|the) week(?: go)?|what did we do (?:this|last) week|(?:my|our) week)\s*[?.!]?$";

/// One thing the keeper did, as the review shows it.
pub struct Done {
    pub at: String,
    pub what: String,
}

/// Everything the review is built from (already read from the graph).
pub struct Week {
    pub facts: Vec<Fact>,
    /// When each turn of the week happened.
    pub turns: Vec<String>,
    pub done: Vec<Done>,
    pub chats: Vec<Chat>,
    pub reminders: Vec<Reminder>,
}

fn local(iso: &str) -> Option<DateTime<Local>> {
    time::parse_iso(iso).map(|t| t.with_timezone(&Local))
}

fn count(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

/// Turns per day for the last seven days, oldest first, every day present (a quiet day is 0).
fn per_day(turns: &[String], today: DateTime<Local>) -> (Vec<String>, Vec<f64>) {
    let mut by_day: HashMap<String, f64> = HashMap::new();
    for at in turns {
        if let Some(t) = local(at) {
            *by_day.entry(t.format("%Y-%m-%d").to_string()).or_default() += 1.0;
        }
    }
    (0..DAYS).rev().map(|back| today - Duration::days(back)).map(|day| (day.format("%a").to_string(), by_day.get(&day.format("%Y-%m-%d").to_string()).copied().unwrap_or(0.0))).unzip()
}

/// The spoken summary and the scene. Pure: `now` is passed in.
pub fn review(week: &Week, keeper_name: &str, now: DateTime<Utc>) -> Thought {
    let today = now.with_timezone(&Local);
    if week.turns.is_empty() && week.facts.is_empty() && week.done.is_empty() {
        return Thought { reply: "It was a quiet week: we didn't talk, so there is nothing to review yet.".into(), ..Thought::default() };
    }
    let mut panels = Vec::new();
    let (labels, values) = per_day(&week.turns, today);
    panels.push(json!({ "kind": "chart", "title": "How much we talked each day", "labels": labels, "values": values, "unit": "messages" }));
    if !week.chats.is_empty() {
        let events: Vec<_> = week.chats.iter().take(SHOWN).map(|c| json!({ "when": local(&c.at).map(|t| t.format("%a").to_string()).unwrap_or_default(), "title": c.title })).collect();
        panels.push(json!({ "kind": "timeline", "title": "What we talked about", "events": events }));
    }
    if !week.done.is_empty() {
        let events: Vec<_> = week.done.iter().take(SHOWN).map(|d| json!({ "when": local(&d.at).map(|t| t.format("%a").to_string()).unwrap_or_default(), "title": d.what })).collect();
        panels.push(json!({ "kind": "timeline", "title": format!("What {keeper_name} did for you"), "events": events }));
    }
    let ahead: Vec<_> = week.reminders.iter().take(SHOWN).map(|r| json!({ "time": local(&r.due_at).map(|t| t.format("%a %-I:%M %p").to_string()), "title": r.text, "kind": "reminder" })).collect();
    if !ahead.is_empty() {
        panels.push(json!({ "kind": "agenda", "title": "Still ahead", "items": ahead }));
    }
    // What it learned is shown as facts, so anything wrong can be forgotten on the spot.
    let learned: Vec<FactRow> = week.facts.iter().take(40).map(|f| FactRow { id: f.id.clone(), text: f.text.clone(), category: f.category.clone() }).collect();
    let core_panels = if learned.is_empty() { vec![] } else { vec![Panel::Facts { id: "week-facts".into(), title: "What I learned about you this week".into(), facts: learned }] };

    let mut parts = vec![format!("This week we exchanged {} across {}.", count(week.turns.len(), "message", "messages"), count(week.chats.len().max(1), "chat", "chats"))];
    if !week.facts.is_empty() {
        parts.push(format!("I learned {} about you.", count(week.facts.len(), "new thing", "new things")));
    }
    if !week.done.is_empty() {
        parts.push(format!("I did {} for you.", count(week.done.len(), "thing", "things")));
    }
    if !week.reminders.is_empty() {
        parts.push(format!("{} still ahead.", if week.reminders.len() == 1 { "One reminder is".to_string() } else { format!("{} reminders are", week.reminders.len()) }));
    }
    Thought { reply: parts.join(" "), panels: serde_json::Value::Array(panels), core_panels, ..Thought::default() }
}

/// Read the week from the keeper's graph (bounded questions from the catalog) and compose it.
/// Fails closed: if the conversations cannot be read, it says so instead of showing an empty week.
pub async fn compose(memory: &Memory, keeper: &KeeperProfile) -> Thought {
    let now = time::now();
    let since = now - Duration::days(DAYS);
    let within = |iso: &str| time::parse_iso(iso).is_some_and(|t| t >= since);
    let args: HashMap<String, String> = [("days".to_string(), DAYS.to_string())].into_iter().collect();
    let Ok((turn_rows, _)) = memory.ask("turns-recent", &args).await else {
        return Thought { reply: "I couldn't read your memory just now, so I can't review the week. Try again in a moment.".into(), ..Thought::default() };
    };
    let turns = turn_rows.iter().filter_map(|r| r.get("at").cloned()).collect();
    let facts = memory.facts().await.map(|(f, _)| f.into_iter().filter(|f| within(&f.at)).collect()).unwrap_or_default();
    let done = memory
        .ask("actions-recent", &args)
        .await
        .map(|(rows, _)| rows.iter().filter(|r| !r.get("skill").is_some_and(|s| s.starts_with("agent:"))).filter_map(|r| Some(Done { at: r.get("at")?.clone(), what: r.get("outcome")?.clone() })).collect())
        .unwrap_or_default();
    let chats = memory.chats().await.map(|c| c.into_iter().filter(|c| within(&c.at)).collect()).unwrap_or_default();
    let reminders = memory.upcoming_reminders().await.unwrap_or_default();
    review(&Week { facts, turns, done, chats, reminders }, &keeper.name, now)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(days_ago: i64, now: DateTime<Utc>) -> String {
        time::iso(now - Duration::days(days_ago))
    }

    #[test]
    fn the_review_counts_the_week_and_shows_every_day() {
        let now = Utc::now();
        let week = Week {
            facts: vec![Fact::new("Your cat is Biscuit", "person", &at(1, now))],
            turns: vec![at(0, now), at(0, now), at(2, now)],
            done: vec![Done { at: at(1, now), what: "Opened Notes.".into() }],
            chats: vec![Chat { id: "c1".into(), title: "Planning the week".into(), at: at(2, now) }],
            reminders: vec![Reminder::new("Call Maya", &time::iso(now + Duration::days(1)), &at(0, now))],
        };
        let t = review(&week, "Trini Boi", now);
        assert_eq!(t.reply, "This week we exchanged 3 messages across 1 chat. I learned 1 new thing about you. I did 1 thing for you. One reminder is still ahead.");
        let panels = t.panels.as_array().unwrap();
        assert_eq!(panels[0]["labels"].as_array().unwrap().len(), 7, "all seven days, quiet ones too");
        assert_eq!(panels[0]["values"].as_array().unwrap().iter().map(|v| v.as_f64().unwrap()).sum::<f64>(), 3.0);
        assert_eq!(panels[2]["title"], "What Trini Boi did for you");
        assert!(matches!(&t.core_panels[0], Panel::Facts { facts, .. } if facts.len() == 1), "what it learned can be forgotten there");
    }

    #[test]
    fn a_quiet_week_says_so_and_only_whole_requests_are_the_review() {
        let t = review(&Week { facts: vec![], turns: vec![], done: vec![], chats: vec![], reminders: vec![] }, "K", Utc::now());
        assert!(t.reply.contains("quiet week") && t.panels.is_null());
        let asks = regex::Regex::new(ASKS).unwrap();
        for yes in ["week in review", "Show me my week in review", "How was my week?", "what did we do this week", "review my week", "my weekly review"] {
            assert!(asks.is_match(yes), "{yes}");
        }
        for no in ["how was my week at the gym compared to last month", "review my essay", "what did we do this week about the launch"] {
            assert!(!asks.is_match(no), "{no}");
        }
    }
}
