//! The person's time: "what's on today / tomorrow" (`upcoming`: calendar events and reminders in
//! one agenda), and the heads-up before each event (`heads_up`, a watch). Events are read on this
//! computer through `pim` and never sent anywhere. (Adding an event is `add-event`, in `personal`.)

pub mod heads_up;

use super::super::{agenda, input, Ability, Access, Cx, Done, ALL};
use crate::kernel::{time, DeskError, Result};
use crate::pim::{Access as PimAccess, Event};

pub const ABILITIES: &[Ability] = &[Ability {
    id: "upcoming",
    how: "{\"day\": \"tomorrow\"} shows what's on that day (\"today\" or \"tomorrow\"): calendar events and reminders together, in time order, as an agenda",
    access: Access::Personal,
    platforms: ALL, modes: &["assistant", "companion"],
    run: |input, cx| Box::pin(upcoming(input, cx)),
}];

/// The calendar's events between two instants, read only with the person's permission, and the
/// words to say when it could not be read (None when there is nothing to say). `ask`: the person
/// asked for this, so a permission never asked may be asked now (never from a watch).
pub async fn read_events(app: &tauri::AppHandle, from: chrono::DateTime<chrono::Utc>, to: chrono::DateTime<chrono::Utc>, ask: bool) -> (Vec<Event>, Option<&'static str>) {
    let (mut calendar, _) = crate::pim::access(app).await;
    if ask && calendar == PimAccess::NotAsked {
        calendar = crate::pim::request_access(app).await.0;
    }
    match calendar {
        PimAccess::Allowed => match crate::pim::events(app, &time::iso(from), &time::iso(to)).await {
            Ok(events) => (events, None),
            Err(_) => (Vec::new(), Some("I couldn't read your calendar just now.")),
        },
        PimAccess::Denied => (Vec::new(), Some("I can't see your calendar: allow Keeper in System Settings, Privacy & Security, Calendars.")),
        PimAccess::NotAsked | PimAccess::Unsupported => (Vec::new(), None),
    }
}

fn counted(n: usize, one: &str) -> String {
    if n == 1 { format!("1 {one}") } else { format!("{n} {one}s") }
}

/// The sentence for a day's agenda: "Tomorrow you have 2 events and 1 reminder. First: Dentist at 9:00 AM."
pub fn day_words(day: agenda::Day, events: usize, reminders: usize, first: Option<(&str, &str)>) -> String {
    let what = match (events, reminders) {
        (0, 0) => return format!("Nothing on your calendar or reminders {}.", day.word()),
        (e, 0) => counted(e, "event"),
        (0, r) => counted(r, "reminder"),
        (e, r) => format!("{} and {}", counted(e, "event"), counted(r, "reminder")),
    };
    let lead = match day {
        agenda::Day::Today => "Still ahead today",
        agenda::Day::Tomorrow => "Tomorrow",
    };
    match first {
        Some((title, at)) => format!("{lead} you have {what}. First: {title}, {at}."),
        None => format!("{lead} you have {what}."),
    }
}

async fn upcoming(input: &serde_json::Value, cx: &Cx<'_>) -> Result<Done> {
    let day = agenda::Day::from_words(input::optional(input, "day").unwrap_or("today")).ok_or_else(|| DeskError::Invalid("I can show today or tomorrow.".into()))?;
    let now = time::now();
    let (from, to) = day.span(now);
    let (events, note) = read_events(cx.app, from, to, true).await;
    let reminders: Vec<_> = super::reminders::upcoming(cx).await.into_iter().filter(|r| time::parse_iso(&r.due_at).is_some_and(|d| d >= from && d < to)).collect();
    // Labelled from the day's own start: every row is on that day, so each shows just its clock.
    let rows = agenda::rows(&events, &reminders, from);
    let first = agenda::first(&events, &reminders, now);
    let mut summary = day_words(day, events.len(), reminders.len(), first.as_ref().map(|(t, a)| (t.as_str(), a.as_str())));
    if let Some(note) = note {
        summary = format!("{summary} {note}");
    }
    let done = Done::answer(summary);
    Ok(if rows.is_empty() { done } else { done.showing(agenda::panel(&format!("agenda-{}", day.word()), &day.title(now), rows)) })
}

#[cfg(test)]
mod tests {
    use super::agenda::Day;

    #[test]
    fn a_days_agenda_in_one_sentence() {
        assert_eq!(super::day_words(Day::Tomorrow, 0, 0, None), "Nothing on your calendar or reminders tomorrow.");
        assert_eq!(super::day_words(Day::Tomorrow, 2, 1, Some(("Dentist", "tomorrow at 9:00 AM"))), "Tomorrow you have 2 events and 1 reminder. First: Dentist, tomorrow at 9:00 AM.");
        assert_eq!(super::day_words(Day::Today, 0, 3, Some(("call Maya", "today at 5:30 PM"))), "Still ahead today you have 3 reminders. First: call Maya, today at 5:30 PM.");
    }
}
