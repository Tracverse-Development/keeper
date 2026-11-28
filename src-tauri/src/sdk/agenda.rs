//! Agendas: calendar events and reminders as the rows of one `agenda` panel, in time order, and
//! the words for when something is ("tomorrow at 9:00 AM"). Pure; shared by every ability and
//! answer that shows the person's time (`remind`, `list-reminders`, `upcoming`, the morning brief).
//!
//! Using it:
//! ```ignore
//! let rows = agenda::rows(&events, &reminders, now);         // sorted, each with its time label
//! let panel = agenda::panel("agenda-today", "Today", rows);  // a Stage panel
//! let words = agenda::when_words(due, now);                  // "tomorrow at 9:00 AM"
//! ```

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, TimeZone, Utc};

use crate::kernel::time;
use crate::memory::Reminder;
use crate::pim::Event;
use crate::stage::panel::{AgendaItem, AgendaKind};
use crate::stage::Panel;

/// The most rows one agenda shows (a long list is said in words; the panel shows the first).
pub const MAX_ROWS: usize = 12;

fn clock(t: DateTime<Local>) -> String {
    t.format("%-I:%M %p").to_string()
}

/// The sentence form of a moment: "today at 9:00 AM", "tomorrow at 9:00 AM", "on Monday at
/// 9:00 AM" (within the week), "on 4 December at 9:00 AM" (later).
pub fn when_words(at: DateTime<Utc>, now: DateTime<Utc>) -> String {
    let (at, today) = (at.with_timezone(&Local), now.with_timezone(&Local).date_naive());
    let days = (at.date_naive() - today).num_days();
    match days {
        0 => format!("today at {}", clock(at)),
        1 => format!("tomorrow at {}", clock(at)),
        2..=6 => format!("on {} at {}", at.format("%A"), clock(at)),
        _ => format!("on {} at {}", at.format("%-d %B"), clock(at)),
    }
}

/// The time column of a row: "9:00 AM" today, "Tomorrow 9:00 AM", "Mon 9:00 AM" within the
/// week, "4 Dec 9:00 AM" later.
pub fn time_label(at: DateTime<Utc>, now: DateTime<Utc>) -> String {
    let (at, today) = (at.with_timezone(&Local), now.with_timezone(&Local).date_naive());
    match (at.date_naive() - today).num_days() {
        0 => clock(at),
        1 => format!("Tomorrow {}", clock(at)),
        2..=6 => format!("{} {}", at.format("%a"), clock(at)),
        _ => format!("{} {}", at.format("%-d %b"), clock(at)),
    }
}

/// A reminder as a row: its words, when, how it repeats; it carries its id (the panel's Delete).
pub fn reminder_row(r: &Reminder, now: DateTime<Utc>) -> Option<(DateTime<Utc>, AgendaItem)> {
    let due = time::parse_iso(&r.due_at)?;
    let repeat = super::packs::reminders::clock::repeat_words(&r.repeat).trim();
    let detail = (!repeat.is_empty()).then(|| format!("Repeats {repeat}"));
    Some((due, AgendaItem { time: Some(time_label(due, now)), title: r.text.clone(), detail, kind: Some(AgendaKind::Reminder), id: Some(r.id.clone()) }))
}

/// A calendar event as a row: "All day" or its start, its title, where (or which calendar).
pub fn event_row(e: &Event, now: DateTime<Utc>) -> Option<(DateTime<Utc>, AgendaItem)> {
    let start = time::parse_iso(&e.start)?;
    let time = if e.all_day { "All day".to_string() } else { time_label(start, now) };
    let detail = [e.location.trim(), e.calendar.trim()].into_iter().find(|s| !s.is_empty()).map(str::to_string);
    Some((start, AgendaItem { time: Some(time), title: e.title.clone(), detail, kind: Some(AgendaKind::Event), id: None }))
}

/// Every readable row with its moment and whether it is all-day, in time order (all-day events
/// first on their day).
fn sorted(events: &[Event], reminders: &[Reminder], now: DateTime<Utc>) -> Vec<(DateTime<Utc>, bool, AgendaItem)> {
    let mut all: Vec<(DateTime<Utc>, bool, AgendaItem)> = Vec::new();
    for e in events {
        if let Some((at, row)) = event_row(e, now) {
            all.push((at, e.all_day, row));
        }
    }
    for r in reminders {
        if let Some((at, row)) = reminder_row(r, now) {
            all.push((at, false, row));
        }
    }
    // An all-day event sorts before a timed one at the same moment.
    all.sort_by(|a, b| (a.0, !a.1).cmp(&(b.0, !b.1)));
    all
}

/// Events and reminders as one list in time order, at most `MAX_ROWS`, their times labelled from
/// `now` (pass a day's start to label a one-day agenda with clocks only). Rows whose time cannot
/// be read are left out.
pub fn rows(events: &[Event], reminders: &[Reminder], now: DateTime<Utc>) -> Vec<AgendaItem> {
    sorted(events, reminders, now).into_iter().take(MAX_ROWS).map(|(_, _, row)| row).collect()
}

/// The first thing in that list and when, in words: ("Dentist", "tomorrow at 9:00 AM"), or
/// ("Holiday", "all day").
pub fn first(events: &[Event], reminders: &[Reminder], now: DateTime<Utc>) -> Option<(String, String)> {
    let (at, all_day, row) = sorted(events, reminders, now).into_iter().next()?;
    Some((row.title, if all_day { "all day".into() } else { when_words(at, now) }))
}

