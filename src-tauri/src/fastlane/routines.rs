//! Routines by word (`memory::routines`): after the keeper did something, "save that as my
//! Friday tidy routine" keeps the request under a name; "run my Friday tidy" gives the keeper that
//! request again (through the usual plan and approval); "what routines do I have" lists them;
//! "forget my Friday tidy routine" erases one.
//!
//! Only saving, listing and forgetting are answered here. Running is an expansion of what was
//! said (`expand`), done before the turn, so the routine's request is treated exactly like a
//! typed one.

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

use crate::brain::Thought;
use crate::kernel::time;
use crate::memory::routines::{clean_name, id_of, Routine, MOST};
use crate::memory::Memory;

/// Saving needs the word "routine" ("save that as my Friday tidy routine", "save this as a
/// routine called Friday tidy"): without it, "save that as a PDF" or "remember that as my
/// password" would be taken (review finding).
const SAVE: &str = r"(?i)^(?:please\s+)?(?:save|keep|remember)\s+(?:that|this|it)\s+as\s+(?:a\s+routine\s+(?:called|named)\s+(.{2,60}?)|(?:my|a|the)\s+(.{2,60}?)\s+routine)\s*[.!]?$";
const RUN: &str = r"(?i)^(?:please\s+)?(?:run|do|start)\s+(?:my\s+|the\s+)?(.{2,60}?)(?:\s+routine)?\s*[.!]?$";
const LIST: &str = r"(?i)^(?:please\s+)?(?:what routines do i have|(?:show|list)(?: me)? my routines|my routines)\s*[?.!]?$";
const FORGET: &str = r"(?i)^(?:please\s+)?(?:forget|delete|remove)\s+(?:my\s+|the\s+)?(.{2,60}?)\s+routine\s*[.!]?$";

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("routine pattern compiles"))
}

/// The routine name a phrase captures, cleaned (None: not usable as a name).
fn named(pattern: &'static OnceLock<Regex>, source: &str, said: &str) -> Option<String> {
    re(pattern, source).captures(said.trim()).and_then(|c| c.get(1).or_else(|| c.get(2))).and_then(|m| clean_name(m.as_str()))
}

fn words(reply: String) -> Thought {
    Thought { reply, ..Thought::default() }
}

/// A request already saved is not a thing to save again: "that" must be a real request, not
/// one of these phrases or a yes/no to a plan.
fn savable(said: &str) -> bool {
    static S: OnceLock<Regex> = OnceLock::new();
    static L: OnceLock<Regex> = OnceLock::new();
    static F: OnceLock<Regex> = OnceLock::new();
    let s = said.trim();
    !s.is_empty() && !re(&S, SAVE).is_match(s) && !re(&L, LIST).is_match(s) && !re(&F, FORGET).is_match(s) && !s.starts_with("Approved.") && !s.starts_with("I said no to that plan")
}

