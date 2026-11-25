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
        return Answer { thought, mind, cached: false };
    }
    if only_looks(&steps) {
        progress(Progress::ReplyText(" ".into()));
        let home = dirs::home_dir().unwrap_or_default();
        let looking = Context { may_act: true, guard: Some(std::sync::Arc::new(crate::brain::guard::PlanGuard::read_only(&home))), ..ctx.clone() };
        let (thought, mind) = brain::think(keeper, &looking, progress).await;
        return Answer { thought, mind, cached: false };
    }
    let summary = if thought.reply.trim().is_empty() { "Here's what I'd do. Approve it and I'll go ahead.".to_string() } else { thought.reply.clone() };
    let token = state.plans.keep(PendingPlan { keeper: keeper.id.clone(), chat: chat.to_string(), said: ctx.said.clone(), steps: steps.clone() });
    let panel = Panel::Approval { id: format!("plan-{token}"), title: "My plan".into(), summary: summary.clone(), steps, token };
    Answer { thought: Thought { reply: summary, core_panels: vec![panel], ..Thought::default() }, mind: MindUsed { label: format!("{} (plan)", mind.label), ..mind }, cached: false }
}

/// Approve (run the acting turn under the plan) or deny (record it and say so).
#[tauri::command]
pub async fn plan_decide(app: AppHandle, state: State<'_, AppState>, token: String, approve: bool) -> Result<TurnResult> {
    let plan = state.plans.take(&token).ok_or_else(|| DeskError::Invalid("That plan has expired. Ask me again.".into()))?;
    let keeper = state.keeper_or_active(&plan.keeper)?;
    let memory = state.memory_for(&keeper)?;
    if approve {
        let said = format!("{}{}", plan.said, mandate(&plan.steps));
        return turn::turn(&app, &memory, &state, &keeper, &plan.chat, &said, Some(&plan.steps)).await;
    }
    let record = ActionRecord::new("plan-denied", &plan.said, "You said no to my plan, so I didn't act.", true, &time::now_iso(), "");
    memory.write(&record).await;
    turn::turn(&app, &memory, &state, &keeper, &plan.chat, "I said no to that plan. Acknowledge briefly and don't do it.", None).await
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
        let t = plans.keep(PendingPlan { keeper: "k".into(), chat: "c".into(), said: "s".into(), steps });
        assert_eq!(t.len(), 24);
        assert!(plans.take(&t).is_some() && plans.take(&t).is_none(), "a plan is used once");
        let look = |a: &str| PlanStep { action: a.into(), target: "~/Desktop".into(), detail: None };
        assert!(only_looks(&[look("look"), look("List")]), "looking runs without approval");
        assert!(!only_looks(&[look("look"), look("move")]), "any change needs approval");
    }
}
