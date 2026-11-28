//! The heads-up before an event: a few minutes before each timed event on the person's calendar
//! (Settings, `headsUpMinutes`: off, 5, 10, 15 or 30; `DEFAULT_HEADS_UP` = 10), the keeper says it, like a
//! reminder. Each event is warned once (kept for the day, in memory only); all-day events and
//! events already started are never warned. The calendar is read on this computer only, and only
//! when the person already allowed it: a watch never asks for permission.

use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};
use std::time::Duration as StdDuration;

use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use tauri::{AppHandle, Manager};

use super::super::super::watch::{Notice, Watch};
use crate::kernel::time;
use crate::pim::Event;
use crate::state::AppState;

/// The leads the person can choose, in minutes (0 = off).
pub const LEADS: [u32; 5] = [0, 5, 10, 15, 30];

/// The watch, listed in `registry::WATCHES`: it looks once a minute.
pub const HEADS_UP: Watch = Watch { id: "calendar-heads-up", every: StdDuration::from_secs(60), tick: |app| Box::pin(look(app)) };

/// The events already warned today (title and start), so a heads-up is said once.
#[derive(Debug, Default)]
pub struct Warned {
    day: Option<NaiveDate>,
    keys: HashSet<String>,
}

static WARNED: LazyLock<Mutex<Warned>> = LazyLock::new(Mutex::default);

/// The heads-ups due at `now` with a lead of `lead` minutes: each timed event that starts within
/// the lead and has not been warned today. A new day forgets yesterday's warnings.
pub fn due(events: &[Event], now: DateTime<Utc>, lead: u32, warned: &mut Warned) -> Vec<Notice> {
    if lead == 0 {
        return Vec::new();
    }
    let today = now.with_timezone(&Local).date_naive();
    if warned.day != Some(today) {
        *warned = Warned { day: Some(today), keys: HashSet::new() };
    }
    let mut notices = Vec::new();
    for e in events.iter().filter(|e| !e.all_day) {
        let Some(start) = time::parse_iso(&e.start) else { continue };
        let until = start - now;
        if until <= Duration::zero() || until > Duration::minutes(lead.into()) {
            continue;
        }
        if warned.keys.insert(format!("{}\u{0}{}", e.start, e.title)) {
            notices.push(Notice::new(line(e, until), "calendar"));
        }
    }
    notices
}

/// "In 9 minutes: Dentist, at Main Street." (minutes rounded up, so it never says "in 0 minutes").
pub fn line(e: &Event, until: Duration) -> String {
    let minutes = (until.num_seconds() + 59) / 60;
    let when = if minutes == 1 { "In 1 minute".to_string() } else { format!("In {minutes} minutes") };
    let title = e.title.trim().trim_end_matches('.');
    match e.location.trim() {
        "" => format!("{when}: {title}."),
        place => format!("{when}: {title}, at {place}."),
    }
}

async fn look(app: &AppHandle) -> Vec<Notice> {
    let lead = app.state::<AppState>().settings().heads_up_minutes;
    if lead == 0 {
        return Vec::new();
    }
    let now = time::now();
    // A minute past the lead, so an event right at the edge is still read.
    let (events, _) = super::read_events(app, now, now + Duration::minutes(i64::from(lead) + 1), false).await;
    match WARNED.lock() {
        Ok(mut warned) => due(&events, now, lead, &mut warned),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn event(title: &str, start: DateTime<Utc>, all_day: bool) -> Event {
        Event { title: title.into(), start: time::iso(start), end: time::iso(start + Duration::hours(1)), all_day, location: String::new(), calendar: "Home".into() }
    }

    fn noon() -> DateTime<Utc> {
        Local.with_ymd_and_hms(2026, 11, 27, 12, 0, 0).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn an_event_inside_the_lead_is_warned_once() {
        let now = noon();
        let dentist = Event { location: "Main Street".into(), ..event("Dentist", now + Duration::minutes(9), false) };
        let mut warned = Warned::default();
        let first = due(&[dentist.clone()], now, 10, &mut warned);
        assert_eq!(first, vec![Notice::new("In 9 minutes: Dentist, at Main Street.", "calendar")]);
        assert!(due(&[dentist.clone()], now + Duration::minutes(1), 10, &mut warned).is_empty(), "said once");
        // The next day the same title and time is another event.
        let tomorrow = Event { start: time::iso(now + Duration::days(1) + Duration::minutes(9)), ..dentist };
        assert_eq!(due(&[tomorrow], now + Duration::days(1), 10, &mut warned).len(), 1);
    }

    #[test]
    fn all_day_past_far_and_off_are_not_warned() {
        let now = noon();
        let mut warned = Warned::default();
        let events = [event("Holiday", now + Duration::minutes(5), true), event("Standup", now - Duration::minutes(1), false), event("Lunch", now + Duration::minutes(11), false), event("Now", now, false)];
        assert!(due(&events, now, 10, &mut warned).is_empty(), "all-day, started, beyond the lead, starting this second");
        assert!(due(&[event("Call", now + Duration::minutes(3), false)], now, 0, &mut warned).is_empty(), "off");
        assert_eq!(due(&[event("Lunch", now + Duration::minutes(11), false)], now, 15, &mut warned).len(), 1, "a longer lead reaches it");
    }

    #[test]
    fn the_line_rounds_up_and_names_the_place() {
        let e = event("Call Maya.", noon(), false);
        assert_eq!(line(&e, Duration::seconds(30)), "In 1 minute: Call Maya.");
        assert_eq!(line(&e, Duration::seconds(600)), "In 10 minutes: Call Maya.");
        assert!(LEADS.contains(&crate::kernel::settings::DEFAULT_HEADS_UP));
    }
}
