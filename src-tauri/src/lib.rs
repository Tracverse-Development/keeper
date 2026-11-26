//! Keeper's core: the composition root. It builds each module's live object once
//! (`state::AppState`), wires the reminder clock to the voice and the window, and lists the
//! commands the window may call. Module map: ARCHITECTURE.md.

mod assistant;
mod backup;
mod brain;
mod commands;
mod dkg;
mod fastlane;
mod feelings;
mod focus;
mod health;
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
    // A crash is written down before the app ends (kernel::log).
    kernel::log::catch_panics();
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
                    // A repeating reminder is written again for its next time, in its keeper's memory.
                    skills::reminder_actions::come_round(&state, &reminder).await;
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
                // One home context graph with sub-graphs: move what is still in the old graphs.
                // Writes still waiting from before go to their old place first, so the move takes them along.
                if let Ok(client) = state.client() {
                    crate::memory::outbox::flush(&client).await;
                }
                crate::memory::relocate::settle(&state).await;
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
                // What came due while Keeper was closed is said once (and finished) before the
                // reminders still ahead are scheduled.
                let mut missed = Vec::new();
                let closed_at = skills::reminder_actions::last_alive();
                for keeper in state.settings().keepers {
                    missed.extend(skills::reminder_actions::settle_missed(&state, &keeper.id, closed_at).await);
                }
                // From here on Keeper notes once a minute that it is running.
                tauri::async_runtime::spawn(async {
                    loop {
                        skills::reminder_actions::mark_alive();
                        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                    }
                });
                if let Some(line) = skills::reminder_actions::missed_words(&missed) {
                    platform::notify("Keeper", &line);
                    let _ = app_handle.emit(events::ASSISTANT_SAYS, json!({ "text": line, "reason": "reminder" }));
                }
                for keeper in state.settings().keepers {
                    if let Ok(memory) = state.memory_for(&keeper) {
                        for r in memory.upcoming_reminders().await.unwrap_or_default() {
                            let repeat = r.repeat.clone();
                            state.reminders.schedule(r.repeating(&repeat, &keeper.id));
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
            assistant::touch::keeper_touch,
            assistant::attach::attach_peek,
            commands::usage_month,
            commands::child_profile,
            commands::child_profile_set,
            skills::reminder_actions::reminder_cancel,
            memory::chats::chat_change,
            memory::chats::chats_search,
            commands::memory_restore_fact,
            updater::whats_new::whats_new,
            updater::whats_new::whats_new_seen,
            keepers::kit_commands::pack_check,
            health::health_check,
            health::health_fix,
            health::support_report,
            focus::focus_state,
            focus::focus_stop,
            backup::backup_save,
            backup::backup_restore,
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
            keepers::season_commands::season_now,
            keepers::season_commands::season_claim,
            keepers::wardrobe_commands::wardrobe_list,
            keepers::wardrobe_commands::wardrobe_design,
            keepers::wardrobe_commands::wardrobe_share,
            keepers::studio_commands::keeper_studio,
            keepers::studio_commands::keeper_feelings,
            keepers::studio_commands::feelings_reset,
            keepers::studio_commands::personal_set,
            keepers::studio_commands::personal_remove,
            keepers::studio_commands::personal_list,
            keepers::studio_commands::card_save,
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
