//! The assistant: one turn of conversation, end to end. A Mediator: it is the only module
//! that uses memory, brain and skills together, in this order:
//!
//! 1. recall   bounded SPARQL over the person's graph (what it knows, what was just said)
//! 2. think    the chosen mind (or the built-in one) with that context
//! 3. act      run the skills the mind asked for; each outcome becomes a `desk:Action`
//! 4. remember new facts → `desk:Fact`, retractions → `desk:Retraction`, the turn → `desk:Turn`
//!
//! The window hears each phase as `assistant://phase` so the character can show it
//! ("Querying your DKG…", "Thinking…", "Remembering…"). An agent engine's tool calls arrive
//! as "acting" phases while it works, and each one is written to the DKG as a `desk:Action`.

pub mod persona;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::brain::{self, Context, MindUsed};
use crate::kernel::slug::short_hash;
use crate::kernel::{events, time, DeskError, Result};
use crate::kernel::settings::KeeperProfile;
use crate::memory::{ActionRecord, Chat, Fact, Memory, QueryTrace, Recall, Turn, WriteReceipt};
use crate::skills::{self, Effect, Outcome, SkillEnv};
use crate::state::AppState;

/// Longest message the assistant takes (a paragraph; more is a paste, not a turn).
const MAX_SAID: usize = 2000;
/// At most this many agent tool calls are recorded per turn (the rest are counted in the turn).
const MAX_STEPS: usize = 40;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnResult {
    /// The keeper that answered and the chat this turn belongs to.
    pub keeper: String,
    pub chat: String,
    pub reply: String,
    pub mind: MindUsed,
    pub learned: Vec<Fact>,
    pub forgotten: Vec<Fact>,
    pub actions: Vec<Outcome>,
    /// What an agent engine did on the computer this turn.
    pub steps: Vec<crate::brain::AgentStep>,
    pub traces: Vec<QueryTrace>,
    pub writes: Vec<WriteReceipt>,
    /// Recall failed (the node is down): the answer was made without memory.
    pub memory_offline: bool,
}

fn phase(app: &AppHandle, name: &str, detail: &str) {
    let _ = app.emit(events::ASSISTANT_PHASE, json!({ "phase": name, "detail": detail }));
}

fn wrote(app: &AppHandle, receipt: &WriteReceipt, kind: &str) {
    let _ = app.emit(events::MEMORY_WRITTEN, json!({ "kind": kind, "name": receipt.name, "ual": receipt.ual, "queued": receipt.queued }));
}

/// One turn. `keeper` = which keeper (empty: the active one); `chat` = continue that chat
/// (empty: start a new one, named after this message).
#[tauri::command]
pub async fn assistant_turn(app: AppHandle, state: State<'_, AppState>, text: String, keeper: Option<String>, chat: Option<String>) -> Result<TurnResult> {
    run_turn(&app, &state, keeper.as_deref().unwrap_or(""), chat.as_deref().unwrap_or(""), &text).await
}

/// One turn, from the window, the talk window or the phone link.
pub async fn run_turn(app: &AppHandle, state: &AppState, keeper_id: &str, chat: &str, text: &str) -> Result<TurnResult> {
    let said = text.trim();
    if said.is_empty() {
        return Err(DeskError::Invalid("Say something first.".into()));
    }
    if said.chars().count() > MAX_SAID {
        return Err(DeskError::Invalid("That's a lot at once. Try a shorter message.".into()));
    }
    if !chat.is_empty() && (chat.len() != 16 || !chat.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err(DeskError::Invalid("That chat does not exist.".into()));
    }
    let keeper = state.keeper_or_active(keeper_id)?;
    let memory = state.memory_for(&keeper)?;
    let result = turn(app, &memory, state, &keeper, chat, said).await?;
    let _ = app.emit(events::ASSISTANT_REPLY, json!({ "keeper": keeper.id, "chat": result.chat, "reply": result.reply }));
    Ok(result)
}

