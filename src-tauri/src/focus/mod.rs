//! Focus sessions: a set stretch of quiet work with the keeper beside you. While one runs,
//! reminders that come due are held (`skills::reminders::Scheduler::hold`) and delivered when
//! it ends. A session that runs to its end is recorded on the keeper's graph as a `desk:Action`
//! (skill `focus`), so it counts toward the keeper's level like anything else it does with you;
//! one that is stopped early records nothing. One session at a time; it does not survive
//! quitting Keeper (nothing is held past that: reminders reload from the graph at launch).
//!
//! Started with words ("focus for 25 minutes", "start a focus session"; the command palette
//! sends the same words); `focus_state` tells the window what to show.

use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::kernel::{events, time, DeskError, Result};
use crate::memory::ActionRecord;
use crate::state::AppState;

pub const DEFAULT_MINUTES: u32 = 25;
const MIN_MINUTES: u32 = 5;
const MAX_MINUTES: u32 = 120;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub keeper: String,
    pub minutes: u32,
    pub started_at: String,
    pub ends_at: String,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);

fn current() -> Option<Session> {
    SESSION.lock().ok()?.clone()
}

/// The words that start a session ("focus for 40 minutes", "start a pomodoro") or end one.
pub const STARTS: &str = r"(?i)^(?:please\s+)?(?:(?:let(?:'s| us)|i want to|help me)\s+)?(?:start|begin|do)?\s*(?:a |my )?(?:focus(?: session| time| timer)?|pomodoro)(?:\s+(?:for|of)\s+(\d{1,3})\s*(?:min(?:ute)?s?)?)?\s*[.!]?$|^(?:please\s+)?(?:let me |help me )?focus\s+for\s+(\d{1,3})\s*(?:min(?:ute)?s?)\s*[.!]?$";
pub const STOPS: &str = r"(?i)^(?:please\s+)?(?:stop|end|cancel|finish)\s+(?:the |my |this )?(?:focus(?: session| time| timer)?|pomodoro)\s*[.!]?$";

/// The minutes a start phrase asks for (absent: the default); None when out of range.
pub fn minutes_asked(captures: &regex::Captures) -> Option<u32> {
    match captures.get(1).or_else(|| captures.get(2)) {
        Some(m) => m.as_str().parse().ok().filter(|n| (MIN_MINUTES..=MAX_MINUTES).contains(n)),
        None => Some(DEFAULT_MINUTES),
    }
}

/// Start a session for `keeper` (replacing none: a running one must be ended first).
pub fn start(app: &AppHandle, keeper: &str, minutes: u32) -> Result<Session> {
    if !(MIN_MINUTES..=MAX_MINUTES).contains(&minutes) {
        return Err(DeskError::Invalid(format!("A focus session is between {MIN_MINUTES} and {MAX_MINUTES} minutes.")));
    }
    let now = time::now();
    let ends = now + Duration::minutes(i64::from(minutes));
    let session = Session { keeper: keeper.to_string(), minutes, started_at: time::iso(now), ends_at: time::iso(ends) };
    {
        let mut slot = SESSION.lock().map_err(|_| DeskError::Io("The focus timer is busy.".into()))?;
        if slot.is_some() {
            return Err(DeskError::Invalid("A focus session is already running. End it first.".into()));
        }
        *slot = Some(session.clone());
    }
    app.state::<AppState>().reminders.hold(Some(ends));
    let (app, ours) = (app.clone(), session.clone());
    tauri::async_runtime::spawn(async move {
        time::sleep_until(ends).await;
        complete(&app, &ours).await;
    });
    Ok(session)
}

/// The session ran to its end (and is still the one running): record it, release the held
/// reminders, and say so.
async fn complete(app: &AppHandle, ours: &Session) {
    let still_ours = SESSION.lock().ok().is_some_and(|mut slot| if slot.as_ref() == Some(ours) { slot.take().is_some() } else { false });
    if !still_ours {
        return;
    }
    let state = app.state::<AppState>();
    state.reminders.hold(None);
    if let Some(memory) = state.keeper_or_active(&ours.keeper).ok().and_then(|k| state.memory_for(&k).ok()) {
        let record = ActionRecord::new("focus", &format!("{} minutes", ours.minutes), &format!("Focused for {} minutes.", ours.minutes), true, &time::now_iso(), "");
        memory.write(&record).await;
        crate::keepers::kit::levels::check_level_up(app, ours.keeper.clone(), memory);
    }
    let line = done_line(ours.minutes);
    crate::platform::notify("Keeper", &line);
    let _ = app.emit(events::ASSISTANT_SAYS, json!({ "text": line, "reason": "focus" }));
    let _ = state.voice.speak(app, &line, &state.settings().speaking_as_active(), false).await;
}

