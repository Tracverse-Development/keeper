//! Auto-update: the app checks its GitHub releases (`latest.json`, signed with the updater key;
//! the public half is in tauri.conf.json) at launch and every few hours while auto-update is on,
//! installs a newer signed version in the background, and tells the window, which offers a
//! restart. "Check for updates" in Settings does the same on demand. An update whose signature
//! does not match is refused by the updater itself.

use std::time::Duration;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;

use crate::kernel::{events, DeskError, Result};
use crate::state::AppState;

const EVERY: Duration = Duration::from_secs(6 * 3600);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current: String,
    /// The newer version that was installed (restart to use it), or None when up to date.
    pub installed: Option<String>,
}

/// Check, and install when there is something newer.
pub async fn check_and_install(app: &AppHandle) -> Result<UpdateStatus> {
    let current = app.package_info().version.to_string();
    let updater = app.updater().map_err(|e| DeskError::Io(format!("The updater is not set up: {e}")))?;
    let Some(update) = updater.check().await.map_err(|e| DeskError::Io(format!("Could not check for updates: {e}")))? else {
        return Ok(UpdateStatus { current, installed: None });
    };
    let version = update.version.clone();
    update.download_and_install(|_, _| {}, || {}).await.map_err(|e| DeskError::Io(format!("The update did not install: {e}")))?;
    let _ = app.emit(events::APP_UPDATE, json!({ "version": version }));
    Ok(UpdateStatus { current, installed: Some(version) })
}

/// The background schedule (only while auto-update is on; read fresh each time).
pub fn spawn_auto(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if app.state::<AppState>().settings().auto_update {
                let _ = check_and_install(&app).await;
            }
            tokio::time::sleep(EVERY).await;
        }
    });
}

#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<UpdateStatus> {
    check_and_install(&app).await
}

#[tauri::command]
pub fn app_restart(app: AppHandle, state: State<'_, AppState>) {
    state.phone.stop();
    app.restart();
}
