//! Keeper's core: the composition root. It builds each module's live object once
//! (`state::AppState`), wires the reminder clock to the voice and the window, and lists the
//! commands the window may call. Module map: ARCHITECTURE.md.

mod assistant;
mod brain;
mod commands;
mod dkg;
mod fastlane;
mod feelings;
mod hotkey;
mod keepers;
mod kernel;
mod memory;
mod phone;
mod pim;
mod platform;
mod setup;
mod skills;
mod stage;
mod state;
mod system;
mod updater;
mod voice;

use serde_json::json;
use tauri::{Emitter, Manager, WindowEvent};
#[cfg(target_os = "macos")]
use tauri::RunEvent;

use kernel::{events, settings::Settings};
use skills::reminders::Scheduler;
use state::AppState;

/// `keeper --look-guard`: answer one Claude Code PreToolUse request and exit (DESK-LOOK-DENY-001).
pub fn look_guard_hook() {
    brain::look_hook::run_hook();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(hotkey::plugin())
        .setup(|app| {
            let handle = app.handle().clone();
            let reminders = Scheduler::new(move |reminder| {
                let app = handle.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<AppState>();
                    let line = format!("A reminder: {}.", reminder.text.trim_end_matches('.'));
                    platform::notify("Keeper", &line);
                    let _ = app.emit(events::ASSISTANT_SAYS, json!({ "text": line, "reason": "reminder" }));
                    let _ = state.voice.speak(&app, &line, &state.settings().speaking_as_active(), false).await;
                });
            });
            let state = AppState::new(Settings::load(), reminders);
            app.manage(state);

            updater::spawn_auto(app.handle().clone());

            // The keeper button (push to talk); a taken shortcut is reported in Settings, not fatal.
            let _ = hotkey::apply(app.handle(), &app.state::<AppState>().settings().talk_shortcut);

            // Reminders live on the DKG: reload every keeper's reminders still ahead.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                state.refresh_souls().await;
                // Each keeper's level as Keeper opens, so the first message that crosses a level celebrates.
                for keeper in state.settings().keepers {
                    if let Ok(memory) = state.memory_for(&keeper) {
                        if let Some(e) = crate::keepers::kit::levels::experience(&memory).await {
                            crate::keepers::kit::levels::record_level(&keeper.id, e.level);
                        }
                    }
                }
                // Idle engine spares past their age are ended, not left holding memory.
                crate::brain::engines::warm::spawn_sweeper();
                // Keep watching it: restart it if it stops, send what waited in the outbox.
                let watched = app_handle.clone();
                crate::dkg::own_node::watch(move || watched.state::<AppState>().settings().node_home);
                // Keeper's own memory node does not survive a reboot by itself: start it (FIX-0009).
                if let Err(e) = crate::dkg::own_node::ensure_running(&state.settings().node_home).await {
                    let _ = app_handle.emit(events::ASSISTANT_SAYS, json!({ "text": format!("I couldn't start my memory node: {e}"), "reason": "node" }));
                }
                // Testing only: KEEPER_TEST_LINK=1 opens the phone link at launch and writes its
                // address to a private file, so a test harness can send real turns. Never set in
                // normal use; the link still needs its random token.
                if std::env::var_os("KEEPER_TEST_LINK").is_some() {
                    if let Ok(status) = state.phone.start(&app_handle) {
                        let _ = crate::kernel::paths::write_private(&crate::kernel::paths::app_home().join("test-link.txt"), status.url.as_bytes());
                    }
                }
                // The first turn should not pay the engine's start-up either.
                if state.settings().setup_complete {
                    assistant::warm::warm_keeper(&state, "");
                }
                for keeper in state.settings().keepers {
                    if let Ok(memory) = state.memory_for(&keeper) {
                        for r in memory.upcoming_reminders().await.unwrap_or_default() {
                            state.reminders.schedule(r);
                        }
                    }
                }
                if state.settings().setup_complete && state.settings().always_listening {
                    let _ = state.voice.listen_always(&app_handle).await;
                }
            });
            Ok(())
        })
        // Closing the main window hides it: Keeper keeps listening, reminding and answering the
        // keeper button and the phone; the Dock icon brings it back.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            assistant::assistant_turn,
            assistant::brief_today,
            assistant::warm::assistant_warm,
            assistant::assistant_cancel,
            setup::remove::setup_remove,
            brain::engines::setup::engine_setup,
            brain::engines::setup::engine_sign_in,
            pim::commands::pim_access,
            memory::pinned_scenes::scenes_pinned,
            memory::pinned_scenes::scene_pin,
            memory::pinned_scenes::scene_unpin,
            pim::commands::pim_request_access,
            assistant::actions::stage_action,
            assistant::approval::plan_decide,
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
            commands::voice_try,
            commands::voice_hush,
            commands::voice_list,
            commands::engines_list,
            commands::chats_list,
            commands::chat_delete,
            commands::chat_turns,
            commands::catalog_list,
            commands::catalog_run,
            keepers::keepers_list,
            keepers::keepers_create,
            keepers::keepers_activate,
            keepers::keepers_update,
            keepers::keepers_remove,
            keepers::kit_commands::kit_catalog,
            keepers::kit_commands::modes_save,
            keepers::kit_commands::modes_reset,
            keepers::kit_commands::modes_list,
            keepers::kit_commands::skills_list,
            keepers::kit_commands::souls_save,
            keepers::kit_commands::pack_export,
            keepers::kit_commands::pack_import,
            keepers::wardrobe_commands::wardrobe_list,
            keepers::wardrobe_commands::wardrobe_design,
            keepers::wardrobe_commands::wardrobe_share,
            keepers::studio_commands::keeper_studio,
            keepers::studio_commands::keeper_feelings,
            keepers::studio_commands::feelings_reset,
            keepers::studio_commands::personal_set,
            keepers::studio_commands::personal_remove,
            keepers::studio_commands::personal_list,
            keepers::wardrobe_commands::wardrobe_wear,
            keepers::wardrobe_commands::wardrobe_take_off,
            keepers::wardrobe_commands::wardrobe_give,
            keepers::wardrobe_commands::wardrobe_add,
            system::system_load,
            system::system_live,
            stage::open::stage_open,
            hotkey::talk_hide,
            hotkey::talk_shortcut_status,
            setup::setup_folders,
            commands::eleven_set_key,
            commands::eleven_voices,
            phone::phone_status,
            phone::phone_start,
            phone::phone_stop,
            updater::update_check,
            updater::app_restart,
        ])
        .build(tauri::generate_context!())
        .expect("Keeper failed to start")
        .run(|app, event| {
            // Clicking the Dock icon brings the hidden window back (macOS only; elsewhere the
            // tray/taskbar entry does it and this event does not exist).
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
