//! Where a turn's answer comes from: a Chain of Responsibility, cheapest first.
//! 1. `fastlane`  an instant answer with no AI (find my file, open a folder, the brief, my facts)
//! 2. the scene cache  this exact question was answered (or prepared in the background) before
//! 3. `approval`  the keeper would act on the computer: show the plan, wait for Approve
//! 4. the engine  the keeper's brain; panel follow-ups use the quick helper model when set

use crate::brain::{self, Context, MindUsed, Progress, Thought};
use crate::kernel::settings::KeeperProfile;
use crate::memory::Memory;
use crate::state::AppState;

use super::approval;

/// Follow-ups sent by pointing at a panel (`focusQuestion` in the window) start like this.
const FOLLOW_UP: &str = "About \"";

pub(super) struct Answer {
    pub thought: Thought,
    pub mind: MindUsed,
    /// Came from the scene cache (do not cache it again).
    pub cached: bool,
}

fn mind(id: &str, label: &str) -> MindUsed {
    MindUsed { id: id.into(), label: label.into(), local: true, fell_back: None }
}

pub(super) async fn find(app: &tauri::AppHandle, state: &AppState, memory: &Memory, keeper: &KeeperProfile, ctx: &Context, chat: &str, approved: bool, progress: &(dyn Fn(Progress) + Sync)) -> Answer {
    if let Some(thought) = crate::fastlane::answer(app, memory, keeper, &ctx.said).await {
        return Answer { thought, mind: mind("instant", "Instant answer (no AI)"), cached: false };
    }
    if ctx.visual && !ctx.may_act && crate::memory::scene_cache::cacheable(&ctx.said) {
        if let Ok(Some(scene)) = memory.cached_scene(&ctx.said).await {
            for p in &scene.panels {
                progress(Progress::Panel(p.clone()));
            }
            let thought = Thought { reply: scene.reply, panels: serde_json::to_value(&scene.panels).unwrap_or_default(), ..Thought::default() };
            return Answer { thought, mind: mind("cache", "From memory (instant)"), cached: true };
        }
    }
    let settings = state.settings();
    let can_act = brain::engines::spec(&keeper.brain).is_some_and(|s| s.can_act);
    if ctx.may_act && can_act && settings.ask_before_acting && !approved {
        if let Some(answer) = approval::plan(state, keeper, ctx, chat).await {
            return answer;
        }
    }
    // Pointing at a panel is a quick follow-up: the helper model answers it when one is set.
    let quick = !settings.fast_model.is_empty() && keeper.brain == "claude" && ctx.said.starts_with(FOLLOW_UP) && !ctx.may_act;
    let keeper = if quick { KeeperProfile { model: settings.fast_model.clone(), ..keeper.clone() } } else { keeper.clone() };
    let (thought, mind) = brain::think(&keeper, ctx, progress).await;
    Answer { thought, mind, cached: false }
}
