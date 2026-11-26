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
    /// Reminders that come due before this moment wait for it (a focus session is running).
    held_until: Arc<Mutex<Option<DateTime<Utc>>>>,
}

/// How often a held reminder looks whether the hold was lifted early.
const HOLD_CHECK: std::time::Duration = std::time::Duration::from_secs(5);

/// How long a reminder due now still has to wait under a hold (None: deliver it).
fn held_for(held_until: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Option<std::time::Duration> {
    held_until.filter(|until| *until > now).map(|until| (until - now).to_std().unwrap_or_default().min(HOLD_CHECK))
}

impl Scheduler {
    pub fn new(on_due: impl Fn(Reminder) + Send + Sync + 'static) -> Scheduler {
        Scheduler { on_due: Arc::new(on_due), scheduled: Arc::new(Mutex::new(HashSet::new())), held_until: Arc::new(Mutex::new(None)) }
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
        let wait = (due - time::now()).to_std().unwrap_or_default();
        let (on_due, held_until) = (self.on_due.clone(), self.held_until.clone());
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(wait).await;
            while let Some(more) = held_for(held_until.lock().ok().and_then(|h| *h), time::now()) {
                tokio::time::sleep(more).await;
            }
            on_due(reminder);
        });
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
