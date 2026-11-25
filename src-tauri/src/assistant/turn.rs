//! One turn, in order: recall from the keeper's graph, find where the answer comes from
//! (`source`: instant answer, cached scene, a plan to approve, or the engine), act, remember.

use std::sync::Mutex;
use std::time::Instant;

use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::{change_engine, phase, source, wrote, Timings, TurnResult, MAX_STEPS};
use crate::brain::{self, Context};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::slug::short_hash;
use crate::kernel::{events, time, Result};
use crate::memory::later::Later;
use crate::memory::scene_cache::CachedScene;
use crate::memory::{ActionRecord, Chat, Fact, Memory, Recall, Turn};
use crate::skills::{self, Effect, Outcome, SkillEnv};
use crate::state::AppState;

pub(super) async fn turn(app: &AppHandle, memory: &Memory, state: &AppState, keeper: &KeeperProfile, chat: &str, said: &str, approved: Option<&[crate::stage::panel::PlanStep]>) -> Result<TurnResult> {
    let started = Instant::now();
    let at = time::now_iso();
    let turn_id = short_hash(&format!("{at}\u{0}{said}"), 16);
    let mut writes = Vec::new();
    // Every record of this turn is written AFTER the reply is on its way (`memory::later`).
    let mut later = Later::new(memory);

    // A new chat is named after its first message, so the turn can link to it.
    let chat = if chat.is_empty() {
        let new_chat = Chat::start(said, &at);
        writes.push(later.add(&new_chat, "chat"));
        new_chat.id
    } else {
        chat.to_string()
    };

    phase(app, "recalling", &format!("Querying your DKG graph {}", memory.graph()));
    let (recall, memory_offline) = match memory.recall(said).await {
        Ok(r) => (r, false),
        Err(_) => {
            // Keeper's own node went down mid-session: start it again in the background (the
            // answer goes on without memory; this turn's writes wait in the outbox).
            let node_home = state.settings().node_home;
            tauri::async_runtime::spawn(async move {
                let _ = crate::dkg::own_node::ensure_running(&node_home).await;
            });
            (Recall { facts: vec![], recent: vec![], traces: vec![] }, true)
        }
    };
    let recall_ms = started.elapsed().as_millis();

    let role = crate::keepers::kit::roles::get(&keeper.role);
    let ctx = Context {
        facts: recall.facts.clone(),
        recent: recall.recent.clone(),
        // An approved plan binds this turn: each tool call is checked against it.
        guard: approved.map(|steps| std::sync::Arc::new(crate::brain::guard::PlanGuard::new(steps, &dirs::home_dir().unwrap_or_default()))),
        ..base_context(state, keeper, said)
    };
    let identity = ctx.identity.clone();
    phase(app, "thinking", crate::brain::engines::label(&keeper.brain));
    // When the person first saw something (the early reply or the first panel).
    let first_ms: Mutex<Option<u128>> = Mutex::new(None);
    let seen = || {
        if let Ok(mut f) = first_ms.lock() {
            f.get_or_insert(started.elapsed().as_millis());
        }
    };
    let progress = |p: brain::Progress| match p {
        brain::Progress::Step(step) => phase(app, "acting", step),
        brain::Progress::Panel(panel) => {
            seen();
            let _ = app.emit(events::STAGE_PANEL, json!({ "keeper": keeper.id, "chat": chat, "panel": panel }));
        }
        brain::Progress::ReplyText(words) => {
            seen();
            let _ = app.emit(events::REPLY_DELTA, json!({ "keeper": keeper.id, "text": words }));
        }
        brain::Progress::Reply(text) => {
            seen();
            let _ = app.emit(events::EARLY_REPLY, json!({ "keeper": keeper.id, "text": text }));
        }
    };
    let thinking = Instant::now();
    let answer = source::find(app, state, memory, keeper, &ctx, &chat, approved.is_some(), &progress).await;
    let (thought, mind) = (answer.thought, answer.mind);
    let think_ms = thinking.elapsed().as_millis();

    let mut forgotten = Vec::new();
    if !thought.forget.is_empty() {
        phase(app, "remembering", "Retracting from your graph");
        for what in &thought.forget {
            forgotten.extend(memory.forget(what).await.unwrap_or_default());
        }
    }

    let mut outcomes = Vec::new();
    if !thought.actions.is_empty() {
        phase(app, "acting", "");
        let env = SkillEnv { app, memory, reminders: &state.reminders };
        for request in thought.actions.iter().take(4) {
            // A role only uses the skills it is allowed (a companion does not open apps).
            if !role.allows(&request.skill) {
                outcomes.push(Outcome { skill: request.skill.clone(), input: request.input.to_string(), summary: format!("That isn't part of my job as {}.", role.title), succeeded: false, effect: None });
                continue;
            }
            let mut outcome = skills::run(request, &env).await;
            if let Some(Effect::SwitchEngine(id)) = outcome.effect.clone() {
                outcome.summary = change_engine(app, state, &keeper.id, &id, None, &turn_id).await.unwrap_or_else(|e| e.to_string());
                outcomes.push(outcome);
                continue;
            }
            let record = ActionRecord::new(&outcome.skill, &outcome.input, &outcome.summary, outcome.succeeded, &time::now_iso(), &turn_id);
            writes.push(later.add(&record, "action"));
            outcomes.push(outcome);
        }
    }

    // What an agent engine did on the computer: one desk:Action per tool call.
    for step in thought.steps.iter().take(MAX_STEPS) {
        let record = ActionRecord::new(&format!("agent:{}", step.tool), &step.detail, &format!("{} ran {}: {}", mind.label, step.tool, step.detail), true, &time::now_iso(), &turn_id);
        writes.push(later.add(&record, "action"));
    }

    let reply = compose_reply(&thought.reply, &outcomes, &forgotten, !thought.forget.is_empty());

    let mut learned = Vec::new();
    if !thought.remember.is_empty() {
        for l in thought.remember.iter().take(6) {
            let fact = Fact::new(&l.text, &l.category, &at);
            writes.push(later.add(&fact, "fact"));
            learned.push(fact);
        }
    }

    let mut panels = crate::stage::read(&thought.panels);
    panels.extend(thought.core_panels.iter().cloned());
    // A fresh visual answer is kept under its question; a lesson's cards are prepared next.
    if !answer.cached && ctx.visual && !ctx.may_act && thought.core_panels.is_empty() && crate::memory::scene_cache::cacheable(said) {
        if let Some(scene) = CachedScene::new(said, &reply, &panels) {
            later.add(&scene, "scene");
        }
    }
    super::prefetch::spawn(app, keeper, identity, recall.facts.clone(), &panels);
    // The scene is kept with the turn, so reopening the chat brings its panels back.
    let turn = Turn::new(said, &reply, &mind.id, &at, &chat).with_panels(&panels);
    writes.push(later.add(&turn, "turn"));
    let app_for_writes = app.clone();
    later.send(move |receipt, kind| wrote(&app_for_writes, receipt, kind));
    phase(app, "done", "");

    let first = first_ms.lock().ok().and_then(|f| *f);
    let timings = Timings { recall_ms, first_ms: first, think_ms, total_ms: started.elapsed().as_millis(), source: if matches!(mind.id.as_str(), "instant" | "cache" | "reflex") { mind.id.clone() } else { mind.label.clone() } };
    Ok(TurnResult { keeper: keeper.id.clone(), chat, reply, mind, learned, forgotten, actions: outcomes, panels, steps: thought.steps, traces: recall.traces, writes, memory_offline, timings })
}

