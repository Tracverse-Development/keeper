//! The window's side of a draft panel: load the draft, change its text by hand, save it, or
//! throw it away. `draft_save` is the only path that writes the person's file, and it records
//! the save on the keeper's graph as a `desk:Action` ("save-file").

use serde::Serialize;
use tauri::State;

use super::{DraftView, Drafts};
use crate::kernel::{time, Result};
use crate::memory::ActionRecord;
use crate::state::AppState;

/// A saved file: where it is now (the window shows it as a file panel: Open, Show in Finder).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub path: String,
    pub name: String,
    pub folder: String,
}

/// The draft as the panel draws it.
#[tauri::command]
pub fn draft_view(draft: String) -> Result<DraftView> {
    Ok(Drafts::here().get(&draft)?.view())
}

/// The person changed the proposed text in the panel; the new view comes back.
#[tauri::command]
pub fn draft_edit(draft: String, text: String) -> Result<DraftView> {
    Ok(Drafts::here().edit(&draft, &text)?.view())
}

/// Saves the draft over its file (refused when the file changed since the draft opened).
#[tauri::command]
pub fn draft_save(state: State<'_, AppState>, keeper: Option<String>, draft: String) -> Result<Saved> {
    let saved = Drafts::here().save(&draft)?;
    let (name, folder) = super::name_and_folder(&saved.path);
    let summary = match &saved.why {
        Some(why) => format!("Saved {name} ({why})."),
        None => format!("Saved {name}."),
    };
    // The record names the file, never its text.
    if let Ok(memory) = state.keeper_or_active(keeper.as_deref().unwrap_or("")).and_then(|k| state.memory_for(&k)) {
        memory.write_soon(&ActionRecord::new("save-file", &format!("{folder}/{name}"), &summary, true, &time::now_iso(), ""));
    }
    Ok(Saved { path: saved.path, name, folder })
}

/// Throws the draft away; the file is untouched.
#[tauri::command]
pub fn draft_discard(draft: String) -> Result<()> {
    Drafts::here().discard(&draft)
}
