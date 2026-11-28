//! Reminders: the `remind` and `list-reminders` abilities (each shows an agenda), `snooze` (only
//! by its words: "snooze for 15 minutes"), the clock that delivers them (`clock`) and what
//! happens around one (`actions`: it comes round again, snooze, delete, what came due while closed).
//! "Remind me in 10 minutes to stretch" sets one with no mind (`words`).

pub mod actions;
pub mod clock;
pub mod words;

pub use clock::Scheduler;

use std::sync::OnceLock;

use regex::Regex;
use tauri::Manager;

use super::super::{agenda, input, instant, Ability, Access, Cx, Done, Instant, ALL};
use crate::kernel::{time, DeskError, Result};
use crate::memory::Reminder;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "remind",
        how: "{\"text\": \"call Maya\", \"inSeconds\": 600} or {\"text\": \"pray\", \"atLocal\": \"17:30\"} speaks a reminder later; add \"repeat\": \"daily\", \"weekdays\" or \"weekly\" (with atLocal) for one that comes back",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "tutor", "companion"], instant: Instant::Also(words::remind_words),
        run: |input, cx| Box::pin(remind(input, cx)),
    },
    Ability {
        id: "list-reminders",
        how: "{} shows every reminder still ahead, with its day and time, as an agenda (use it for \"what reminders do I have\")",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "tutor", "companion"], instant: Instant::Also(list_words),
        run: |_, cx| Box::pin(list(cx)),
    },
    Ability {
        id: "snooze",
        how: "\"snooze\", \"snooze for 15 minutes\", \"remind me again in 20 minutes\": the reminder that just went off comes back",
        access: Access::Memory,
        platforms: ALL, modes: &[], instant: Instant::Only(snooze_words),
        run: |input, cx| Box::pin(async move {
            let state = cx.app.state::<crate::state::AppState>();
            Ok(Done::said(actions::snooze(&state, input["minutes"].as_i64()).await?))
        }),
    },
];

/// "What reminders do I have?", "list my reminders", "my upcoming reminders" (whole phrasings:
/// "remind me to …" is a new reminder, for the mind).
const LIST_ASKS: &str = r"(?i)^(?:please\s+)?(?:what reminders do i have|(?:show|list|tell)(?: me)? (?:all )?my reminders|(?:what are )?my (?:upcoming )?reminders|(?:do i have )?any (?:upcoming )?reminders)\s*[?.!]?$";

fn list_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, LIST_ASKS, said)
}

/// The minutes asked for (`null`: more than snoozing allows).
fn snooze_words(said: &str) -> Option<serde_json::Value> {
    actions::snooze_minutes(said).map(|minutes| serde_json::json!({ "minutes": minutes }))
}

/// The other reminders shown under a new one.
const ALSO_SHOWN: usize = 4;

async fn remind(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let text = input::text(input, "text")?;
    let now = time::now();
    let due = clock::due_time(input, now).ok_or_else(|| DeskError::Invalid("I need to know when: in some minutes, or a time like 5:30 pm.".into()))?;
    let repeat = clock::repeat_of(input).map_err(DeskError::Invalid)?;
    let ahead = upcoming(cx).await;
    // Asked twice (a repeated request, a retried turn): one reminder, not two.
    if ahead.iter().any(|r| is_same(r, text, due, &repeat)) {
        let rows = agenda::rows(&[], &ahead.iter().take(ALSO_SHOWN + 1).cloned().collect::<Vec<_>>(), now);
        let when = agenda::when_words(due, now);
        return Ok(Done::said(format!("You already have that: I'll remind you to {text} {when}.")).showing(agenda::panel("agenda-reminders", "Reminders", rows)));
    }
    let reminder = Reminder::new(text, &time::iso(due), &time::now_iso()).repeating(&repeat, cx.keeper);
    let receipt = cx.memory.write(&reminder).await;
    cx.reminders.schedule(reminder.clone());
    let when = match clock::repeat_words(&repeat) {
        "" => agenda::when_words(due, now),
        again => format!("{}, and{again} after that", agenda::when_words(due, now)),
    };
    let saved = if receipt.queued { "It's saved here and will reach your memory node when it's back." } else { "It's in your memory graph." };
    // The new reminder first, then the next few already set (the panel's Delete works on each),
    // labelled as one list so their days read the same way.
    let mut shown = vec![reminder.clone()];
    shown.extend(ahead.into_iter().filter(|r| r.id != reminder.id).take(ALSO_SHOWN));
    let mut rows = agenda::rows(&[], &shown, now);
    rows.sort_by_key(|row| row.id.as_deref() != Some(reminder.id.as_str()));
    if let Some(row) = rows.first_mut() {
        row.detail = Some(row.detail.take().map_or("Just set".into(), |d| format!("Just set. {d}")));
    }
    Ok(Done::said(format!("I'll remind you to {text} {when}. {saved}")).showing(agenda::panel("agenda-reminders", "Reminders", rows)))
}