pub fn done_line(minutes: u32) -> String {
    format!("That's your {minutes} minutes. Nicely done. Time for a short break.")
}

/// End the running session early: nothing is recorded, held reminders are released.
pub fn stop(app: &AppHandle) -> Option<Session> {
    let ended = SESSION.lock().ok()?.take()?;
    app.state::<AppState>().reminders.hold(None);
    Some(ended)
}

/// How long is left, in whole minutes rounded up (for what the keeper says).
pub fn minutes_left(session: &Session, now: DateTime<Utc>) -> i64 {
    time::parse_iso(&session.ends_at).map(|end| ((end - now).num_seconds().max(0) + 59) / 60).unwrap_or(0)
}

#[tauri::command]
pub fn focus_state() -> Option<Session> {
    current()
}

#[tauri::command]
pub fn focus_stop(app: AppHandle) -> Option<Session> {
    stop(&app)
}

/// The instant answer to "focus for 25 minutes" / "stop the focus session" (`fastlane`), or
/// None when the words are about something else.
pub fn answer(app: &AppHandle, keeper: &str, said: &str) -> Option<String> {
    use std::sync::OnceLock;
    static START: OnceLock<regex::Regex> = OnceLock::new();
    static STOP: OnceLock<regex::Regex> = OnceLock::new();
    let s = said.trim();
    if STOP.get_or_init(|| regex::Regex::new(STOPS).expect("pattern")).is_match(s) {
        return Some(match stop(app) {
            Some(ended) => format!("Focus session ended early, with {} of {} minutes left. Your reminders are back on.", minutes_left(&ended, time::now()), ended.minutes),
            None => "There's no focus session running.".into(),
        });
    }
    let captures = START.get_or_init(|| regex::Regex::new(STARTS).expect("pattern")).captures(s)?;
    let Some(minutes) = minutes_asked(&captures) else {
        return Some(format!("A focus session is between {MIN_MINUTES} and {MAX_MINUTES} minutes."));
    };
    Some(match start(app, keeper, minutes) {
        Ok(session) => format!("Focus session started: {} minutes. I'll hold your reminders until it ends.", session.minutes),
        Err(e) => e.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asked(said: &str) -> Option<Option<u32>> {
        regex::Regex::new(STARTS).unwrap().captures(said).map(|c| minutes_asked(&c))
    }

    #[test]
    fn the_words_that_start_and_stop_a_session() {
        assert_eq!(asked("start a focus session"), Some(Some(DEFAULT_MINUTES)));
        assert_eq!(asked("Focus for 40 minutes"), Some(Some(40)));
        assert_eq!(asked("let's do a pomodoro"), Some(Some(DEFAULT_MINUTES)));
        assert_eq!(asked("start a focus session for 50 min"), Some(Some(50)));
        assert_eq!(asked("focus for 500 minutes"), Some(None), "out of range is said, not started");
        assert_eq!(asked("help me focus on my essay about rivers"), None, "a real question goes to the mind");
        assert_eq!(asked("what is a pomodoro"), None);
        let stops = regex::Regex::new(STOPS).unwrap();
        assert!(stops.is_match("stop the focus session") && stops.is_match("End my pomodoro."));
        assert!(!stops.is_match("stop"));
    }

    #[test]
    fn minutes_left_round_up_and_never_go_below_zero() {
        let now = Utc::now();
        let s = Session { keeper: "k".into(), minutes: 25, started_at: time::iso(now), ends_at: time::iso(now + Duration::seconds(90)) };
        assert_eq!(minutes_left(&s, now), 2);
        assert_eq!(minutes_left(&s, now + Duration::minutes(5)), 0);
        assert!(done_line(25).contains("25 minutes"));
    }
}
