//! What happens to a reminder after it is set: it comes round again when it repeats, it can be
//! snoozed once it has fired ("snooze", "snooze for 15 minutes"), and it can be deleted from the
//! list (erased from the keeper's graph, and it will not fire).

use std::sync::OnceLock;

use chrono::Duration;
use regex::Regex;
use tauri::State;

use super::clock::next_due;
use crate::kernel::{time, DeskError, Result};
use crate::memory::{Record, Reminder};
use crate::state::AppState;

const DEFAULT_SNOOZE: i64 = 10;
const MAX_SNOOZE: i64 = 240;

/// A repeating reminder that fired (or was announced as missed) is written for its next time
/// (the first one still in the future), in its keeper's memory, and scheduled. Its past
/// occurrence stays in the graph as history; one that does not repeat ends here.
pub async fn come_round(state: &AppState, fired: &Reminder) {
    let Some(next) = next_after(fired, time::now()) else { return };
    let Ok(keeper) = state.keeper_or_active(&fired.keeper) else { return };
    let Ok(memory) = state.memory_for(&keeper) else { return };
    let again = Reminder::new(&fired.text, &time::iso(next), &time::now_iso()).repeating(&fired.repeat, &keeper.id);
    memory.write(&again).await;
    state.reminders.schedule(again);
}

/// The next time a repeating reminder is due AFTER `now` (a reminder missed for days comes
/// back once, at its next time, not once for every day missed). None when it does not repeat.
pub fn next_after(reminder: &Reminder, now: chrono::DateTime<chrono::Utc>) -> Option<chrono::DateTime<chrono::Utc>> {
    let mut next = next_due(time::parse_iso(&reminder.due_at)?, &reminder.repeat)?;
    // At most a year of steps: a reminder older than that is not chased further.
    for _ in 0..366 {
        if next > now {
            return Some(next);
        }
        next = next_due(next, &reminder.repeat)?;
    }
    None
}

/// Reminders that came due while Keeper was closed are said once, at start, in one line; older
/// than this many hours they are dropped silently (yesterday's reminder is noise today).
const MISSED_HOURS: i64 = 24;
const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> ";

/// The words for the reminders that were missed ("While I was closed, 2 reminders came due:
/// call Maya; stretch."); None when there were none.
pub fn missed_words(texts: &[String]) -> Option<String> {
    match texts {
        [] => None,
        [one] => Some(format!("While I was closed, a reminder came due: {}.", one.trim_end_matches('.'))),
        many => Some(format!("While I was closed, {} reminders came due: {}.", many.len(), many.iter().map(|t| t.trim_end_matches('.')).collect::<Vec<_>>().join("; "))),
    }
}

/// When Keeper was last known to be running, kept in a small file touched every minute, so
/// "what came due while I was closed" has a real start. Nothing else is kept in it.
fn alive_file() -> std::path::PathBuf {
    crate::kernel::paths::app_home().join("alive.txt")
}

/// The moment Keeper was last running (None on a first start, or when the file is unreadable).
pub fn last_alive() -> Option<chrono::DateTime<chrono::Utc>> {
    time::parse_iso(std::fs::read_to_string(alive_file()).ok()?.trim())
}

/// Note that Keeper is running now.
pub fn mark_alive() {
    let _ = crate::kernel::paths::write_private(&alive_file(), time::now_iso().as_bytes());
}

/// Was a reminder due at `due` missed: after Keeper was last running, not later than now, and
/// within the last day?
pub fn was_missed(due: chrono::DateTime<chrono::Utc>, closed_at: chrono::DateTime<chrono::Utc>, now: chrono::DateTime<chrono::Utc>) -> bool {
    due > closed_at && due <= now && now - due <= Duration::hours(MISSED_HOURS)
}

/// At start: this keeper's past-due reminders. Those that came due while Keeper was closed
/// (since `closed_at`, within a day) are returned to be said; every repeating one comes round for
/// its next time. Nothing is erased: past reminders stay in the graph as history.
pub async fn settle_missed(state: &AppState, keeper_id: &str, closed_at: Option<chrono::DateTime<chrono::Utc>>) -> Vec<String> {
    let Ok(keeper) = state.keeper_or_active(keeper_id) else { return vec![] };
    let Ok(memory) = state.memory_for(&keeper) else { return vec![] };
    let sparql = format!("{PREFIXES}SELECT ?r ?text ?due ?at ?repeat WHERE {{ ?r a desk:Reminder ; schema:text ?text ; desk:dueAt ?due ; prov:generatedAtTime ?at . OPTIONAL {{ ?r desk:repeat ?repeat }} }} ORDER BY DESC(?due) LIMIT 200");
    let Ok(rows) = memory.client().query(memory.place(), &sparql, crate::dkg::Layer::Working).await else { return vec![] };
    let now = time::now();
    let cell = |r: &crate::dkg::Row, k: &str| r.get(k).cloned().unwrap_or_default();
    let mut said = Vec::new();
    for r in &rows {
        let Some(due) = time::parse_iso(&cell(r, "due")) else { continue };
        if due > now {
            continue;
        }
        let past = Reminder { id: cell(r, "r").rsplit(':').next().unwrap_or_default().to_string(), text: cell(r, "text"), due_at: cell(r, "due"), at: cell(r, "at"), repeat: cell(r, "repeat"), keeper: keeper.id.clone() };
        // Said only when it came due while Keeper was closed, within the last day.
        if closed_at.is_some_and(|c| was_missed(due, c, now)) {
            said.push(past.text.clone());
        }
        // A repeating one always comes round, however long Keeper was closed (review finding:
        // after more than a day closed it never fired again). Its next record has the same id
        // whichever past occurrence it comes from, so writing it again changes nothing.
        if !past.repeat.is_empty() {
            come_round(state, &past).await;
        }
    }
    said
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
    fn missed_reminders_are_said_in_one_line_and_a_repeating_one_comes_back_once() {
        assert_eq!(missed_words(&[]), None);
        assert_eq!(missed_words(&["call Maya.".into()]).unwrap(), "While I was closed, a reminder came due: call Maya.");
        assert_eq!(missed_words(&["call Maya".into(), "stretch".into()]).unwrap(), "While I was closed, 2 reminders came due: call Maya; stretch.");
        let now = time::now();
        let old = Reminder::new("stretch", &time::iso(now - Duration::days(5)), &time::iso(now - Duration::days(9))).repeating("daily", "k");
        let next = next_after(&old, now).unwrap();
        assert!(next > now && next <= now + Duration::days(1), "five days missed: one next time, within a day");
        let once = Reminder::new("call", &time::iso(now - Duration::hours(1)), &time::iso(now));
        assert_eq!(next_after(&once, now), None);
        // Missed = due after Keeper closed, not in the future, within a day.
        let closed = now - Duration::hours(3);
        assert!(was_missed(now - Duration::hours(1), closed, now));
        assert!(!was_missed(now - Duration::hours(4), closed, now), "it fired while Keeper was still open");
        assert!(!was_missed(now + Duration::minutes(5), closed, now), "still ahead");
        assert!(!was_missed(now - Duration::hours(30), now - Duration::hours(40), now), "older than a day is noise");
    }

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
