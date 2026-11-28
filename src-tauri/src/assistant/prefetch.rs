//! Prepared scenes: right after a lesson with cards arrives, the quick helper model quietly
//! prepares each card's scene (at most four, all at once) and keeps it in the scene cache, so
//! clicking "Addition" opens instantly instead of waiting for the engine. A click on a card still
//! being prepared waits for that preparation (`wait_if_preparing`) instead of starting another. Skipped when the person
//! turned it off, when there is no helper model, or when the keeper's brain is not Claude Code
//! (the helper runs through the same Claude Code sign-in).

use tauri::{AppHandle, Manager};

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use tokio::sync::watch;

use crate::brain::engines::claude;
use crate::brain::{Context, Progress};
use crate::kernel::settings::KeeperProfile;
use crate::memory::scene_cache::card_question;
use crate::memory::Fact;
use crate::stage::Panel;
use crate::state::AppState;

const MAX_PREPARED: usize = 4;
/// Longest a click waits for a preparation already running (then it asks the engine itself).
const WAIT_FOR_PREPARED: Duration = Duration::from_secs(12);

/// Questions being prepared now, by scene key, each with a flag that turns true when done (a
/// watch, not a one-shot notice: a click that looks just as it finishes still sees "done").
static PREPARING: Mutex<Option<HashMap<String, watch::Receiver<bool>>>> = Mutex::new(None);

fn preparing(key: &str) -> Option<watch::Receiver<bool>> {
    PREPARING.lock().ok()?.as_ref()?.get(key).cloned()
}

/// When this question is being prepared right now, wait for it (bounded), so the click is
/// answered from the scene cache instead of starting a second engine run for the same scene.
pub async fn wait_if_preparing(question: &str) {
    let Some(mut done) = preparing(&crate::memory::scene_cache::key(question)) else { return };
    let _ = tokio::time::timeout(WAIT_FOR_PREPARED, done.wait_for(|finished| *finished)).await;
}

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
    if crate::kernel::usage::over(settings.monthly_cap_usd) || !settings.prefetch_scenes || settings.fast_model.is_empty() || keeper.brain != "claude" || questions.is_empty() {
        return;
    }
    let (app, keeper, model) = (app.clone(), keeper.clone(), settings.fast_model.clone());
    tauri::async_runtime::spawn(async move {
        let state = app.state::<AppState>();
        let Ok(memory) = state.memory_for(&keeper) else { return };
        let mut runs = Vec::new();
        for question in questions {
            if matches!(memory.cached_scene(&question).await, Ok(Some(_))) {
                continue;
            }
            let key = crate::memory::scene_cache::key(&question);
            let (done, finished) = watch::channel(false);
            if let Ok(mut map) = PREPARING.lock() {
                map.get_or_insert_with(HashMap::new).insert(key.clone(), finished);
            }
            let (memory, keeper, identity, facts, model) = (memory.clone(), keeper.clone(), identity.clone(), facts.clone(), model.clone());
            runs.push(tauri::async_runtime::spawn(async move {
                let ctx = Context { said: question.clone(), assistant_name: keeper.name.clone(), identity, facts, recent: vec![], elsewhere: vec![], now_local: chrono::Local::now().format("%A %-d %B %Y").to_string(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None, page: None };
                if let Ok(thought) = claude::think(&ctx, &model, &|_: Progress| {}).await {
                    memory.cache_scene(&question, &thought.reply, &crate::stage::read(&thought.panels)).await;
                }
                if let Ok(mut map) = PREPARING.lock() {
                    map.get_or_insert_with(HashMap::new).remove(&key);
                }
                let _ = done.send(true);
            }));
        }
        for run in runs {
            let _ = run.await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_click_waits_for_the_preparation_running_and_no_longer() {
        let q = "About \"Blocks\": explain the card Addition.";
        let (done, finished) = watch::channel(false);
        PREPARING.lock().unwrap().get_or_insert_with(HashMap::new).insert(crate::memory::scene_cache::key(q), finished);
        let started = std::time::Instant::now();
        let finisher = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(80)).await;
            let _ = done.send(true);
        });
        wait_if_preparing(q).await;
        assert!(started.elapsed() >= Duration::from_millis(70) && started.elapsed() < Duration::from_secs(2), "{:?}", started.elapsed());
        finisher.await.unwrap();
        // Already finished: answered at once, never the full wait.
        let started = std::time::Instant::now();
        wait_if_preparing(q).await;
        assert!(started.elapsed() < Duration::from_millis(50));
        wait_if_preparing("nothing prepared").await;
    }

    #[test]
    fn each_card_of_a_lesson_is_prepared() {
        let panels = crate::stage::read(&serde_json::json!([{"kind": "cards", "title": "The four building blocks", "cards": [{"title": "Addition", "body": "b"}, {"title": "Subtraction", "body": "b"}]}]));
        let q = questions(&panels);
        assert_eq!(q.len(), 2);
        assert!(q[0].starts_with("About \"The four building blocks\": explain the card Addition."));
    }
}