/// Saving, listing and forgetting routines; None when the words are about something else.
pub async fn answer(memory: &Memory, said: &str) -> Option<Thought> {
    static S: OnceLock<Regex> = OnceLock::new();
    static L: OnceLock<Regex> = OnceLock::new();
    static F: OnceLock<Regex> = OnceLock::new();
    let s = said.trim();
    if re(&L, LIST).is_match(s) {
        let Ok(list) = memory.routines().await else { return Some(words("I couldn't read your routines just now.".into())) };
        if list.is_empty() {
            return Some(words("You have no routines yet. After I do something for you, say: save that as my Friday tidy routine.".into()));
        }
        let rows: Vec<_> = list.iter().map(|r| json!([r.name, r.request])).collect();
        return Some(Thought { reply: format!("You have {} routine{}. Say \"run my {}\" to use one.", list.len(), if list.len() == 1 { "" } else { "s" }, list[0].name), panels: json!([{ "kind": "table", "title": "Your routines", "columns": ["Name", "What it asks me to do"], "rows": rows }]), ..Thought::default() });
    }
    if let Some(name) = named(&F, FORGET, s) {
        let Ok(list) = memory.routines().await else { return Some(words("I couldn't read your routines just now.".into())) };
        return Some(words(match list.iter().find(|r| r.id == id_of(&name)) {
            Some(r) => match memory.forget_routine(&r.id).await {
                Ok(()) => format!("Done. I've forgotten the {} routine.", r.name),
                Err(_) => "I couldn't forget that routine just now. Try again in a moment.".into(),
            },
            None => format!("You have no routine called {name}."),
        }));
    }
    let name = named(&S, SAVE, s)?;
    // "That" is the latest real request in this keeper's memory.
    // Hot memory first: it already holds the message just before this one, which may not have
    // reached the node yet (seen in the end-to-end smoke: "that" was one request too old).
    let turns = match crate::memory::hot::get(memory.hot_key()).map(|s| s.recent).filter(|r| !r.is_empty()) {
        Some(recent) => recent,
        None => match memory.recent_turns().await {
            Ok((turns, _)) => turns,
            Err(_) => return Some(words("I couldn't read what we just did, so I can't save it yet.".into())),
        },
    };
    let Some(last) = turns.iter().find(|t| savable(&t.said)) else { return Some(words("There's nothing to save yet. Ask me to do something first.".into())) };
    if memory.routines().await.is_ok_and(|l| l.len() >= MOST && !l.iter().any(|r| r.id == id_of(&name))) {
        return Some(words(format!("You already have {MOST} routines. Forget one first.")));
    }
    let Some(routine) = Routine::new(&name, &last.said, &time::now_iso()) else { return Some(words("That name won't work. Try a short name like Friday tidy.".into())) };
    Some(words(match memory.save_routine(&routine).await {
        Ok(()) => format!("Saved as {}. Say \"run my {}\" and I'll do this again: {}", routine.name, routine.name, routine.request),
        Err(_) => "I couldn't save that routine just now. Try again in a moment.".into(),
    }))
}

/// "run my Friday tidy" → the routine's own request, when there is a routine of that name.
/// Anything else (no such routine, the node not answering) is left exactly as it was said.
pub async fn expand(memory: &Memory, said: &str) -> Option<String> {
    static R: OnceLock<Regex> = OnceLock::new();
    let name = named(&R, RUN, said)?;
    memory.routines().await.ok()?.into_iter().find(|r| r.id == id_of(&name)).map(|r| r.request)
}

/// Which routine ability a phrasing asks for (the table test in `fastlane`).
#[cfg(test)]
pub(super) fn which(said: &str) -> Option<&'static str> {
    static L: OnceLock<Regex> = OnceLock::new();
    static F: OnceLock<Regex> = OnceLock::new();
    static S: OnceLock<Regex> = OnceLock::new();
    let s = said.trim();
    if re(&L, LIST).is_match(s) {
        return Some("list-routines");
    }
    if named(&F, FORGET, s).is_some() {
        return Some("forget-routine");
    }
    named(&S, SAVE, s).map(|_| "save-routine")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_words_for_saving_running_and_forgetting() {
        static S: OnceLock<Regex> = OnceLock::new();
        static R: OnceLock<Regex> = OnceLock::new();
        static F: OnceLock<Regex> = OnceLock::new();
        assert_eq!(named(&S, SAVE, "Save that as my Friday tidy routine").as_deref(), Some("Friday tidy"));
        assert_eq!(named(&S, SAVE, "save this as a routine called Morning Setup.").as_deref(), Some("Morning Setup"));
        assert_eq!(named(&S, SAVE, "remember that as my backup routine").as_deref(), Some("backup"));
        assert_eq!(named(&S, SAVE, "save that as a PDF"), None, "an ordinary request goes to the mind");
        assert_eq!(named(&S, SAVE, "remember that as my password"), None);
        assert_eq!(named(&S, SAVE, "keep this as a draft"), None);
        assert_eq!(named(&R, RUN, "run my Friday tidy").as_deref(), Some("Friday tidy"));
        assert_eq!(named(&R, RUN, "do the backup routine").as_deref(), Some("backup"));
        assert_eq!(named(&F, FORGET, "forget my Friday tidy routine").as_deref(), Some("Friday tidy"));
        assert_eq!(named(&F, FORGET, "forget my sister's birthday"), None, "forgetting a fact is not forgetting a routine");
        assert!(Regex::new(LIST).unwrap().is_match("What routines do I have?"));
    }

    #[test]
    fn only_a_real_request_can_be_saved() {
        assert!(savable("Tidy my Downloads folder"));
        assert!(!savable("save that as my Friday tidy routine"));
        assert!(!savable("Approved. Go ahead."));
        assert!(!savable("what routines do I have"));
        assert!(!savable("  "));
    }
}
