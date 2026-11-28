//! The window's side of Keeper's file viewer.

use tauri::AppHandle;

use super::{Listing, Preview};
use crate::kernel::Result;

/// A folder's entries (newest first).
#[tauri::command]
pub fn files_list(path: String) -> Result<Listing> {
    super::list(&path)
}

/// What a file looks like.
#[tauri::command]
pub async fn files_preview(app: AppHandle, path: String) -> Result<Preview> {
    let real = super::place(&path)?;
    super::preview::preview(&app, &real).await
}

/// A text file opened for editing in Keeper: a draft panel (saved only by the person's Save).
#[tauri::command]
pub fn files_edit(path: String) -> Result<crate::stage::Panel> {
    let real = super::place(&path)?;
    Ok(crate::sdk::drafts::Drafts::here().open(&real.display().to_string(), None, None)?.panel())
}
