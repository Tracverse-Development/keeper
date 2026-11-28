//! Watches: what a keeper checks on its own, without being asked (a heads-up before a calendar
//! event; later, anything else that should speak up by itself). The abilities' twin: an
//! ability runs when the mind asks for it, a watch runs on a clock.
//!
//! A [`Watch`] is plain data plus one function: its name, how often it looks, and `tick`, which
//! looks and returns [`Notice`]s (usually none). The registry lists the watches
//! (`registry::WATCHES`); [`start`] runs each one on its own loop from `lib.rs` setup. Pattern:
//! Observer (the watch observes; the runner delivers what it noticed).
//!
//! Delivery is the reminders' own ([`say`]): a macOS notification, the line in the window, and the
//! keeper's voice (muted by `KEEPER_SILENT` in tests). While a focus session holds reminders
//! (`Scheduler::hold`), watches do not look at all: a heads-up is about NOW, so one that would come
//! late is dropped rather than queued.
//!
//! Writing one:
//! ```ignore
//! pub const HEADS_UP: Watch = Watch { id: "calendar-heads-up", every: Duration::from_secs(60), tick: |app| Box::pin(look(app)) };
//! async fn look(app: &AppHandle) -> Vec<Notice> { vec![Notice::new("In 10 minutes: Dentist.", "calendar")] }
//! ```

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::kernel::{events, time};
use crate::state::AppState;

/// Something a watch noticed: the line the keeper says, and why (the window labels it: "calendar"
/// shows as "Coming up", "reminder" as "Reminder").
#[derive(Debug, Clone, PartialEq)]
pub struct Notice {
    pub line: String,
    pub reason: &'static str,
}

impl Notice {
    pub fn new(line: impl Into<String>, reason: &'static str) -> Notice {
        Notice { line: line.into(), reason }
    }
}

/// A watch's running look.
pub type Ticking<'a> = Pin<Box<dyn Future<Output = Vec<Notice>> + Send + 'a>>;

/// One thing a keeper checks on its own. Plain data; see the module doc for an example.
pub struct Watch {
    /// Its name ("calendar-heads-up"), for logs. Unique (a test checks).
    pub id: &'static str,
    /// How long between looks.
    pub every: Duration,
    /// Looks once. Reads what it needs through the handle (settings, the calendar); never fails:
    /// anything it cannot read is no notice.
    pub tick: for<'a> fn(&'a AppHandle) -> Ticking<'a>,
}

/// Says a line the keeper decided to say by itself: a notification, the line in the window, the
/// voice. The one delivery for reminders and watches.
pub async fn say(app: &AppHandle, line: &str, reason: &str) {
    crate::platform::notify("Keeper", line);
    let _ = app.emit(events::ASSISTANT_SAYS, json!({ "text": line, "reason": reason }));
    let state = app.state::<AppState>();
    let _ = state.voice.speak(app, line, &state.settings().speaking_as_active(), false).await;
}

/// Starts every watch in the registry, each on its own loop (called once, from setup). A watch
/// looks only once setup is finished, and never while a focus session holds reminders.
pub fn start(app: &AppHandle) {
    for watch in super::registry::WATCHES {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(watch.every).await;
                let state = app.state::<AppState>();
                if !state.settings().setup_complete || state.reminders.holding(time::now()) {
                    continue;
                }
                let notices = (watch.tick)(&app).await;
                if !notices.is_empty() {
                    // The count only: what was noticed (an event's title) stays out of the log.
                    eprintln!("[watch] {} noticed {}", watch.id, notices.len());
                }
                for notice in notices {
                    say(&app, &notice.line, notice.reason).await;
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    #[test]
    fn every_watch_has_its_own_name_and_a_sensible_clock() {
        let mut seen = HashSet::new();
        for w in super::super::registry::WATCHES {
            assert!(seen.insert(w.id), "two watches are called {}", w.id);
            assert!(w.every.as_secs() >= 10, "{} looks too often", w.id);
        }
    }
}