/// Change a keeper's engine (and model): save it, record it on the keeper's graph, and return
/// what the keeper says about its new brain.
pub async fn change_engine(app: &AppHandle, state: &AppState, keeper_id: &str, engine: &str, model: Option<&str>, from_turn: &str) -> Result<String> {
    let spec = crate::brain::engines::spec(engine).ok_or_else(|| DeskError::Invalid(format!("There is no engine called {engine}.")))?;
    let keeper = state.keeper_or_active(keeper_id)?;
    let before = keeper.brain.clone();
    state.update_settings(|s| {
        if let Some(k) = s.keeper_mut(&keeper.id) {
            k.brain = spec.id.to_string();
            k.model = model.unwrap_or_default().to_string();
        }
    })?;
    if before != spec.id {
        if let Ok(memory) = state.memory_for(&keeper) {
            let record = ActionRecord::new("switch-engine", &format!("{before} -> {}", spec.id), &format!("Switched my brain to {}.", spec.label), true, &time::now_iso(), from_turn);
            let receipt = memory.write(&record).await;
            wrote(app, &receipt, "action");
        }
    }
    Ok(persona::brain_changed(spec.label))
}

async fn turn(app: &AppHandle, memory: &Memory, state: &AppState, keeper: &KeeperProfile, chat: &str, said: &str) -> Result<TurnResult> {
    let at = time::now_iso();
    let turn_id = short_hash(&format!("{at}\u{0}{said}"), 16);
    let mut writes = Vec::new();

    // A new chat is named after its first message and written first, so the turn can link to it.
    let chat = if chat.is_empty() {
        let new_chat = Chat::start(said, &at);
        let receipt = memory.write(&new_chat).await;
        writes.push(receipt);
        new_chat.id
    } else {
        chat.to_string()
    };

    phase(app, "recalling", &format!("Querying your DKG graph {}", memory.graph()));
    let (recall, memory_offline) = match memory.recall(said).await {
        Ok(r) => (r, false),
        Err(_) => (Recall { facts: vec![], recent: vec![], traces: vec![] }, true),
    };

    let ctx = Context {
        said: said.to_string(),
        assistant_name: keeper.name.clone(),
        domain_brief: crate::keepers::domains::get(&keeper.domain).brief,
        facts: recall.facts.clone(),
        recent: recall.recent.clone(),
        now_local: chrono::Local::now().format("%A %-d %B %Y, %-I:%M %p").to_string(),
        may_act: state.settings().agent_actions,
    };
    phase(app, "thinking", crate::brain::engines::label(&keeper.brain));
    let progress = |step: &str| phase(app, "acting", step);
    let (thought, mind) = brain::think(keeper, &ctx, &progress).await;

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
        let env = SkillEnv { memory, reminders: &state.reminders };
        for request in thought.actions.iter().take(4) {
            let mut outcome = skills::run(request, &env).await;
            if let Some(Effect::SwitchEngine(id)) = outcome.effect.clone() {
                outcome.summary = change_engine(app, state, &keeper.id, &id, None, &turn_id).await.unwrap_or_else(|e| e.to_string());
                outcomes.push(outcome);
                continue;
            }
            let record = ActionRecord::new(&outcome.skill, &outcome.input, &outcome.summary, outcome.succeeded, &time::now_iso(), &turn_id);
            let receipt = memory.write(&record).await;
            wrote(app, &receipt, "action");
            writes.push(receipt);
            outcomes.push(outcome);
        }
    }

    // What an agent engine did on the computer: one desk:Action per tool call.
    for step in thought.steps.iter().take(MAX_STEPS) {
        let record = ActionRecord::new(&format!("agent:{}", step.tool), &step.detail, &format!("{} ran {}: {}", mind.label, step.tool, step.detail), true, &time::now_iso(), &turn_id);
        let receipt = memory.write(&record).await;
        wrote(app, &receipt, "action");
        writes.push(receipt);
    }

    let reply = compose_reply(&thought.reply, &outcomes, &forgotten, !thought.forget.is_empty());

    let mut learned = Vec::new();
    if !thought.remember.is_empty() {
        phase(app, "remembering", "Writing to your DKG graph");
        for l in thought.remember.iter().take(6) {
            let fact = Fact::new(&l.text, &l.category, &at);
            let receipt = memory.write(&fact).await;
            wrote(app, &receipt, "fact");
            writes.push(receipt);
            learned.push(fact);
        }
    }

    let turn = Turn::new(said, &reply, &mind.id, &at, &chat);
    let receipt = memory.write(&turn).await;
    wrote(app, &receipt, "turn");
    writes.push(receipt);
    phase(app, "done", "");

    Ok(TurnResult { keeper: keeper.id.clone(), chat, reply, mind, learned, forgotten, actions: outcomes, steps: thought.steps, traces: recall.traces, writes, memory_offline })
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
