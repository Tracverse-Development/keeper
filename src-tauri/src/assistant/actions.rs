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
    let mut streak = 0;
    match action {
        Action::Check { panel_title, text, done } => memory.write(&PanelEvent::new("check", &panel_title, &text, yes(done))).await,
        Action::Submit { panel_title, values } => memory.write(&PanelEvent::new("submit", &panel_title, "form", &serde_json::to_string(&values)?)).await,
        Action::Quiz { question, correct } => {
            let r = memory.write(&PanelEvent::new("quiz", "quiz", &question, yes(correct))).await;
            streak = memory.streak().await;
            r
        }
        Action::Card { front, known } => memory.write(&PanelEvent::new("card", "flashcards", &front, yes(known))).await,
        Action::Forget { fact_id: id } => memory.erase_fact(&fact_id(&id)?).await,
        Action::Pin { fact_id: id } => memory.write(&PanelEvent::new("pin", "facts", "pin", &fact_id(&id)?)).await,
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
