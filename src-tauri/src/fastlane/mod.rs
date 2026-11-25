//! Instant answers: requests that need no AI at all, answered in well under a second and still
//! shown on the Stage. Matching is conservative (a whole phrasing, e.g. "find MY …"), so anything
//! else goes on to the keeper's brain. What these answers do is recorded like any other turn.
//!
//! - "find my NZCC deck", "where is my resume"   Spotlight → a files panel (`pim::find_files`)
//! - "open my downloads / documents / desktop"    the folder opens
//! - "how's my computer", "system status"         CPU and memory → a chart panel
//! - "brief me", "good morning", "what's on today" the morning brief (`brief`)
//! - "what do you know about me"                   your facts → a facts panel (forget / pin)

pub mod brief;

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

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
    static FIND: OnceLock<Regex> = OnceLock::new();
    static OPEN: OnceLock<Regex> = OnceLock::new();
    static SYSTEM: OnceLock<Regex> = OnceLock::new();
    static BRIEF: OnceLock<Regex> = OnceLock::new();
    static FACTS: OnceLock<Regex> = OnceLock::new();

    if let Some(c) = re(&FIND, r"(?i)^(?:please\s+)?(?:find|locate|where(?:'s| is| are| did i (?:put|save)))\s+my\s+(.{2,80}?)\s*\??$").captures(s) {
        let query = c[1].trim_end_matches(" file").trim_end_matches(" files").to_string();
        let hits = crate::pim::find_files(&query, 8).await.ok()?;
        if hits.is_empty() {
            return Some(shown(format!("I couldn't find anything called {query} on this computer."), json!([])));
        }
        let items: Vec<_> = hits.iter().map(|h| json!({ "action": "find", "path": h.path })).collect();
        let first = &hits[0];
        return Some(shown(format!("Found {} match{}. The best one is {}.", hits.len(), if hits.len() == 1 { "" } else { "es" }, first.name), json!([{ "kind": "files", "title": format!("Looking for {query}"), "items": items }])));
    }

    if let Some(c) = re(&OPEN, r"(?i)^(?:please\s+)?open\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|music|movies|home)(?:\s+folder)?\s*\.?$").captures(s) {
        let home = dirs::home_dir()?;
        let name = c[1].to_lowercase();
        let path = if name == "home" { home } else { home.join(format!("{}{}", name[..1].to_uppercase(), &name[1..])) };
        crate::platform::open_url(&path.display().to_string()).ok()?;
        return Some(shown(format!("Opened your {name} folder."), json!([])));
    }

    if re(&SYSTEM, r"(?i)^(?:how(?:'s| is) my (?:computer|mac|system)|system status|how much (?:memory|ram|cpu)\b.*)\??$").is_match(s) {
        let load = crate::system::read();
        let words = if load.cpu > 80.0 { "working hard" } else if load.cpu > 40.0 { "fairly busy" } else { "calm" };
        return Some(shown(
            format!("Your computer is {words}: processor at {:.0}%, memory at {:.0}%.", load.cpu, load.memory),
            json!([{ "kind": "chart", "title": "Right now", "labels": ["Processor", "Memory"], "values": [load.cpu.round(), load.memory.round()], "unit": "%" }]),
        ));
    }

    if re(&BRIEF, r"(?i)^(?:brief me|morning brief|good morning|what(?:'s| is) on (?:today|my day)|catch me up)\b.*$").is_match(s) {
        return Some(brief::compose(app, memory, keeper).await);
    }

    if re(&FACTS, r"(?i)(what do you (?:know|remember) about me|what have you learned about me|show (?:me )?(?:your|my) memory)").is_match(s) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_clear_phrasings_skip_the_brain() {
        static FIND: OnceLock<Regex> = OnceLock::new();
        let find = re(&FIND, r"(?i)^(?:please\s+)?(?:find|locate|where(?:'s| is| are| did i (?:put|save)))\s+my\s+(.{2,80}?)\s*\??$");
        assert_eq!(&find.captures("Where did I save my NZCC deck?").unwrap()[1], "NZCC deck");
        assert!(find.captures("find the area of a circle").is_none(), "maths goes to the brain");
    }
}
