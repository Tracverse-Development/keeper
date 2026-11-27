//! The reminder clock. A reminder is written to the DKG first (so it survives a restart:
//! `Memory::upcoming_reminders` reloads them at launch), then scheduled here. When one comes
//! due the scheduler calls `on_due` (the app speaks it and shows a notification).

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Duration, Local, NaiveTime, TimeZone, Utc};

use crate::kernel::time;
use crate::memory::Reminder;

/// The longest a reminder may wait (a week); longer asks are refused, not silently clipped.
const LONGEST: i64 = 7 * 24 * 3600;

/// When an `inSeconds` / `atLocal` input comes due, relative to `now`.
pub fn due_time(input: &serde_json::Value, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    if let Some(secs) = input["inSeconds"].as_i64() {
        return (1..=LONGEST).contains(&secs).then(|| now + Duration::seconds(secs));
    }
    let at = input["atLocal"].as_str()?;
    let t = NaiveTime::parse_from_str(at, "%H:%M").ok()?;
    let local_now = now.with_timezone(&Local);
    let today = local_now.date_naive().and_time(t);
    let mut due = Local.from_local_datetime(&today).single()?;
    if due <= local_now {
        due += Duration::days(1);
    }
    Some(due.with_timezone(&Utc))
}

/// The ways a reminder can repeat.
pub const REPEATS: [&str; 3] = ["daily", "weekdays", "weekly"];

/// The repeat an input asks for: "" (once) or one of `REPEATS`; anything else is refused in words.
pub fn repeat_of(input: &serde_json::Value) -> Result<String, String> {
    match input["repeat"].as_str().map(|r| r.trim().to_lowercase()) {
        None => Ok(String::new()),
        Some(r) if r.is_empty() || r == "once" || r == "none" => Ok(String::new()),
        Some(r) if REPEATS.contains(&r.as_str()) => Ok(r),
        Some(_) => Err("A reminder can repeat daily, on weekdays or weekly.".into()),
    }
}

/// When a repeating reminder due at `due` comes round again: the same clock time on the next
/// day, the next weekday, or a week on, in the person's own time (so it stays at 9:00 across a
/// clock change). None for a reminder that does not repeat.
pub fn next_due(due: DateTime<Utc>, repeat: &str) -> Option<DateTime<Utc>> {
    use chrono::Datelike;
    let local = due.with_timezone(&Local);
    let mut day = local.date_naive();
    match repeat {
        "daily" => day += Duration::days(1),
        "weekly" => day += Duration::days(7),
        "weekdays" => loop {
            day += Duration::days(1);
            if day.weekday().number_from_monday() <= 5 {
                break;
            }
        },
        _ => return None,
    }
    Local.from_local_datetime(&day.and_time(local.time())).earliest().map(|t| t.with_timezone(&Utc))
}

/// "every day", "on weekdays", "every week" (or nothing, for a reminder that happens once).
pub fn repeat_words(repeat: &str) -> &'static str {
    match repeat {
        "daily" => " every day",
        "weekdays" => " every weekday",
        "weekly" => " every week",
        _ => "",
    }
}

type OnDue = Arc<dyn Fn(Reminder) + Send + Sync>;

#[derive(Clone)]
pub struct Scheduler {
    on_due: OnDue,
    scheduled: Arc<Mutex<HashSet<String>>>,
    /// Reminders that come due before this moment wait for it (a focus session is running).
    held_until: Arc<Mutex<Option<DateTime<Utc>>>>,
    /// Reminders the person deleted: they never fire.
    cancelled: Arc<Mutex<HashSet<String>>>,
    /// The reminder that fired last (what "snooze" means).
    last: Arc<Mutex<Option<Reminder>>>,
}

/// How often a held reminder looks whether the hold was lifted early.
const HOLD_CHECK: std::time::Duration = std::time::Duration::from_secs(5);

