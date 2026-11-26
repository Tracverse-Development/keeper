//! Warm-up: start the processes the next turn will need before the person speaks, so it skips
//! the engine's start-up (Claude Code: 4.7 s cold → 0.9 s warm). Called when Keeper opens, when
//! the person switches keeper or comes back to the window, and after settings change; each turn
//! also starts the next spare itself (`brain::engines::claude::think`).

use tauri::State;

use crate::brain::engines::{claude, warm};
use crate::kernel::Result;
use crate::state::AppState;

use super::turn::base_context;

/// Warm the active (or given) keeper's brain and the quick helper model.
pub fn warm_keeper(state: &AppState, keeper_id: &str) {
    let Ok(keeper) = state.keeper_or_active(keeper_id) else { return };
    // What it says when touched, written for its mood before the first touch.
    super::touch::prepare(state, &keeper);
    if keeper.brain != "claude" {
        return;
    }
    // The common turn: a question in the person's usual showing mode ("" says nothing special).
    let ctx = base_context(state, &keeper, "");
    claude::warm_up(&ctx, &keeper.model);
    // Panel follow-ups and prepared scenes run on the helper model, talking, never acting.
    let helper = state.settings().fast_model;
    if !helper.is_empty() {
        claude::warm_up(&crate::brain::Context { may_act: false, visual: true, ..ctx }, &helper);
    }
}

/// The window asks for a warm-up (opening, switching keeper, coming back to the window).
/// Returns how many spares are ready.
#[tauri::command]
pub async fn assistant_warm(state: State<'_, AppState>, keeper: Option<String>) -> Result<usize> {
    warm_keeper(&state, keeper.as_deref().unwrap_or(""));
    Ok(warm::waiting())
}
