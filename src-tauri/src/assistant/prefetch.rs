//! Prepared scenes: right after a lesson with cards arrives, the quick helper model quietly
//! prepares each card's scene (at most four, one at a time) and keeps it in the scene cache, so
//! clicking "Addition" opens instantly instead of waiting for the engine. Skipped when the person
//! turned it off, when there is no helper model, or when the keeper's brain is not Claude Code
//! (the helper runs through the same Claude Code sign-in).

use tauri::{AppHandle, Manager};

use crate::brain::engines::claude;
use crate::brain::{Context, Progress};
use crate::kernel::settings::KeeperProfile;
use crate::memory::scene_cache::card_question;
use crate::memory::Fact;
use crate::stage::Panel;
use crate::state::AppState;

const MAX_PREPARED: usize = 4;

/// The questions worth preparing: each card of the first cards panel.
pub fn questions(panels: &[Panel]) -> Vec<String> {
    panels
        .iter()
        .find_map(|p| match p {
            Panel::Cards { title, cards, .. } => Some(cards.iter().take(MAX_PREPARED).map(|c| card_question(title, &c.title)).collect()),
            _ => None,
        })
        .unwrap_or_default()
}

pub fn spawn(app: &AppHandle, keeper: &KeeperProfile, identity: String, facts: Vec<Fact>, panels: &[Panel]) {
    let state = app.state::<AppState>();
    let settings = state.settings();
    let questions = questions(panels);
    if !settings.prefetch_scenes || settings.fast_model.is_empty() || keeper.brain != "claude" || questions.is_empty() {
        return;
    }
    let (app, keeper, model) = (app.clone(), keeper.clone(), settings.fast_model.clone());
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        let Ok(memory) = state.memory_for(&keeper) else { return };
        for question in questions {
            if matches!(memory.cached_scene(&question).await, Ok(Some(_))) {
                continue;
            }
            let ctx = Context { said: question.clone(), assistant_name: keeper.name.clone(), identity: identity.clone(), facts: facts.clone(), recent: vec![], now_local: chrono::Local::now().format("%A %-d %B %Y").to_string(), may_act: false, visual: true, guard: None };
            if let Ok(thought) = claude::think(&ctx, &model, &|_: Progress| {}).await {
                memory.cache_scene(&question, &thought.reply, &crate::stage::read(&thought.panels)).await;
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_card_of_a_lesson_is_prepared() {
        let panels = crate::stage::read(&serde_json::json!([{"kind": "cards", "title": "The four building blocks", "cards": [{"title": "Addition", "body": "b"}, {"title": "Subtraction", "body": "b"}]}]));
        let q = questions(&panels);
        assert_eq!(q.len(), 2);
        assert!(q[0].starts_with("About \"The four building blocks\": explain the card Addition."));
    }
}
