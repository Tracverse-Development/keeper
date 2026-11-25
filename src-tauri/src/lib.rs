//! Keeper's core: the composition root. It builds each module's live object once
//! (`state::AppState`), wires the reminder clock to the voice and the window, and lists the
//! commands the window may call. Module map: ARCHITECTURE.md.

mod assistant;
mod brain;
mod commands;
mod dkg;
mod kernel;
mod memory;
mod phone;
mod platform;
mod setup;
mod skills;
mod state;
mod updater;
mod voice;

use serde_json::json;
use tauri::{Emitter, Manager};

use kernel::{events, settings::Settings};
use skills::reminders::Scheduler;
use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let reminders = Scheduler::new(move |reminder| {
                let app = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<AppState>();
                    let line = format!("A reminder: {}.", reminder.text.trim_end_matches('.'));
                    platform::notify("Keeper", &line);
                    let _ = app.emit(events::ASSISTANT_SAYS, json!({ "text": line, "reason": "reminder" }));
                    let _ = state.voice.speak(&app, &line, &state.settings()).await;
                });
            });
            let state = AppState::new(Settings::load(), reminders);
            app.manage(state);

            updater::spawn_auto(app.handle().clone());

            // Reminders live on the DKG: reload the ones still ahead and schedule them again.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                if let Ok(memory) = state.memory() {
                    for r in memory.upcoming_reminders().await.unwrap_or_default() {
                        state.reminders.schedule(r);
                    }
                }
                if state.settings().setup_complete && state.settings().always_listening {
                    let _ = state.voice.listen_always(&app_handle).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            assistant::assistant_turn,
            setup::setup_scan,
            setup::setup_install_node,
            setup::setup_create_graph,
            setup::setup_finish,
            commands::app_settings,
            commands::save_settings,
            commands::memory_overview,
            commands::memory_forget_fact,
            commands::voice_authorize,
            commands::voice_listen_once,
            commands::voice_stop,
            commands::voice_speak,
            commands::voice_hush,
            commands::voice_list,
            commands::engines_list,
            commands::eleven_set_key,
            commands::eleven_voices,
            phone::phone_status,
            phone::phone_start,
            phone::phone_stop,
            updater::update_check,
            updater::app_restart,
        ])
        .run(tauri::generate_context!())
        .expect("Keeper failed to start");
}
