//! The keeper button: a global push-to-talk shortcut (default ⌥Space, set in Settings). Hold it
//! and a small talk window appears at the bottom of the screen and Keeper listens; let go and
//! what was said goes to the active keeper ("Hey <name>" in what you say picks another keeper).
//! The window shows the words as they are heard, then the reply, and hides itself afterwards.

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::kernel::{DeskError, Result};
use crate::state::AppState;

pub const TALK_WINDOW: &str = "talk";
const WIDTH: f64 = 480.0;
const HEIGHT: f64 = 150.0;

/// The plugin, with the handler for press and release.
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            let app = app.clone();
            let pressed = event.state() == ShortcutState::Pressed;
            tauri::async_runtime::spawn(async move {
                let state = app.state::<AppState>();
                if pressed {
                    show_talk_window(&app);
                    let _ = state.voice.hush(&app).await;
                    let _ = state.voice.listen_once(&app).await;
                } else {
                    let _ = state.voice.finish(&app).await;
                }
            });
        })
        .build()
}

/// A shortcut is modifiers + a key ("Alt+Space", "Ctrl+Shift+K", "F5"); empty turns it off.
pub fn parse(text: &str) -> Result<Option<Shortcut>> {
    let t = text.trim();
    if t.is_empty() {
        return Ok(None);
    }
    t.parse::<Shortcut>().map(Some).map_err(|_| DeskError::Invalid(format!("\"{t}\" isn't a shortcut I can use. Try something like Alt+Space.")))
}

/// Register the shortcut (replacing any earlier one).
pub fn apply(app: &AppHandle, text: &str) -> Result<()> {
    let shortcut = parse(text)?;
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    if let Some(s) = shortcut {
        gs.register(s).map_err(|e| DeskError::Invalid(format!("That shortcut is taken by another app ({e}).")))?;
    }
    Ok(())
}

fn show_talk_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(TALK_WINDOW) {
        let _ = w.show();
        return;
    }
    let mut builder = WebviewWindowBuilder::new(app, TALK_WINDOW, WebviewUrl::App("index.html".into()))
        .title("Keeper")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .background_color(tauri::window::Color(11, 16, 32, 255));
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let size = monitor.size();
        let (w, h) = (size.width as f64 / scale, size.height as f64 / scale);
        builder = builder.position((w - WIDTH) / 2.0, h - HEIGHT - 110.0);
    }
    let _ = builder.build();
}

#[tauri::command]
pub fn talk_hide(app: AppHandle) {
    if let Some(w) = app.get_webview_window(TALK_WINDOW) {
        let _ = w.hide();
    }
}

#[derive(Debug, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

#[tauri::command]
pub fn talk_shortcut_status(app: AppHandle, state: State<'_, AppState>) -> ShortcutStatus {
    let shortcut = state.settings().talk_shortcut;
    let registered = parse(&shortcut).ok().flatten().is_some_and(|s| app.global_shortcut().is_registered(s));
    ShortcutStatus { shortcut, registered }
}

#[cfg(test)]
mod tests {
    #[test]
    fn shortcuts_parse_or_explain() {
        assert!(super::parse("Alt+Space").unwrap().is_some());
        assert!(super::parse("CommandOrControl+Shift+K").unwrap().is_some());
        assert!(super::parse("").unwrap().is_none());
        assert!(super::parse("banana").is_err());
    }
}