/// The rows as a Stage panel.
pub fn panel(id: &str, title: &str, items: Vec<AgendaItem>) -> Panel {
    Panel::Agenda { id: id.into(), title: title.into(), items }
}

/// Which day a person asked about.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Day {
    Today,
    Tomorrow,
}

impl Day {
    /// "today" / "tomorrow" (any case); anything else is None.
    pub fn from_words(words: &str) -> Option<Day> {
        match words.trim().to_lowercase().as_str() {
            "" | "today" => Some(Day::Today),
            "tomorrow" => Some(Day::Tomorrow),
            _ => None,
        }
    }

    /// The span to read for that day, in the person's own time: today from now to midnight
    /// (what is still ahead), tomorrow from midnight to midnight.
    pub fn span(self, now: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
        let today = now.with_timezone(&Local).date_naive();
        let midnight = |d: NaiveDate| Local.from_local_datetime(&d.and_hms_opt(0, 0, 0).unwrap_or_default()).earliest().map(|t| t.with_timezone(&Utc)).unwrap_or(now);
        match self {
            Day::Today => (now, midnight(today + Duration::days(1))),
            Day::Tomorrow => (midnight(today + Duration::days(1)), midnight(today + Duration::days(2))),
        }
    }

    /// The panel's title: "Today" or "Tomorrow, Saturday 28 November".
    pub fn title(self, now: DateTime<Utc>) -> String {
        match self {
            Day::Today => "Today".into(),
            Day::Tomorrow => {
                let d = now.with_timezone(&Local).date_naive() + Duration::days(1);
                format!("Tomorrow, {} {} {}", d.format("%A"), d.day(), d.format("%B"))
            }
        }
    }

    /// "today" / "tomorrow", for sentences.
    pub fn word(self) -> &'static str {
        match self {
            Day::Today => "today",
            Day::Tomorrow => "tomorrow",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        Local.with_ymd_and_hms(y, m, d, h, min, 0).unwrap().with_timezone(&Utc)
    }

    fn event(title: &str, start: DateTime<Utc>, all_day: bool) -> Event {
        Event { title: title.into(), start: time::iso(start), end: time::iso(start + Duration::hours(1)), all_day, location: String::new(), calendar: "Home".into() }
    }

    #[test]
    fn when_words_name_the_day() {
        let now = local(2026, 11, 27, 15, 0); // a Friday afternoon
        assert_eq!(when_words(local(2026, 11, 27, 17, 30), now), "today at 5:30 PM");
        assert_eq!(when_words(local(2026, 11, 28, 9, 0), now), "tomorrow at 9:00 AM");
        assert_eq!(when_words(local(2026, 11, 30, 9, 0), now), "on Monday at 9:00 AM");
        assert_eq!(when_words(local(2026, 12, 9, 9, 0), now), "on 9 December at 9:00 AM");
        assert_eq!(time_label(local(2026, 11, 28, 9, 0), now), "Tomorrow 9:00 AM");
        assert_eq!(time_label(local(2026, 11, 27, 16, 0), now), "4:00 PM");
    }

    #[test]
    fn events_and_reminders_are_one_list_in_time_order() {
        let now = local(2026, 11, 27, 8, 0);
        let events = [event("Dentist", local(2026, 11, 27, 15, 0), false), event("Holiday", local(2026, 11, 27, 0, 0), true)];
        let call = Reminder::new("call Maya", &time::iso(local(2026, 11, 27, 10, 0)), &time::iso(now)).repeating("daily", "k");
        let rows = rows(&events, &[call.clone()], now);
        let titles: Vec<_> = rows.iter().map(|r| r.title.as_str()).collect();
        assert_eq!(titles, ["Holiday", "call Maya", "Dentist"]);
        assert_eq!(rows[0].time.as_deref(), Some("All day"));
        assert_eq!(rows[1].id.as_deref(), Some(call.id.as_str()), "a reminder row carries its id (for Delete)");
        assert_eq!(rows[1].detail.as_deref(), Some("Repeats every day"));
        assert_eq!(rows[2].detail.as_deref(), Some("Home"), "no location: the calendar's name");
        assert_eq!(rows[2].id, None);
        assert_eq!(first(&events, &[call.clone()], now), Some(("Holiday".into(), "all day".into())));
        assert_eq!(first(&events[..1], &[call], now), Some(("call Maya".into(), "today at 10:00 AM".into())));
    }

    #[test]
    fn a_day_is_read_in_the_persons_own_time() {
        let now = local(2026, 11, 27, 15, 0);
        let (from, to) = Day::Today.span(now);
        assert_eq!((from, to), (now, local(2026, 11, 28, 0, 0)), "today: what is still ahead");
        assert_eq!(Day::Tomorrow.span(now), (local(2026, 11, 28, 0, 0), local(2026, 11, 29, 0, 0)));
        assert_eq!(Day::Tomorrow.title(now), "Tomorrow, Saturday 28 November");
        assert_eq!(Day::from_words("Tomorrow"), Some(Day::Tomorrow));
        assert_eq!(Day::from_words("next year"), None);
    }
}
