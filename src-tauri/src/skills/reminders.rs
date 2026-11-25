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

type OnDue = Arc<dyn Fn(Reminder) + Send + Sync>;

#[derive(Clone)]
pub struct Scheduler {
    on_due: OnDue,
    scheduled: Arc<Mutex<HashSet<String>>>,
}

impl Scheduler {
    pub fn new(on_due: impl Fn(Reminder) + Send + Sync + 'static) -> Scheduler {
        Scheduler { on_due: Arc::new(on_due), scheduled: Arc::new(Mutex::new(HashSet::new())) }
    }

    /// Schedule once; scheduling the same reminder again (a reload) is a no-op.
    pub fn schedule(&self, reminder: Reminder) {
        let Some(due) = time::parse_iso(&reminder.due_at) else { return };
        if !self.scheduled.lock().map(|mut s| s.insert(reminder.id.clone())).unwrap_or(false) {
            return;
        }
        let wait = (due - time::now()).to_std().unwrap_or_default();
        let on_due = self.on_due.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(wait).await;
            on_due(reminder);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
