//! Approve before acting. When a keeper would act on the computer, it first answers WITHOUT
//! tools with the exact steps it plans to take; the core turns them into an approval panel
//! (engines can never write one themselves) and keeps the plan under a random token. "Approve
//! and do it" runs the real acting turn with the approved plan as its only mandate; "Don't"
//! records the refusal. Plans expire when the app quits (they live in memory only).

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, State};

use super::source::Answer;
use super::{turn, TurnResult};
use crate::brain::{self, Context, MindUsed, Progress, Thought};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::{time, DeskError, Result};
use crate::memory::ActionRecord;
use crate::stage::panel::PlanStep;
use crate::stage::Panel;
use crate::state::AppState;

const MAX_STEPS: usize = 20;

#[derive(Clone)]
pub struct PendingPlan {
    pub keeper: String,
    /// The mode the plan was made in (the acting turn runs in it).
    pub mode: String,
    pub chat: String,
    pub said: String,
    pub steps: Vec<PlanStep>,
}

#[derive(Default)]
pub struct Plans(Mutex<HashMap<String, PendingPlan>>);

impl Plans {
    fn keep(&self, plan: PendingPlan) -> String {
        let mut bytes = [0u8; 12];
        let _ = getrandom::getrandom(&mut bytes);
        let token = hex::encode(bytes);
        if let Ok(mut m) = self.0.lock() {
            m.insert(token.clone(), plan);
        }
        token
    }
    fn take(&self, token: &str) -> Option<PendingPlan> {
        self.0.lock().ok()?.remove(token)
    }
}

pub(super) const PLAN_ONLY: &str = "\n\n(PLAN ONLY, do not act and do not use tools. In your JSON put \"plan\": [{\"action\": \"a short verb\", \"target\": \"the file, folder or app\", \"detail\": \"why\"}] with the exact steps you would take on this computer, in order, and a one-sentence \"reply\" asking the person to approve. If you only need to look (list, read or search files) and change nothing, give those steps with the action \"look\" and a reply saying you're looking. If nothing on the computer is needed at all, leave \"plan\" empty and just answer.)";

/// Plan actions that only look. A plan made only of these runs at once, no approval: a read-only
/// guard (`PlanGuard::read_only`) stops the engine at its first change.
const LOOK_ACTIONS: [&str; 6] = ["look", "list", "read", "search", "find", "check"];

/// Said with a look at the computer: show what IS, not a lesson (founder 2026-11-26: "not
/// everything is an explainer").
const LOOKING: &str = "\n\n(You are LOOKING at this computer for the person. Show what you found as it is: tables of what you saw (devices, interfaces, folders, apps) and a live panel if it helps. No quiz, no flashcards, no lesson unless they asked you to explain. Use plain read commands joined with ; or | only: no loops (for, while), no $( ) or backticks, no subshells, no writing to files: the safety guard stops those and the look ends.)";

/// The note for a look's second try: what the guard refused, in its own plain words.
fn retry_note(why: &str) -> String {
    format!("\n\n(Your previous attempt was stopped by the safety guard: {why} Try again with simpler read-only commands, one tool per piece, no background jobs (&), no sleep.)")
}

/// What a question about the computer's health should open with: a live dashboard of the parts
/// it names (network, storage, memory, processor), or all of them for "how is my computer".
pub(super) fn live_panel_for(said: &str) -> Option<Panel> {
    let s = said.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|w| s.contains(w));
    let mut metrics = vec![];
    if has(&["network", "wi-fi", "wifi", "internet", "router", "bandwidth", "connection"]) {
        metrics.push("network".to_string());
    }
    if has(&["disk", "storage", "space", "drive"]) {
        metrics.push("disk".to_string());
    }
    if has(&["memory", "ram"]) {
        metrics.push("memory".to_string());
    }
    if has(&["cpu", "processor", "slow", "hot", "fan", "running", "busy"]) {
        metrics.extend(["cpu".to_string(), "apps".to_string()]);
    }
    let whole = has(&["my computer", "my mac", "my laptop", "this computer", "the computer"]) && has(&["how", "doing", "health", "status", "check", "show", "look"]);
    if metrics.is_empty() && !whole {
        return None;
    }
    if whole {
        metrics.clear();
    }
    Some(Panel::Live { id: "live".into(), title: "Your computer, live".into(), metrics })
}

