//! Routines by word (`memory::routines`): after the keeper did something, "save that as my
//! Friday tidy routine" keeps the request under a name (`save-routine`); "what routines do I
//! have" lists them (`list-routines`); "forget my Friday tidy routine" erases one
//! (`forget-routine`). Instant-only abilities: only these words run them, in every mode.
//!
//! "Run my Friday tidy" is not an answer but an expansion of what was said ([`expand`]), done
//! by the assistant before the turn, so the routine's request is treated exactly like a typed
//! one (through the usual plan and approval).

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

use super::super::{input, instant, Ability, Access, Cx, Done, Instant, ALL};
use crate::kernel::{time, Result};
use crate::memory::routines::{clean_name, id_of, Routine, MOST};
use crate::memory::Memory;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "list-routines",
        how: "\"what routines do I have\": the person's routines, by name, as a table",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(list_words),
        run: |_, cx| Box::pin(list(cx)),
    },
    Ability {
        id: "forget-routine",
        how: "\"forget my Friday tidy routine\": erases one routine",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(forget_words),
        run: |input, cx| Box::pin(forget(input, cx)),
    },
    Ability {
        id: "save-routine",
        how: "\"save that as my Friday tidy routine\": keeps the last real request under a name",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(save_words),
        run: |input, cx| Box::pin(save(input, cx)),
    },
];

/// Saving needs the word "routine" ("save that as my Friday tidy routine", "save this as a
/// routine called Friday tidy"): without it, "save that as a PDF" or "remember that as my
/// password" would be taken (review finding).
const SAVE: &str = r"(?i)^(?:please\s+)?(?:save|keep|remember)\s+(?:that|this|it)\s+as\s+(?:a\s+routine\s+(?:called|named)\s+(.{2,60}?)|(?:my|a|the)\s+(.{2,60}?)\s+routine)\s*[.!]?$";
const RUN: &str = r"(?i)^(?:please\s+)?(?:run|do|start)\s+(?:my\s+|the\s+)?(.{2,60}?)(?:\s+routine)?\s*[.!]?$";
const LIST: &str = r"(?i)^(?:please\s+)?(?:what routines do i have|(?:show|list)(?: me)? my routines|my routines)\s*[?.!]?$";
const FORGET: &str = r"(?i)^(?:please\s+)?(?:forget|delete|remove)\s+(?:my\s+|the\s+)?(.{2,60}?)\s+routine\s*[.!]?$";

/// The routine name a phrase captures, cleaned (None: not usable as a name).
fn named(pattern: &'static OnceLock<Regex>, source: &str, said: &str) -> Option<String> {
    instant::pattern(pattern, source).captures(said.trim()).and_then(|c| c.get(1).or_else(|| c.get(2))).and_then(|m| clean_name(m.as_str()))
}

/// A request already saved is not a thing to save again: "that" must be a real request, not
/// one of these phrases or a yes/no to a plan.
fn savable(said: &str) -> bool {
    static S: OnceLock<Regex> = OnceLock::new();
    static L: OnceLock<Regex> = OnceLock::new();
    static F: OnceLock<Regex> = OnceLock::new();
    let s = said.trim();
    !s.is_empty() && !instant::pattern(&S, SAVE).is_match(s) && !instant::pattern(&L, LIST).is_match(s) && !instant::pattern(&F, FORGET).is_match(s) && !s.starts_with("Approved.") && !s.starts_with("I said no to that plan")
}

fn list_words(said: &str) -> Option<serde_json::Value> {
    static L: OnceLock<Regex> = OnceLock::new();
    instant::whole(&L, LIST, said)
}

fn forget_words(said: &str) -> Option<serde_json::Value> {
    static F: OnceLock<Regex> = OnceLock::new();
    named(&F, FORGET, said).map(|name| json!({ "name": name }))
}

fn save_words(said: &str) -> Option<serde_json::Value> {
    static S: OnceLock<Regex> = OnceLock::new();
    named(&S, SAVE, said).map(|name| json!({ "name": name }))
}

const UNREADABLE: &str = "I couldn't read your routines just now.";

async fn list(cx: &Cx<'_>) -> Result<Done> {
    let Ok(list) = cx.memory.routines().await else { return Ok(Done::said(UNREADABLE)) };
    let Some(first) = list.first() else { return Ok(Done::said("You have no routines yet. After I do something for you, say: save that as my Friday tidy routine.")) };
    let rows: Vec<_> = list.iter().map(|r| json!([r.name, r.request])).collect();
    let said = format!("You have {} routine{}. Say \"run my {}\" to use one.", list.len(), if list.len() == 1 { "" } else { "s" }, first.name);
    Ok(Done::said(said).showing_raw(json!([{ "kind": "table", "title": "Your routines", "columns": ["Name", "What it asks me to do"], "rows": rows }])))
}

async fn forget(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let name = input::text(input, "name")?;
    let Ok(list) = cx.memory.routines().await else { return Ok(Done::said(UNREADABLE)) };
    Ok(Done::said(match list.iter().find(|r| r.id == id_of(name)) {
        Some(r) => match cx.memory.forget_routine(&r.id).await {
            Ok(()) => format!("Done. I've forgotten the {} routine.", r.name),
            Err(_) => "I couldn't forget that routine just now. Try again in a moment.".into(),
        },
        None => format!("You have no routine called {name}."),
    }))
}

async fn save(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let name = input::text(input, "name")?;
    let memory = cx.memory;
    // "That" is the latest real request in this keeper's memory.
    // Hot memory first: it already holds the message just before this one, which may not have
    // reached the node yet (seen in the end-to-end smoke: "that" was one request too old).
    let turns = match crate::memory::hot::get(memory.hot_key()).map(|s| s.recent).filter(|r| !r.is_empty()) {
        Some(recent) => recent,
        None => match memory.recent_turns().await {
            Ok((turns, _)) => turns,
            Err(_) => return Ok(Done::said("I couldn't read what we just did, so I can't save it yet.")),
        },
    };
    let Some(last) = turns.iter().find(|t| savable(&t.said)) else { return Ok(Done::said("There's nothing to save yet. Ask me to do something first.")) };
    if memory.routines().await.is_ok_and(|l| l.len() >= MOST && !l.iter().any(|r| r.id == id_of(name))) {
        return Ok(Done::said(format!("You already have {MOST} routines. Forget one first.")));
    }
    let Some(routine) = Routine::new(name, &last.said, &time::now_iso()) else { return Ok(Done::said("That name won't work. Try a short name like Friday tidy.")) };
    Ok(Done::said(match memory.save_routine(&routine).await {
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