/// How long a reminder due now still has to wait under a hold (None: deliver it).
fn held_for(held_until: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Option<std::time::Duration> {
    held_until.filter(|until| *until > now).map(|until| (until - now).to_std().unwrap_or_default().min(HOLD_CHECK))
}

impl Scheduler {
    pub fn new(on_due: impl Fn(Reminder) + Send + Sync + 'static) -> Scheduler {
        Scheduler { on_due: Arc::new(on_due), scheduled: Arc::new(Mutex::new(HashSet::new())), held_until: Arc::new(Mutex::new(None)), cancelled: Arc::new(Mutex::new(HashSet::new())), last: Arc::new(Mutex::new(None)) }
    }

    /// Hold reminders until `until` (a focus session), or lift the hold with None: anything
    /// that came due meanwhile is delivered within a few seconds. Never longer than asked.
    pub fn hold(&self, until: Option<DateTime<Utc>>) {
        if let Ok(mut held) = self.held_until.lock() {
            *held = until;
        }
    }

    /// Schedule once; scheduling the same reminder again (a reload) is a no-op.
    pub fn schedule(&self, reminder: Reminder) {
        let Some(due) = time::parse_iso(&reminder.due_at) else { return };
        if !self.scheduled.lock().map(|mut s| s.insert(reminder.id.clone())).unwrap_or(false) {
            return;
        }
        let (on_due, held_until, cancelled, last) = (self.on_due.clone(), self.held_until.clone(), self.cancelled.clone(), self.last.clone());
        tauri::async_runtime::spawn(async move {
            time::sleep_until(due).await;
            while let Some(more) = held_for(held_until.lock().ok().and_then(|h| *h), time::now()) {
                tokio::time::sleep(more).await;
            }
            if cancelled.lock().map(|c| c.contains(&reminder.id)).unwrap_or(false) {
                return;
            }
            if let Ok(mut l) = last.lock() {
                *l = Some(reminder.clone());
            }
            on_due(reminder);
        });
    }

    /// A reminder the person deleted will not fire.
    pub fn cancel(&self, id: &str) {
        if let Ok(mut c) = self.cancelled.lock() {
            c.insert(id.to_string());
        }
    }

    /// The reminder that fired most recently, if any (snoozing brings it back).
    pub fn last_fired(&self) -> Option<Reminder> {
        self.last.lock().ok()?.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_hold_delays_a_due_reminder_only_until_it_ends() {
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 15, 0, 0).unwrap();
        assert_eq!(held_for(None, now), None, "no hold: delivered");
        assert_eq!(held_for(Some(now - Duration::seconds(1)), now), None, "a hold that ended: delivered");
        assert_eq!(held_for(Some(now + Duration::minutes(20)), now), Some(HOLD_CHECK), "waits in short steps, so a hold lifted early is noticed");
        assert_eq!(held_for(Some(now + Duration::seconds(2)), now), Some(std::time::Duration::from_secs(2)));
    }

    #[test]
    fn a_repeating_reminder_comes_round_at_the_same_clock_time() {
        use chrono::{Datelike, Timelike};
        // A Friday at 09:00 local.
        let friday = Local.with_ymd_and_hms(2026, 11, 27, 9, 0, 0).unwrap().with_timezone(&Utc);
        let local = |t: DateTime<Utc>| t.with_timezone(&Local);
        assert_eq!(local(next_due(friday, "daily").unwrap()).day(), 28);
        let monday = local(next_due(friday, "weekdays").unwrap());
        assert_eq!((monday.day(), monday.weekday().number_from_monday(), monday.hour()), (30, 1, 9), "Friday's weekday reminder comes back on Monday at 9");
        assert_eq!(local(next_due(friday, "weekly").unwrap()).day(), 4);
        assert_eq!(next_due(friday, ""), None);
        assert_eq!(repeat_of(&json!({"repeat": "Daily"})).unwrap(), "daily");
        assert_eq!(repeat_of(&json!({})).unwrap(), "");
        assert!(repeat_of(&json!({"repeat": "hourly"})).is_err());
        assert_eq!(repeat_words("weekdays"), " every weekday");
    }

    #[test]
    fn relative_and_clock_times() {
        let now = Utc.with_ymd_and_hms(2026, 11, 25, 15, 0, 0).unwrap();
        assert_eq!(due_time(&json!({"inSeconds": 600}), now), Some(now + Duration::minutes(10)));
        assert_eq!(due_time(&json!({"inSeconds": 0}), now), None);
        assert_eq!(due_time(&json!({"inSeconds": LONGEST + 1}), now), None);
        let at = due_time(&json!({"atLocal": "09:30"}), now).unwrap();
        assert!(at > now && at <= now + Duration::days(1));
        assert_eq!(due_time(&json!({"atLocal": "25:00"}), now), None);
    }
}