/// The same reminder as one already set: the same words (any case and spacing), due within the
/// same minute, repeating the same way.
fn is_same(r: &Reminder, text: &str, due: chrono::DateTime<chrono::Utc>, repeat: &str) -> bool {
    let words = |s: &str| s.split_whitespace().map(str::to_lowercase).collect::<Vec<_>>();
    let close = time::parse_iso(&r.due_at).is_some_and(|at| (at - due).num_seconds().abs() < 60);
    close && words(&r.text) == words(text) && r.repeat == repeat
}

/// "What reminders do I have?": every reminder still ahead, soonest first.
async fn list(cx: &Cx<'_>) -> Result<Done> {
    let now = time::now();
    let all = upcoming(cx).await;
    let Some(next) = all.first() else { return Ok(Done::answer("You have no reminders coming up.")) };
    let when = time::parse_iso(&next.due_at).map(|d| agenda::when_words(d, now)).unwrap_or_default();
    let count = if all.len() == 1 { "1 reminder".to_string() } else { format!("{} reminders", all.len()) };
    let summary = format!("You have {count} coming up. The next: {}, {when}.", next.text.trim_end_matches('.'));
    Ok(Done::answer(summary).showing(agenda::panel("agenda-reminders", "Upcoming reminders", agenda::rows(&[], &all, now))))
}

/// This keeper's reminders still ahead, soonest first, each once (a repeating one is written
/// again for each time it comes round). Unreadable memory reads as none.
pub async fn upcoming(cx: &Cx<'_>) -> Vec<Reminder> {
    let mut all = cx.memory.upcoming_reminders().await.unwrap_or_default();
    all.sort_by_key(|r| time::parse_iso(&r.due_at));
    let mut seen = std::collections::HashSet::new();
    all.retain(|r| seen.insert(r.id.clone()));
    all
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_whole_phrasings_list_the_reminders() {
        for said in ["What reminders do I have?", "list my reminders", "any upcoming reminders?"] {
            assert_eq!(super::list_words(said), Some(serde_json::json!({})), "{said}");
        }
        assert_eq!(super::list_words("remind me to call Maya at 5"), None, "a new reminder goes to the mind");
        assert_eq!(super::snooze_words("snooze for 15 minutes").unwrap()["minutes"], 15);
        assert!(super::snooze_words("snooze for 999 minutes").unwrap()["minutes"].is_null(), "too long is said, not set");
    }

    #[test]
    fn the_same_reminder_twice_is_one_reminder() {
        let due = crate::kernel::time::parse_iso("2026-11-29T14:00:00Z").unwrap();
        let set = crate::memory::Reminder::new("Call the  dentist", "2026-11-29T14:00:20Z", "2026-11-28T08:00:00Z");
        assert!(super::is_same(&set, "call the dentist", due, &set.repeat));
        assert!(!super::is_same(&set, "call the vet", due, &set.repeat));
        assert!(!super::is_same(&set, "call the dentist", due + chrono::Duration::hours(1), &set.repeat));
    }
}
