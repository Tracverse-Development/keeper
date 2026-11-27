//! Reminders: the `remind` ability, the clock that delivers them (`clock`) and what happens
//! around one (`actions`: it comes round again, snooze, delete, what came due while closed).

pub mod actions;
pub mod clock;

pub use clock::Scheduler;

use super::super::{input, Ability, Access, Cx, Done, ALL};
use crate::kernel::{time, DeskError, Result};
use crate::memory::Reminder;

pub const ABILITIES: &[Ability] = &[Ability {
    id: "remind",
    how: "{\"text\": \"call Maya\", \"inSeconds\": 600} or {\"text\": \"pray\", \"atLocal\": \"17:30\"} speaks a reminder later; add \"repeat\": \"daily\", \"weekdays\" or \"weekly\" (with atLocal) for one that comes back",
    access: Access::Memory,
    platforms: ALL,
    run: |input, cx| Box::pin(remind(input, cx)),
}];

async fn remind(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let text = input::text(input, "text")?;
    let due = clock::due_time(input, time::now()).ok_or_else(|| DeskError::Invalid("I need to know when: in some minutes, or a time like 5:30 pm.".into()))?;
    let repeat = clock::repeat_of(input).map_err(DeskError::Invalid)?;
    let reminder = Reminder::new(text, &time::iso(due), &time::now_iso()).repeating(&repeat, cx.keeper);
    let receipt = cx.memory.write(&reminder).await;
    cx.reminders.schedule(reminder.clone());
    let when = format!("{}{}", due.with_timezone(&chrono::Local).format("%-I:%M %p"), clock::repeat_words(&repeat));
    let saved = if receipt.queued { "It's saved here and will reach your memory node when it's back." } else { "It's in your memory graph." };
    Ok(Done::said(format!("I'll remind you to {text} at {when}. {saved}")))
}