fn only_looks(steps: &[PlanStep]) -> bool {
    steps.iter().all(|s| LOOK_ACTIONS.contains(&s.action.trim().to_lowercase().as_str()))
}

/// The plan text the acting turn is held to.
pub fn mandate(steps: &[PlanStep]) -> String {
    let list: Vec<String> = steps.iter().enumerate().map(|(i, s)| format!("{}. {} {}{}", i + 1, s.action, s.target, s.detail.as_deref().map(|d| format!(" ({d})")).unwrap_or_default())).collect();
    format!("\n\nThe person APPROVED exactly this plan; do these steps and nothing beyond them:\n{}", list.join("\n"))
}

/// Read the engine's plan (validated: short strings, at most 20 steps).
pub fn read_plan(raw: &serde_json::Value) -> Vec<PlanStep> {
    let clip = |s: &str, n: usize| s.chars().take(n).collect::<String>();
    raw.as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<PlanStep>(v.clone()).ok())
        .filter(|s| !s.action.trim().is_empty())
        .take(MAX_STEPS)
        .map(|s| PlanStep { action: clip(&s.action, 40), target: clip(&s.target, 300), detail: s.detail.map(|d| clip(&d, 200)) })
        .collect()
}

/// Ask for the plan in ONE engine call that streams like any answer. When the engine says
/// nothing on the computer needs to change, its answer IS the turn's answer (no second call).
pub(super) async fn plan(state: &AppState, keeper: &KeeperProfile, ctx: &Context, chat: &str, progress: &(dyn Fn(Progress) + Sync)) -> Answer {
    let planning = Context { said: format!("{}{PLAN_ONLY}", ctx.said), may_act: false, guard: None, ..ctx.clone() };
    let (thought, mind) = brain::think(keeper, &planning, progress).await;
    let steps = read_plan(&thought.plan);
    if steps.is_empty() {
        return Answer { thought, mind, cached: false, switched: None };
    }
    if only_looks(&steps) {
        // The plan's opening line ("I'll take a look…") stays on screen; the look's own words
        // come with the finished answer, so the chat never repeats itself mid-way.
        let quiet = |p: Progress| if matches!(p, Progress::Step(_)) { progress(p) };
        let progress: &(dyn Fn(Progress) + Sync) = &quiet;
        let home = dirs::home_dir().unwrap_or_default();
        let said = format!("{}{LOOKING}", ctx.said);
        let guard = std::sync::Arc::new(crate::brain::guard::PlanGuard::read_only(&home));
        let looking = Context { said: said.clone(), may_act: true, guard: Some(guard.clone()), ..ctx.clone() };
        let (mut thought, mut mind) = brain::think(keeper, &looking, progress).await;
        // A look the guard stopped gets ONE more try with simpler commands, told why (the guard
        // stays strict; the engine adapts). A second stop is reported as before.
        if let Some(why) = guard.stopped() {
            let retry = std::sync::Arc::new(crate::brain::guard::PlanGuard::read_only(&home));
            let again = Context { said: format!("{said}{}", retry_note(&why)), may_act: true, guard: Some(retry), ..ctx.clone() };
            (thought, mind) = brain::think(keeper, &again, progress).await;
        }
        let engine_has_live = thought.panels.to_string().contains("\"kind\":\"live\"");
        if let Some(live) = live_panel_for(&ctx.said).filter(|_| !engine_has_live) {
            thought.core_panels.insert(0, live);
        }
        return Answer { thought, mind, cached: false, switched: None };
    }
    let summary = if thought.reply.trim().is_empty() { "Here's what I'd do. Approve it and I'll go ahead.".to_string() } else { thought.reply.clone() };
    // The person reads the plan for a few seconds: start the acting process now, so Approve
    // does not wait for Claude Code to start.
    if keeper.brain == "claude" {
        crate::brain::engines::claude::warm_up(&Context { may_act: true, guard: None, ..ctx.clone() }, &keeper.model);
    }
    let token = state.plans.keep(PendingPlan { keeper: keeper.id.clone(), mode: keeper.role.clone(), chat: chat.to_string(), said: ctx.said.clone(), steps: steps.clone() });
    let panel = Panel::Approval { id: format!("plan-{token}"), title: "My plan".into(), summary: summary.clone(), steps, token };
    Answer { thought: Thought { reply: summary, core_panels: vec![panel], ..Thought::default() }, mind: MindUsed { label: format!("{} (plan)", mind.label), ..mind }, cached: false, switched: None }
}

