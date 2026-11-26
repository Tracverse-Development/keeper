//! What the person does in a panel, written back to the keeper's graph (`memory::panel_events`):
//! ticks, quiz answers (with the current streak returned for a celebration), flashcards, form
//! submissions, forgetting and pinning facts. The window's `PanelAction` mirrors `Action`.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::kernel::{DeskError, Result};
use crate::memory::panel_events::PanelEvent;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", rename_all_fields = "camelCase")]
pub enum Action {
    Check { panel_title: String, text: String, done: bool },
    Submit { panel_title: String, values: std::collections::BTreeMap<String, String> },
    Quiz { question: String, correct: bool },
    Card { front: String, known: bool },
    Forget { fact_id: String },
    Pin { fact_id: String },
}

#[derive(Debug, Serialize)]
pub struct ActionDone {
    /// Right quiz answers in a row (after a quiz answer), for a celebration.
    pub streak: u32,
}

fn yes(b: bool) -> &'static str {
    if b { "yes" } else { "no" }
}

fn fact_id(id: &str) -> Result<String> {
    if id.len() == 16 && id.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(id.to_string())
    } else {
        Err(DeskError::Invalid("That isn't a fact.".into()))
    }
}

#[tauri::command]
pub async fn stage_action(state: State<'_, AppState>, keeper: Option<String>, action: Action) -> Result<ActionDone> {
    let memory = state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?;
    // Instant: hot memory changes now and the node is written in the background (write_soon),
    // so a tick, an answer or a pin never waits on the DKG (it took 50-300 ms per action).
    let mut streak = 0;
    match action {
        Action::Check { panel_title, text, done } => memory.write_soon(&PanelEvent::new("check", &panel_title, &text, yes(done))),
        Action::Submit { panel_title, values } => memory.write_soon(&PanelEvent::new("submit", &panel_title, "form", &serde_json::to_string(&values)?)),
        Action::Quiz { question, correct } => {
            memory.write_soon(&PanelEvent::new("quiz", "quiz", &question, yes(correct)));
            streak = memory.streak().await;
        }
        Action::Card { front, known } => memory.write_soon(&PanelEvent::new("card", "flashcards", &front, yes(known))),
        Action::Forget { fact_id: id } => {
            let (memory, id) = (memory.clone(), fact_id(&id)?);
            memory.forget_now(&id);
            tauri::async_runtime::spawn(async move {
                memory.erase_fact(&id).await;
            });
        }
        Action::Pin { fact_id: id } => memory.write_soon(&PanelEvent::new("pin", "facts", "pin", &fact_id(&id)?)),
    };
    Ok(ActionDone { streak })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn actions_read_the_windows_shape() {
        let a: Action = serde_json::from_str(r#"{"type":"check","panelId":"p","panelTitle":"Packing","itemId":"i","text":"Passport","done":true}"#).unwrap();
        assert!(matches!(a, Action::Check { done: true, .. }));
        let q: Action = serde_json::from_str(r#"{"type":"quiz","panelId":"p","question":"7 x 8?","correct":false}"#).unwrap();
        assert!(matches!(q, Action::Quiz { correct: false, .. }));
        assert!(fact_id("../x").is_err());
    }
}
