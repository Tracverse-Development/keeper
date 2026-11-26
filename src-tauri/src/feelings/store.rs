//! Each keeper's feelings, held in the app (like hot memory): created from its soul's baseline on
//! first use, updated by messages and outcomes, read by the Studio and the turn's prompt.

use std::collections::HashMap;
use std::sync::Mutex;

use super::appraise::appraise;
use super::engine::{baseline, Event, Feelings, FeelingsView};
use crate::keepers::kit::souls::Soul;

static FEELINGS: Mutex<Option<HashMap<String, Feelings>>> = Mutex::new(None);

fn now() -> f64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0)
}

fn hour() -> u32 {
    use chrono::Timelike;
    chrono::Local::now().hour()
}

fn with<T>(keeper: &str, soul: &Soul, f: impl FnOnce(&mut Feelings) -> T) -> Option<T> {
    let mut map = FEELINGS.lock().ok()?;
    let entry = map.get_or_insert_with(HashMap::new).entry(keeper.to_string()).or_insert_with(|| Feelings::new(baseline(soul.humor, soul.formality), now()));
    // The soul may have changed since: the mood keeps drifting toward the soul's baseline now.
    entry.baseline = baseline(soul.humor, soul.formality);
    Some(f(entry))
}

/// A message arrived: appraise it, update the keeper's feelings, and return the turn's mood block.
pub fn on_message(keeper: &str, soul: &Soul, said: &str) -> Option<String> {
    let (t, h) = (now(), hour());
    with(keeper, soul, |f| {
        for a in appraise(said) {
            f.event(Event::Message(a), t, h);
        }
        f.prompt_block(t, h)
    })?
}

/// What the keeper did came out well or not.
pub fn on_outcome(keeper: &str, soul: &Soul, succeeded: bool) {
    let (t, h) = (now(), hour());
    with(keeper, soul, |f| f.event(if succeeded { Event::TaskDone } else { Event::TaskFailed }, t, h));
}

pub fn view(keeper: &str, soul: &Soul) -> Option<FeelingsView> {
    let (t, h) = (now(), hour());
    with(keeper, soul, |f| f.view(t, h))
}

/// Back to the soul's baseline, no emotions, no causes.
pub fn reset(keeper: &str) {
    if let Ok(mut map) = FEELINGS.lock() {
        map.get_or_insert_with(HashMap::new).remove(keeper);
    }
}
