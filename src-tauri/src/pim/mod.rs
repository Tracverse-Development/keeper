//! PIM: the person's own information on this computer: files (Spotlight search, recently
//! changed), calendar events and contacts (through the Swift helper's EventKit and Contacts
//! access). Everything is read on this computer and never sent anywhere; what a keeper does with
//! it is recorded on the DKG like any other action.
//!
//! This file is the CONTRACT the rest of the core calls (fast answers, the morning brief, skills).
//! The implementations live in the submodules: `files` (Spotlight through `platform`), `kind`
//! (file kinds), `helper` (calendar and contacts through the Swift helper), `commands` (the
//! window's `pim::commands::pim_access` / `pim::commands::pim_request_access`).
//!
//! The calendar and contacts functions take the `AppHandle` as their first argument: the Swift
//! helper is a live process owned by `AppState::voice`, and the handle is how a caller anywhere
//! in the core reaches it (no global). Files need no handle. On systems other than macOS the
//! files functions still work where they can (recent files walk the folders), calendar and
//! contacts say so in plain words, and access answers `Unsupported`.

pub mod commands;
mod files;
mod helper;
mod kind;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::kernel::Result;
#[cfg(not(target_os = "macos"))]
use crate::kernel::DeskError;

/// A file found on this computer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileHit {
    pub path: String,
    pub name: String,
    /// "folder", "pdf", "document", "image", "presentation", "spreadsheet", "app", "other".
    pub kind: String,
    /// When it last changed (RFC 3339), when known.
    pub modified: String,
}

/// A calendar event.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub title: String,
    /// RFC 3339 start and end.
    pub start: String,
    pub end: String,
    pub all_day: bool,
    pub location: String,
    pub calendar: String,
}

/// A contact (only the fields an assistant needs).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub name: String,
    pub phones: Vec<String>,
    pub emails: Vec<String>,
    pub birthday: String,
}

/// Whether the person has allowed access (asked once, up front, in the installer).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Access {
    Allowed,
    Denied,
    NotAsked,
    Unsupported,
}

#[cfg(not(target_os = "macos"))]
fn unsupported() -> DeskError {
    DeskError::Invalid("Calendars and contacts are not supported on this system yet.".into())
}

/// Files whose name or content match `query` (Spotlight), best first, at most `limit` (1 to 50).
pub async fn find_files(query: &str, limit: usize) -> Result<Vec<FileHit>> {
    files::find(query, limit).await
}

/// Files changed in the last `days` days in the person's Desktop, Documents and Downloads,
/// newest first, at most `limit` (1 to 50).
pub async fn recent_files(days: u32, limit: usize) -> Result<Vec<FileHit>> {
    files::recent(days, limit).await
}

/// Calendar events between two RFC 3339 instants (at most a year apart).
pub async fn events(app: &AppHandle, from: &str, to: &str) -> Result<Vec<Event>> {
    #[cfg(target_os = "macos")]
    return helper::events(app, from, to).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, from, to);
        Err(unsupported())
    }
}

/// Add an event to the default calendar; returns the event as saved.
pub async fn create_event(app: &AppHandle, title: &str, start: &str, end: &str) -> Result<Event> {
    #[cfg(target_os = "macos")]
    return helper::create_event(app, title, start, end).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, title, start, end);
        Err(unsupported())
    }
}

/// Contacts whose name matches `name`, at most `limit` (1 to 50).
pub async fn find_contacts(app: &AppHandle, name: &str, limit: usize) -> Result<Vec<Contact>> {
    #[cfg(target_os = "macos")]
    return helper::find_contacts(app, name, limit).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, name, limit);
        Err(unsupported())
    }
}

/// Calendar and contacts access as (calendar, contacts), without asking.
pub async fn access(app: &AppHandle) -> (Access, Access) {
    #[cfg(target_os = "macos")]
    return helper::access(app).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        (Access::Unsupported, Access::Unsupported)
    }
}

/// Ask for calendar (full access) and contacts access: the installer's Permissions step. Waits
/// for the person to answer the system dialogs (up to two minutes).
pub async fn request_access(app: &AppHandle) -> (Access, Access) {
    #[cfg(target_os = "macos")]
    return helper::request_access(app).await;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        (Access::Unsupported, Access::Unsupported)
    }
}
