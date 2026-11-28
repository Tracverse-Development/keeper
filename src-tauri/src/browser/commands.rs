//! The window's side of Keeper's browser: open a page, place it, move in its history, close it.

use tauri::AppHandle;

use super::BrowserState;
use crate::kernel::Result;

/// Opens a web address inside Keeper (only http(s); a bare domain gets https).
#[tauri::command]
pub fn browser_open(app: AppHandle, url: String) -> Result<BrowserState> {
    super::open(&app, &url)
}

/// Where the window's frame for the page is (logical pixels; a zero size hides the page).
#[tauri::command]
pub fn browser_place(app: AppHandle, x: f64, y: f64, width: f64, height: f64) -> Result<()> {
    super::place(&app, x, y, width, height)
}

/// "back", "forward" or "reload".
#[tauri::command]
pub fn browser_go(app: AppHandle, how: String) -> Result<()> {
    super::go(&app, &how)
}

/// The person typed a password in Keeper's secure box: it goes into that one password field of
/// the page and nowhere else (never logged, never kept, never to the mind).
#[tauri::command]
pub async fn browser_password(app: AppHandle, field: String, value: String) -> Result<()> {
    super::page::password(&app, &field, &value).await
}

#[tauri::command]
pub fn browser_close(app: AppHandle) -> Result<BrowserState> {
    super::close(&app)
}

/// What the browser shows now (open or not, and the address).
#[tauri::command]
pub fn browser_state(app: AppHandle) -> BrowserState {
    super::state(&app)
}

/// Opens the page the browser shows in the person's own browser.
#[tauri::command]
pub fn browser_out(app: AppHandle) -> Result<()> {
    let now = super::state(&app);
    if !now.open {
        return Ok(());
    }
    crate::platform::open_url(&now.url)
}
