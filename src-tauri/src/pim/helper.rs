//! Calendar and contacts through the Swift helper (`native/voice/pim.swift`: EventKit and the
//! Contacts framework), asked with `Voice::ask` and answered by one reply per request. Every
//! input is validated here before it reaches the helper; the helper validates again.
//!
//! The helper is reached through the app's live state (`AppState::voice`), so these functions
//! take the `AppHandle` (the same way `phone` reaches the assistant).

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use super::{Access, Contact, Event};
use crate::kernel::{time, DeskError, Result};
use crate::state::AppState;

/// Asking for permission waits on the person reading two system dialogs.
const REQUEST_TIME: Duration = Duration::from_secs(120);
/// The longest span of events one request may read.
const MAX_SPAN_DAYS: i64 = 366;
pub const MAX_TITLE: usize = 200;
pub const MAX_NAME: usize = 100;
pub const MAX_CONTACTS: usize = 50;

async fn ask(app: &AppHandle, command: Value, within: Option<Duration>) -> Result<Value> {
    let state = app.try_state::<AppState>().ok_or_else(|| DeskError::Io("Keeper is still starting.".into()))?;
    match within {
        Some(t) => state.voice.ask_within(app, command, t).await,
        None => state.voice.ask(app, command).await,
    }
}

/// The helper's words for a permission ("allowed", "denied", "notasked"); anything else reads
/// as not asked, so an unknown answer never claims access.
pub fn access_from(word: &Value) -> Access {
    serde_json::from_value::<Access>(word.clone()).unwrap_or(Access::NotAsked)
}

fn pair(reply: &Value) -> (Access, Access) {
    (access_from(&reply["calendar"]), access_from(&reply["contacts"]))
}

/// A helper that is missing or silent cannot reach the calendar or contacts on this build.
fn pair_or_unsupported(reply: Result<Value>) -> (Access, Access) {
    reply.map(|r| pair(&r)).unwrap_or((Access::Unsupported, Access::Unsupported))
}

pub async fn access(app: &AppHandle) -> (Access, Access) {
    pair_or_unsupported(ask(app, json!({ "cmd": "pim-access" }), None).await)
}

pub async fn request_access(app: &AppHandle) -> (Access, Access) {
    pair_or_unsupported(ask(app, json!({ "cmd": "pim-request" }), Some(REQUEST_TIME)).await)
}

/// `from` and `to` as RFC 3339, `from` before `to`, at most a year apart.
pub fn check_span(from: &str, to: &str) -> Result<()> {
    let (Some(a), Some(b)) = (time::parse_iso(from), time::parse_iso(to)) else {
        return Err(DeskError::Invalid("Those times aren't dates I can read.".into()));
    };
    if b <= a {
        return Err(DeskError::Invalid("The end has to come after the start.".into()));
    }
    if (b - a).num_days() > MAX_SPAN_DAYS {
        return Err(DeskError::Invalid("I can read at most a year of the calendar at once.".into()));
    }
    Ok(())
}

pub async fn events(app: &AppHandle, from: &str, to: &str) -> Result<Vec<Event>> {
    check_span(from, to)?;
    let reply = ask(app, json!({ "cmd": "events", "from": from, "to": to }), None).await?;
    Ok(serde_json::from_value(reply["events"].clone())?)
}

pub async fn create_event(app: &AppHandle, title: &str, start: &str, end: &str) -> Result<Event> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > MAX_TITLE {
        return Err(DeskError::Invalid(format!("An event needs a title of up to {MAX_TITLE} characters.")));
    }
    check_span(start, end)?;
    let reply = ask(app, json!({ "cmd": "event-create", "title": title, "start": start, "end": end }), None).await?;
    Ok(serde_json::from_value(reply["event"].clone())?)
}

pub async fn find_contacts(app: &AppHandle, name: &str, limit: usize) -> Result<Vec<Contact>> {
    let name: String = name.chars().filter(|c| !c.is_control()).collect();
    let name = name.trim();
    if name.is_empty() || name.chars().count() > MAX_NAME {
        return Err(DeskError::Invalid("Tell me whose name to look for.".into()));
    }
    let limit = limit.clamp(1, MAX_CONTACTS);
    let reply = ask(app, json!({ "cmd": "contacts", "name": name, "limit": limit }), None).await?;
    Ok(serde_json::from_value(reply["contacts"].clone())?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn access_words_map_and_unknown_never_claims_access() {
        assert_eq!(access_from(&json!("allowed")), Access::Allowed);
        assert_eq!(access_from(&json!("denied")), Access::Denied);
        assert_eq!(access_from(&json!("notasked")), Access::NotAsked);
        assert_eq!(access_from(&json!("writeonly")), Access::NotAsked);
        assert_eq!(access_from(&Value::Null), Access::NotAsked);
        assert_eq!(pair_or_unsupported(Err(DeskError::Io("gone".into()))), (Access::Unsupported, Access::Unsupported));
        assert_eq!(pair(&json!({ "calendar": "allowed", "contacts": "denied" })), (Access::Allowed, Access::Denied));
    }

    #[test]
    fn spans_must_be_readable_ordered_and_bounded() {
        assert!(check_span("2026-11-25T09:00:00Z", "2026-11-25T10:00:00-05:00").is_ok());
        assert!(check_span("tomorrow", "2026-11-25T10:00:00Z").is_err());
        assert!(check_span("2026-11-25T10:00:00Z", "2026-11-25T09:00:00Z").is_err());
        assert!(check_span("2026-01-01T00:00:00Z", "2027-06-01T00:00:00Z").is_err());
    }

    #[test]
    fn helper_replies_parse_into_the_contract_types() {
        let e: Vec<Event> = serde_json::from_value(json!([{ "title": "Call", "start": "2026-11-25T14:00:00Z", "end": "2026-11-25T15:00:00Z", "allDay": false, "location": "", "calendar": "Work" }])).unwrap();
        assert_eq!(e[0].calendar, "Work");
        let c: Vec<Contact> = serde_json::from_value(json!([{ "name": "Ada", "phones": ["+1 555"], "emails": [], "birthday": "" }])).unwrap();
        assert_eq!(c[0].phones, ["+1 555"]);
    }
}
