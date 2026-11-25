//! Hot memory: an in-process mirror of what recall reads for each keeper graph (live facts with
//! retractions applied, pinned fact ids, the last turns, recent practice), so a turn recalls in
//! microseconds instead of five SPARQL queries (85 ms with 7 facts, growing with the graph).
//!
//! The DKG stays the record: the mirror is LOADED from it (the first recall after start, or after
//! `MAX_AGE`) and kept in step by every write through `Memory::write` (a record that changes
//! what recall reads returns a `HotChange`, applied before the write is sent). Only Keeper
//! writes these graphs, so the mirror cannot drift from outside; the age bound is a safety net.

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::records::{Fact, Turn};

const MAX_AGE: Duration = Duration::from_secs(30 * 60);
/// The same windows as the recall queries (`queries::RECENT_TURNS`, `Memory::practice`).
pub const RECENT: usize = 6;
const PRACTICE: usize = 12;

/// What a write changes in the mirror.
pub enum HotChange {
    Fact(Fact),
    Retract(String),
    Turn(Turn),
    Pin(String),
    Practice(Fact),
}

#[derive(Clone)]
pub struct Snapshot {
    pub facts: Vec<Fact>,
    pub pinned: HashSet<String>,
    pub recent: Vec<Turn>,
    pub practice: Vec<Fact>,
}

struct Mirror {
    facts: Vec<Fact>,
    gone: HashSet<String>,
    pinned: HashSet<String>,
    recent: VecDeque<Turn>,
    practice: VecDeque<Fact>,
    loaded: Instant,
}

static HOT: Mutex<Option<HashMap<String, Mirror>>> = Mutex::new(None);

/// The mirror of `graph`, if it is loaded and fresh.
pub fn get(graph: &str) -> Option<Snapshot> {
    let pool = HOT.lock().ok()?;
    let m = pool.as_ref()?.get(graph).filter(|m| m.loaded.elapsed() < MAX_AGE)?;
    Some(Snapshot {
        facts: m.facts.iter().filter(|f| !m.gone.contains(&f.id)).cloned().collect(),
        pinned: m.pinned.clone(),
        recent: m.recent.iter().cloned().collect(),
        practice: m.practice.iter().cloned().collect(),
    })
}

/// Fill the mirror from what the DKG just answered.
pub fn load(graph: &str, snap: Snapshot) {
    let Ok(mut pool) = HOT.lock() else { return };
    let m = Mirror { facts: snap.facts, gone: HashSet::new(), pinned: snap.pinned, recent: snap.recent.into_iter().take(RECENT).collect(), practice: snap.practice.into_iter().take(PRACTICE).collect(), loaded: Instant::now() };
    pool.get_or_insert_with(HashMap::new).insert(graph.to_string(), m);
}

/// Apply one write to a loaded mirror (an unloaded graph loads fresh from the DKG next time).
pub fn apply(graph: &str, change: HotChange) {
    let Ok(mut pool) = HOT.lock() else { return };
    let Some(m) = pool.as_mut().and_then(|p| p.get_mut(graph)) else { return };
    match change {
        HotChange::Fact(f) => {
            m.facts.retain(|x| x.id != f.id);
            m.facts.insert(0, f);
        }
        HotChange::Retract(id) => {
            m.gone.insert(id);
        }
        HotChange::Turn(t) => {
            m.recent.push_front(t);
            m.recent.truncate(RECENT);
        }
        HotChange::Pin(id) => {
            m.pinned.insert(id);
        }
        HotChange::Practice(p) => {
            m.practice.push_front(p);
            m.practice.truncate(PRACTICE);
        }
    }
}

/// Forget every mirror (tests; a keeper removed).
#[cfg(test)]
pub fn clear() {
    if let Ok(mut pool) = HOT.lock() {
        *pool = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_keep_the_mirror_in_step() {
        clear();
        let g = "hot-test";
        assert!(get(g).is_none(), "nothing until loaded");
        let f = Fact::new("Your sister is Maya", "person", "2026-11-25T10:00:00Z");
        load(g, Snapshot { facts: vec![f.clone()], pinned: HashSet::new(), recent: vec![], practice: vec![] });
        apply(g, HotChange::Fact(Fact::new("You live in Springfield", "place", "2026-11-25T11:00:00Z")));
        apply(g, HotChange::Retract(f.id.clone()));
        apply(g, HotChange::Pin("abc".into()));
        let s = get(g).unwrap();
        assert_eq!(s.facts.iter().map(|f| f.text.as_str()).collect::<Vec<_>>(), ["You live in Springfield"]);
        assert!(s.pinned.contains("abc"));
        apply("unloaded", HotChange::Pin("x".into()));
        assert!(get("unloaded").is_none(), "an unloaded graph is not invented");
    }
}
