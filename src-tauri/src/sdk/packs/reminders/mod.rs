//! Reminders: the `remind` and `list-reminders` abilities (each shows an agenda), the clock that
//! delivers them (`clock`) and what happens around one (`actions`: it comes round again, snooze, delete, what came due while closed).

pub mod actions;
pub mod clock;

pub use clock::Scheduler;

use super::super::{agenda, input, Ability, Access, Cx, Done, ALL};
use crate::kernel::{time, DeskError, Result};
use crate::memory::Reminder;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "remind",
        how: "{\"text\": \"call Maya\", \"inSeconds\": 600} or {\"text\": \"pray\", \"atLocal\": \"17:30\"} speaks a reminder later; add \"repeat\": \"daily\", \"weekdays\" or \"weekly\" (with atLocal) for one that comes back",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "tutor", "companion"],
        run: |input, cx| Box::pin(remind(input, cx)),
    },
    Ability {
        id: "list-reminders",
        how: "{} shows every reminder still ahead, with its day and time, as an agenda (use it for \"what reminders do I have\")",
        access: Access::Memory,
        platforms: ALL, modes: &["assistant", "tutor", "companion"],
        run: |_, cx| Box::pin(list(cx)),
    },
];

/// The other reminders shown under a new one.
const ALSO_SHOWN: usize = 4;

async fn remind(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let text = input::text(input, "text")?;
    let now = time::now();
    let due = clock::due_time(input, now).ok_or_else(|| DeskError::Invalid("I need to know when: in some minutes, or a time like 5:30 pm.".into()))?;
    let repeat = clock::repeat_of(input).map_err(DeskError::Invalid)?;
    let reminder = Reminder::new(text, &time::iso(due), &time::now_iso()).repeating(&repeat, cx.keeper);
    let receipt = cx.memory.write(&reminder).await;
    cx.reminders.schedule(reminder.clone());
    let when = match clock::repeat_words(&repeat) {
        "" => agenda::when_words(due, now),
        again => format!("{}, and{again} after that", agenda::when_words(due, now)),
    };
    let saved = if receipt.queued { "It's saved here and will reach your memory node when it's back." } else { "It's in your memory graph." };
    // The new reminder first, then the next few already set (the panel's Delete works on each).
    let others: Vec<Reminder> = upcoming(cx).await.into_iter().filter(|r| r.id != reminder.id).take(ALSO_SHOWN).collect();
    let mut rows = agenda::rows(&[], std::slice::from_ref(&reminder), now);
    for row in &mut rows {
        row.detail = Some(row.detail.take().map_or("Just set".into(), |d| format!("Just set. {d}")));
    }
    rows.extend(agenda::rows(&[], &others, now));
    Ok(Done::said(format!("I'll remind you to {text} {when}. {saved}")).showing(agenda::panel("agenda-reminders", "Reminders", rows)))
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
