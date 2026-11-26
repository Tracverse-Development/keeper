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
    if ctx.said.starts_with(FOLLOW_UP) {
        super::prefetch::wait_if_preparing(&ctx.said).await;
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
        return approval::plan(state, keeper, ctx, chat, progress).await;
    }
    // Pointing at a panel, or a short conversational turn, goes to the quick helper model when
    // one is set: about 1 s to the first words against about 2 s (measured 2026-11-25).
    let quick_turn = ctx.said.starts_with(FOLLOW_UP) || (settings.quick_replies && conversational(&ctx.said));
    let quick = !settings.fast_model.is_empty() && keeper.brain == "claude" && quick_turn && !ctx.may_act;
    let thinker = if quick { KeeperProfile { model: settings.fast_model.clone(), ..keeper.clone() } } else { keeper.clone() };
    let (thought, mut mind) = brain::think(&thinker, ctx, progress).await;
    // Taken as conversation, but the engine says it is computer work: run it again with tools
    // (through the plan when the person wants to approve first).
    if thought.needs_computer && ctx.can_act && !ctx.may_act && can_act {
        let acting = Context { may_act: true, ..ctx.clone() };
        // The live text so far ("Let me take a look.") stays; the real answer follows it.
        progress(Progress::ReplyText(" ".into()));
        if settings.ask_before_acting {
            return approval::plan(state, keeper, &acting, chat, progress).await;
        }
        let (thought, mind) = brain::think(keeper, &acting, progress).await;
        return Answer { thought, mind, cached: false };
    }
    if quick && mind.id == "claude" {
        mind.label = format!("{} (quick)", mind.label);
    }
    Answer { thought, mind, cached: false }
}

/// A short conversational turn: not a lesson, a comparison or anything to build. These words
/// keep a turn on the keeper's own model, where depth matters more than speed.
pub fn conversational(said: &str) -> bool {
    const DEEP: [&str; 16] = ["explain", "teach", "show me", "compare", "analy", "plan ", "write ", "draft", "code", "step by step", "visual", "diagram", "lesson", "quiz", "why does", "how does"];
    let s = said.to_lowercase();
    s.chars().count() <= 160 && !DEEP.iter().any(|w| s.contains(w))
}

#[cfg(test)]
mod tests {
    #[test]
    fn quick_turns_are_short_and_conversational() {
        assert!(super::conversational("What's my sister's name?"));
        assert!(super::conversational("Remind me to call Maya at 5"));
        assert!(!super::conversational("Explain fractions to me"));
        assert!(!super::conversational("Compare the iPhone and the Pixel"));
        assert!(!super::conversational(&"tell me a story ".repeat(20)));
    }
}
