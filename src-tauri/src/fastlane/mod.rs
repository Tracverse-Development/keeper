//! Instant answers: requests that need no AI at all, answered in well under a second and still
//! shown on the Stage. Matching is conservative (a whole phrasing, e.g. "find MY …"), so anything
//! else goes on to the keeper's brain. What these answers do is recorded like any other turn.
//! (Being moved into the SDK as abilities that declare their own words: `sdk::instant`, tried
//! first by `assistant::source`.)
//!
//! - "how's my computer", "system status"         CPU and memory → a chart panel
//! - "brief me", "good morning", "what's on today" the morning brief (`brief`)
//! - "what do you know about me"                   your facts → a facts panel (forget / pin)
//! - "week in review", "how was my week"          the week from memory (`week`)
//! - "save that as my Friday tidy", "my routines" routines by name (`routines`; running one
//!   is an expansion done before the turn)
//! - "shorten what I copied"                       the clipboard's text (`clip`)
//! - "focus for 25 minutes"                        a focus session (`crate::focus`)

pub mod clip;
pub mod routines;

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;
use tauri::Manager;

use crate::brain::Thought;
use crate::kernel::settings::KeeperProfile;
use crate::memory::Memory;
use crate::stage::panel::FactRow;
use crate::stage::Panel;

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("fast-lane pattern compiles"))
}

fn shown(reply: String, panels: serde_json::Value) -> Thought {
    Thought { reply, panels, ..Thought::default() }
}

pub async fn answer(app: &tauri::AppHandle, memory: &Memory, keeper: &KeeperProfile, said: &str) -> Option<Thought> {
    let s = said.trim();
    static FACTS: OnceLock<Regex> = OnceLock::new();

    // "tidy my memory": facts a newer one has made out of date, each with Forget beside it.
    static TIDY: OnceLock<Regex> = OnceLock::new();
    if re(&TIDY, TIDY_MEMORY).is_match(s) {
        let Ok((facts, _)) = memory.facts().await else { return Some(shown("I couldn't read your memory just now. Try again in a moment.".into(), json!([]))) };
        let old: Vec<FactRow> = crate::memory::meaning::outdated(&facts).into_iter().take(40).map(|f| FactRow { id: f.id.clone(), text: f.text.clone(), category: f.category.clone() }).collect();
        if old.is_empty() {
            return Some(shown("Your memory looks tidy: nothing in it has been replaced by something newer.".into(), json!([])));
        }
        let reply = format!("I found {} that something newer has replaced. Forget the ones that are no longer true.", if old.len() == 1 { "1 thing".to_string() } else { format!("{} things", old.len()) });
        return Some(Thought { reply, core_panels: vec![Panel::Facts { id: "outdated".into(), title: "These look out of date".into(), facts: old }], ..Thought::default() });
    }

    // "snooze", "snooze for 15 minutes": the reminder that just went off comes back.
    if let Some(reply) = crate::sdk::packs::reminders::actions::snooze(&app.state::<crate::state::AppState>(), s).await {
        return Some(shown(reply, json!([])));
    }

    // "save that as my Friday tidy", "what routines do I have", "forget my … routine".
    if let Some(thought) = routines::answer(memory, s).await {
        return Some(thought);
    }

    // "shorten what I copied": the clipboard's text is worked on and put back.
    if let Some(thought) = clip::answer(app, keeper, s).await {
        return Some(thought);
    }

    if re(&FACTS, FACTS_WORDS).is_match(s) {
        let (facts, _) = memory.facts().await.ok()?;
        if facts.is_empty() {
            return Some(shown("I don't know anything about you yet. Tell me about yourself.".into(), json!([])));
        }
        let rows: Vec<FactRow> = facts.iter().take(40).map(|f| FactRow { id: f.id.clone(), text: f.text.clone(), category: f.category.clone() }).collect();
        let reply = format!("Here's what your memory graph holds about you: {} thing{}. Forget or pin any of them.", rows.len(), if rows.len() == 1 { "" } else { "s" });
        return Some(Thought { reply, core_panels: vec![Panel::Facts { id: "facts".into(), title: "What I know about you".into(), facts: rows }], ..Thought::default() });
    }
    None
}

const FACTS_WORDS: &str = r"(?i)(what do you (?:know|remember) about me|what have you learned about me|show (?:me )?(?:your|my) memory)";

/// "Tidy my memory", "clean up your memory", "what's out of date in my memory?".
const TIDY_MEMORY: &str = r"(?i)^(?:please\s+)?(?:(?:tidy|clean)(?:\s+up)?\s+(?:my|your)\s+memory|what(?:'s| is)\s+out of date in\s+(?:my|your)\s+memory)\s*[?.!]?$";

#[cfg(test)]
mod tests {
    use super::*;

