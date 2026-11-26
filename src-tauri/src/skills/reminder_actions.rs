//! What happens to a reminder after it is set: it comes round again when it repeats, it can be
//! snoozed once it has fired ("snooze", "snooze for 15 minutes"), and it can be deleted from the
//! list (erased from the keeper's graph, and it will not fire).

use std::sync::OnceLock;

use chrono::Duration;
use regex::Regex;
use tauri::State;

use super::reminders::next_due;
use crate::kernel::{time, DeskError, Result};
use crate::memory::{Record, Reminder};
use crate::state::AppState;

const DEFAULT_SNOOZE: i64 = 10;
const MAX_SNOOZE: i64 = 240;

/// A repeating reminder that just fired is written for its next time, in its keeper's memory,
/// and scheduled. One that does not repeat, or whose keeper is gone, ends here.
pub async fn come_round(state: &AppState, fired: &Reminder) {
    let Some(next) = time::parse_iso(&fired.due_at).and_then(|due| next_due(due, &fired.repeat)) else { return };
    let Ok(keeper) = state.keeper_or_active(&fired.keeper) else { return };
    let Ok(memory) = state.memory_for(&keeper) else { return };
    let again = Reminder::new(&fired.text, &time::iso(next), &time::now_iso()).repeating(&fired.repeat, &keeper.id);
    memory.write(&again).await;
    state.reminders.schedule(again);
}

/// "snooze", "snooze it for 15 minutes", "remind me again in 20 minutes".
pub const SNOOZE: &str = r"(?i)^(?:please\s+)?(?:snooze(?:\s+(?:it|that))?(?:\s+(?:for\s+)?(\d{1,3})\s*(?:min(?:ute)?s?)?)?|remind me again(?:\s+in\s+(\d{1,3})\s*(?:min(?:ute)?s?))?)\s*[.!]?$";

/// The minutes a snooze asks for (absent: the default); None when out of range.
pub fn snooze_minutes(said: &str) -> Option<Option<i64>> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let c = RE.get_or_init(|| Regex::new(SNOOZE).expect("pattern")).captures(said.trim())?;
    Some(match c.get(1).or_else(|| c.get(2)) {
        Some(m) => m.as_str().parse().ok().filter(|n| (1..=MAX_SNOOZE).contains(n)),
        None => Some(DEFAULT_SNOOZE),
    })
}

/// The instant answer to a snooze: the reminder that fired last comes back in a while. None
/// when the words are about something else.
pub async fn snooze(state: &AppState, said: &str) -> Option<String> {
    let minutes = match snooze_minutes(said)? {
        Some(m) => m,
        None => return Some(format!("I can snooze for up to {MAX_SNOOZE} minutes.")),
    };
    let Some(last) = state.reminders.last_fired() else { return Some("There's no reminder to snooze: none has gone off since I started.".into()) };
    let keeper = state.keeper_or_active(&last.keeper).ok()?;
    let memory = state.memory_for(&keeper).ok()?;
    let again = Reminder::new(&last.text, &time::iso(time::now() + Duration::minutes(minutes)), &time::now_iso()).repeating("", &keeper.id);
    memory.write(&again).await;
    state.reminders.schedule(again);
    Some(format!("Snoozed. I'll remind you to {} again in {minutes} minute{}.", last.text.trim_end_matches('.'), if minutes == 1 { "" } else { "s" }))
}

/// Delete a reminder: it is erased from the keeper's graph and will not fire.
#[tauri::command]
pub async fn reminder_cancel(state: State<'_, AppState>, keeper: Option<String>, id: String) -> Result<()> {
    if id.len() != 16 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(DeskError::Invalid("That isn't a reminder.".into()));
    }
    let memory = state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?;
    // Not firing comes first: even if the node cannot erase it right now, it stays silent.
    state.reminders.cancel(&id);
    let name = Reminder { id, text: String::new(), due_at: String::new(), at: String::new(), repeat: String::new(), keeper: String::new() }.asset_name();
    memory.client().discard(memory.place(), &name).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_words_that_snooze_and_how_long() {
        assert_eq!(snooze_minutes("snooze"), Some(Some(DEFAULT_SNOOZE)));
        assert_eq!(snooze_minutes("Snooze it for 15 minutes."), Some(Some(15)));
        assert_eq!(snooze_minutes("snooze 5"), Some(Some(5)));
        assert_eq!(snooze_minutes("remind me again in 20 min"), Some(Some(20)));
        assert_eq!(snooze_minutes("snooze for 999 minutes"), Some(None), "too long is said, not set");
        assert_eq!(snooze_minutes("remind me to call Maya"), None, "a new reminder goes to the mind");
        assert_eq!(snooze_minutes("what does snooze mean"), None);
    }
}