/// The parts of a keeper's context that do not depend on recall: who it is, whether it may act,
/// how it shows things. The turn and the warm-up (`super::warm`) both build from this, so a
/// warm spare is started with exactly the instructions the next turn will use.
pub(super) fn base_context(state: &AppState, keeper: &KeeperProfile, said: &str) -> Context {
    let role = crate::keepers::kit::roles::get(&keeper.role);
    Context {
        said: said.to_string(),
        assistant_name: keeper.name.clone(),
        identity: format!("{} {}", crate::keepers::kit::souls::brief(&state.soul(&keeper.soul)), role.brief),
        facts: vec![],
        recent: vec![],
        now_local: chrono::Local::now().format("%A %-d %B %Y, %-I:%M %p").to_string(),
        // Acting needs both: the person allows it, and the keeper's role is one that acts.
        may_act: state.settings().agent_actions && role.may_act,
        visual: crate::stage::wants_visual(said, state.settings().visual),
        guard: None,
    }
}

/// The mind's words, then what the skills did (a skill's own sentence is the truth about it).

fn compose_reply(said: &str, outcomes: &[Outcome], forgotten: &[Fact], asked_to_forget: bool) -> String {
    let mut parts: Vec<String> = Vec::new();
    if !said.trim().is_empty() {
        parts.push(said.trim().to_string());
    }
    for o in outcomes {
        if !parts.iter().any(|p| p.contains(&o.summary)) {
            parts.push(o.summary.clone());
        }
    }
    if asked_to_forget && said.trim().is_empty() {
        parts.push(if forgotten.is_empty() {
            "I couldn't find that in your memory graph.".into()
        } else {
            format!("Done. I've retracted {} from your memory graph.", forgotten.iter().map(|f| format!("\"{}\"", f.text)).collect::<Vec<_>>().join(", "))
        });
    }
    if parts.is_empty() {
        "Okay.".into()
    } else {
        parts.join(" ")
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skill_outcomes_are_always_told() {
        let o = Outcome { skill: "open-app".into(), input: "{}".into(), summary: "Opened Notes.".into(), succeeded: true, effect: None };
        assert_eq!(compose_reply("", &[o.clone()], &[], false), "Opened Notes.");
        assert_eq!(compose_reply("Sure.", &[o], &[], false), "Sure. Opened Notes.");
        assert_eq!(compose_reply("", &[], &[], true), "I couldn't find that in your memory graph.");
    }
}