    /// Which instant answer the chain gives, in the chain's own order (None: the mind answers).
    fn current(said: &str, mode: &str) -> Option<&'static str> {
        let s = said.trim();
        let m = |p: &str| Regex::new(p).unwrap().is_match(s);
        let role = crate::keepers::kit::roles::get(mode);
        // The SDK's instant abilities first (as `assistant::source` asks), then the fast lane.
        if let Some((ability, _)) = crate::sdk::instant::asked(s, &role) {
            return Some(ability.id);
        }
        if m(TIDY_MEMORY) {
            return Some("tidy-memory");
        }
        if crate::sdk::packs::reminders::actions::snooze_minutes(s).is_some() {
            return Some("snooze");
        }
        if let Some(id) = routines::which(s) {
            return Some(id);
        }
        let later: [(&str, &'static str); 2] = [(clip::ASKS, "work-on-copied"), (FACTS_WORDS, "what-you-know")];
        later.iter().find(|(p, _)| m(p)).map(|(_, id)| *id)
    }

    /// Representative phrasings and what answers them (an ability, or None: the mind), captured
    /// from the fast lane as it was before instant answers moved into the SDK.
    pub const TABLE: &[(&str, &str, Option<&str>)] = &[
        ("where is my Downloads folder", "assistant", Some("show-folder")),
        ("what's in my desktop", "assistant", Some("show-folder")),
        ("show me my photos", "assistant", Some("show-folder")),
        ("find my NZCC deck", "assistant", Some("find-files")),
        ("Where did I save my resume?", "assistant", Some("find-files")),
        ("where's my charger", "assistant", Some("find-files")),
        ("find my resume", "tutor", Some("find-files")),
        ("open my documents", "assistant", Some("open-folder")),
        ("Open the downloads folder.", "assistant", Some("open-folder")),
        ("What's my battery?", "assistant", Some("battery")),
        ("What's my battery?", "tutor", None),
        ("what wifi am I on", "assistant", Some("wifi")),
        ("how much space do I have", "assistant", Some("disk-space")),
        ("how's my computer?", "assistant", Some("computer-status")),
        ("system status", "companion", Some("computer-status")),
        ("how much memory am I using", "assistant", Some("computer-status")),
        ("Brief me", "assistant", Some("brief")),
        ("Good morning! What do you know about me?", "assistant", Some("brief")),
        ("what's on today", "tutor", Some("brief")),
        ("What reminders do I have?", "assistant", Some("list-reminders")),
        ("what reminders do I have", "tutor", Some("list-reminders")),
        ("what's on tomorrow?", "assistant", Some("upcoming")),
        ("what's on tomorrow?", "tutor", None),
        ("focus for 40 minutes", "assistant", Some("start-focus")),
        ("let's do a pomodoro", "companion", Some("start-focus")),
        ("focus for 500 minutes", "assistant", Some("start-focus")),
        ("stop the focus session", "assistant", Some("stop-focus")),
        ("tidy my memory", "assistant", Some("tidy-memory")),
        ("snooze for 10 minutes", "assistant", Some("snooze")),
        ("remind me again in 5 minutes", "assistant", Some("snooze")),
        ("what routines do I have", "assistant", Some("list-routines")),
        ("forget my Friday tidy routine", "assistant", Some("forget-routine")),
        ("save that as my Friday tidy routine", "assistant", Some("save-routine")),
        ("shorten what I copied", "assistant", Some("work-on-copied")),
        ("translate what I copied", "tutor", Some("work-on-copied")),
        ("how was my week?", "assistant", Some("week-review")),
        ("what was I working on yesterday?", "assistant", Some("recent-work")),
        ("show me my recent files", "assistant", Some("recent-work")),
        ("what do you know about me", "companion", Some("what-you-know")),
        ("show me your memory", "assistant", Some("what-you-know")),
        ("find the area of a circle", "assistant", None),
        ("why does my battery drain so fast?", "assistant", None),
        ("remind me to call Maya at 5", "assistant", None),
        ("help me focus on my essay about rivers", "assistant", None),
        ("save that as a PDF", "assistant", None),
        ("shorten this paragraph about rivers for me", "assistant", None),
        ("how was my week at the gym compared to last month", "assistant", None),
        ("what was I saying about the embolism?", "assistant", None),
        ("forget my sister's birthday", "assistant", None),
        ("run my Friday tidy", "assistant", None),
        ("open Safari", "assistant", None),
        ("tell me about the moon", "assistant", None),
    ];

    #[test]
    fn the_table_of_phrasings_is_what_the_chain_answers() {
        for (said, mode, id) in TABLE {
            assert_eq!(current(said, mode), *id, "{said:?} in {mode}");
        }
    }

    #[test]
    fn tidy_memory_phrasings() {
        static R: OnceLock<Regex> = OnceLock::new();
        let r = re(&R, TIDY_MEMORY);
        assert!(r.is_match("Tidy my memory") && r.is_match("please clean up your memory.") && r.is_match("What's out of date in my memory?"));
        assert!(!r.is_match("tidy my downloads") && !r.is_match("clean up my memory card photos"));
    }
}