/// Approve (run the acting turn under the plan) or deny (record it and say so).
#[tauri::command]
pub async fn plan_decide(app: AppHandle, state: State<'_, AppState>, token: String, approve: bool) -> Result<TurnResult> {
    decide(&app, &state, &token, approve).await
}

/// The decision itself, for the window (`plan_decide`) and the phone link alike.
pub async fn decide(app: &AppHandle, state: &AppState, token: &str, approve: bool) -> Result<TurnResult> {
    let plan = state.plans.take(token).ok_or_else(|| DeskError::Invalid("That plan has expired. Ask me again.".into()))?;
    let keeper = state.keeper_or_active(&plan.keeper)?;
    let memory = state.memory_for(&keeper)?;
    let keeper = crate::kernel::settings::KeeperProfile { role: plan.mode.clone(), ..keeper };
    if approve {
        let said = format!("{}{}", plan.said, mandate(&plan.steps));
        return turn::turn(app, &memory, state, &keeper, &plan.chat, &said, Some(&plan.steps)).await;
    }
    let record = ActionRecord::new("plan-denied", &plan.said, "You said no to my plan, so I didn't act.", true, &time::now_iso(), "");
    memory.write(&record).await;
    turn::turn(app, &memory, state, &keeper, &plan.chat, "I said no to that plan. Acknowledge briefly and don't do it.", None).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plans_are_read_safely_and_become_a_mandate() {
        let raw = serde_json::json!([{"action": "move", "target": "~/Downloads/a.pdf", "detail": "to Documents"}, {"action": "", "target": "x"}, "junk"]);
        let steps = read_plan(&raw);
        assert_eq!(steps.len(), 1);
        assert!(mandate(&steps).contains("1. move ~/Downloads/a.pdf (to Documents)"));
        let plans = Plans::default();
        let t = plans.keep(PendingPlan { keeper: "k".into(), mode: "system".into(), chat: "c".into(), said: "s".into(), steps });
        assert_eq!(t.len(), 24);
        assert!(plans.take(&t).is_some() && plans.take(&t).is_none(), "a plan is used once");
        let look = |a: &str| PlanStep { action: a.into(), target: "~/Desktop".into(), detail: None };
        assert!(only_looks(&[look("look"), look("List")]), "looking runs without approval");
        let Some(Panel::Live { metrics, .. }) = super::live_panel_for("Show me what's going on with my home network.") else { panic!("network → live") };
        assert_eq!(metrics, vec!["network".to_string()]);
        let Some(Panel::Live { metrics, .. }) = super::live_panel_for("How is my computer doing?") else { panic!("whole computer → live") };
        assert!(metrics.is_empty(), "all metrics");
        assert!(super::live_panel_for("find my tax letter").is_none(), "a file search gets no dashboard");
        assert!(super::retry_note("I only look.").contains("I only look."), "the retry says why");
        assert!(!only_looks(&[look("look"), look("move")]), "any change needs approval");
    }
}
