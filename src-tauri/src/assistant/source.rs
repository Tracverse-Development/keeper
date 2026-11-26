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
    /// The turn moved to another mode to answer (its id): the chat is in that mode now.
    pub switched: Option<String>,
}

fn mind(id: &str, label: &str) -> MindUsed {
    MindUsed { id: id.into(), label: label.into(), local: true, fell_back: None }
}

/// The answer, in the chat's mode; when the engine says the request belongs to another mode, the
/// turn moves there once (its brief, skills and tools) and that mode answers. The person hears
/// "Switching to … mode for this." first (founder 2026-11-26: modes are locked to their scope).
pub(super) async fn find(app: &tauri::AppHandle, state: &AppState, memory: &Memory, keeper: &KeeperProfile, ctx: &Context, chat: &str, approved: bool, progress: &(dyn Fn(Progress) + Sync)) -> Answer {
    let answer = answer_in(app, state, memory, keeper, ctx, chat, approved, progress).await;
    let Some(target) = answer.thought.switch_mode.clone().filter(|m| m != &keeper.role && crate::keepers::kit::roles::exists(m)) else { return answer };
    let moved = KeeperProfile { role: target.clone(), ..keeper.clone() };
    let base = super::turn::base_context(state, &moved, &ctx.said);
    let ctx = Context { facts: ctx.facts.clone(), recent: ctx.recent.clone(), elsewhere: ctx.elsewhere.clone(), ..base };
    // What was said so far ("Switching to Researcher mode for this.") stays; the answer follows it.
    progress(Progress::ReplyText(" ".into()));
    let mut next = answer_in(app, state, memory, &moved, &ctx, chat, approved, progress).await;
    next.thought.switch_mode = None;
    let title = crate::keepers::kit::roles::get(&target).title;
    if !next.thought.reply.to_lowercase().contains("switching") {
        next.thought.reply = format!("Switching to {title} mode for this. {}", next.thought.reply);
    }
    next.switched = Some(target);
    next
}

async fn answer_in(app: &tauri::AppHandle, state: &AppState, memory: &Memory, keeper: &KeeperProfile, ctx: &Context, chat: &str, approved: bool, progress: &(dyn Fn(Progress) + Sync)) -> Answer {
    if let Some(thought) = crate::fastlane::answer(app, memory, keeper, &ctx.said).await {
        return Answer { thought, mind: mind("instant", "Instant answer (no AI)"), cached: false, switched: None };
    }
    if ctx.said.starts_with(FOLLOW_UP) {
        super::prefetch::wait_if_preparing(&ctx.said).await;
    }
    let style = brain::styles::get(&ctx.style);
    if ctx.visual && !ctx.may_act && style.id == brain::styles::DEFAULT && crate::memory::scene_cache::cacheable(&ctx.said) {
        if let Ok(Some(scene)) = memory.cached_scene(&ctx.said).await {
            for p in &scene.panels {
                progress(Progress::Panel(p.clone()));
            }
            let thought = Thought { reply: scene.reply, panels: serde_json::to_value(&scene.panels).unwrap_or_default(), ..Thought::default() };
            return Answer { thought, mind: mind("cache", "From memory (instant)"), cached: true, switched: None };
        }
    }
    let settings = state.settings();
    let can_act = brain::engines::spec(&keeper.brain).is_some_and(|s| s.can_act);
    let mode = crate::keepers::kit::roles::get(&keeper.role);
    // A question that only looks goes straight to a read-only look: one engine call, not a plan
    // and then a look (nothing changes, so there is nothing to approve).
    if ctx.may_act && ctx.can_act && can_act && !approved && super::intent::only_looks(&ctx.said) {
        // First words at once (typed and spoken); the look's own answer replaces them when done.
        let opening = super::approval::opening_line(&ctx.said);
        progress(Progress::ReplyText(opening.clone()));
        progress(Progress::Reply(opening));
        // A health or network question shows its live dashboard at once, while the look runs.
        if let Some(live) = approval::live_panel_for(&ctx.said) {
            progress(Progress::Panel(live));
        }
        let quiet = |p: Progress| if matches!(p, Progress::Step(_)) { progress(p) };
        return approval::look(keeper, ctx, &quiet).await;
    }
    if ctx.may_act && can_act && mode.may_act() && settings.ask_before_acting && !approved {
        return approval::plan(state, keeper, ctx, chat, progress).await;
    }
    // Pointing at a panel, or a short conversational turn, goes to the quick helper model when
    // one is set: about 1 s to the first words against about 2 s (measured 2026-11-25).
    let quick_turn = ctx.said.starts_with(FOLLOW_UP) || (settings.quick_replies && conversational(&ctx.said));
    // A tutor teaches with panels every turn: never the quick model.
    let quick = !settings.fast_model.is_empty() && keeper.brain == "claude" && quick_turn && !ctx.may_act && style.quick && mode.tools != crate::keepers::kit::roles::Tools::Web && mode.id != "tutor";
    let thinker = if quick { KeeperProfile { model: settings.fast_model.clone(), ..keeper.clone() } } else { keeper.clone() };
    let (thought, mut mind) = brain::think(&thinker, ctx, progress).await;
    // Taken as conversation, but the engine says it is computer work: run it again with tools
    // (through the plan when the person wants to approve first).
    if thought.needs_computer && ctx.can_act && !ctx.may_act && can_act {
        let acting = Context { may_act: true, ..ctx.clone() };
        // The live text so far ("Let me take a look.") stays; the real answer follows it.
        progress(Progress::ReplyText(" ".into()));
        if settings.ask_before_acting && mode.may_act() {
            return approval::plan(state, keeper, &acting, chat, progress).await;
        }
        let (thought, mind) = brain::think(keeper, &acting, progress).await;
        return Answer { thought, mind, cached: false, switched: None };
    }
    if quick && mind.id == "claude" {
        mind.label = format!("{} (quick)", mind.label);
    }
    Answer { thought, mind, cached: false, switched: None }
}

/// A short conversational turn: not a lesson, a comparison or anything to build. These words
/// keep a turn on the keeper's own model, where depth matters more than speed.
pub fn conversational(said: &str) -> bool {
    // "Why are leaves green?" is a lesson question, not small talk (scenario bench 2026-11-26).
    const DEEP: [&str; 21] = ["explain", "teach", "show me", "compare", "analy", "plan ", "write ", "draft", "code", "step by step", "visual", "diagram", "lesson", "quiz", "why ", "how does", "how do ", "how can", "how come", "what makes", "go back"];
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
        assert!(!super::conversational("Why are leaves green and not black?"), "a lesson follow-up");
        assert!(super::conversational("How are you?"), "a greeting stays quick");
        assert!(!super::conversational(&"tell me a story ".repeat(20)));
    }
}
