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

pub mod actions;
pub mod approval;
pub mod persona;
mod prefetch;
mod source;
mod turn;
pub mod warm;
#[cfg(test)]
mod live_test;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::brain::MindUsed;
use crate::kernel::{events, time, DeskError, Result};
use crate::memory::{ActionRecord, Fact, QueryTrace, WriteReceipt};
use crate::skills::Outcome;
use crate::state::AppState;

/// Longest message the assistant takes (a paragraph; more is a paste, not a turn).
pub(crate) const MAX_SAID: usize = 2000;
/// At most this many agent tool calls are recorded per turn (the rest are counted in the turn).
pub(super) const MAX_STEPS: usize = 40;

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
    /// What to show on the Stage (validated and capped).
    pub panels: Vec<crate::stage::Panel>,
    pub traces: Vec<QueryTrace>,
    pub writes: Vec<WriteReceipt>,
    /// Recall failed (the node is down): the answer was made without memory.
    pub memory_offline: bool,
    /// How long each part of the turn took (shown to the person; the speed tests read it).
    pub timings: Timings,
}

/// One turn's timing, in milliseconds from the moment it started.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timings {
    /// Memory recalled (hot memory: well under 1 ms; a cold load: tens of ms).
    pub recall_ms: u128,
    /// The person first saw something: the reply ready to speak, or the first panel.
    pub first_ms: Option<u128>,
    /// The answer's source (instant, cache, plan, engine) took this long.
    pub think_ms: u128,
    /// The whole turn, up to the reply (the DKG writes happen after it).
    pub total_ms: u128,
    /// Which mind or source answered ("instant", "cache", "claude"…).
    pub source: String,
}

pub(super) fn phase(app: &AppHandle, name: &str, detail: &str) {
    let _ = app.emit(events::ASSISTANT_PHASE, json!({ "phase": name, "detail": detail }));
}

pub(super) fn wrote(app: &AppHandle, receipt: &WriteReceipt, kind: &str) {
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
    let result = turn::turn(app, &memory, state, &keeper, chat, said, None).await?;
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

/// The morning brief, once a day (the window asks on opening; "brief me" works any time).
#[tauri::command]
pub async fn brief_today(app: AppHandle, state: State<'_, AppState>) -> Result<Option<TurnResult>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    if state.settings().last_brief == today || !state.settings().setup_complete {
        return Ok(None);
    }
    state.update_settings(|s| s.last_brief = today)?;
    Ok(Some(run_turn(&app, &state, "", "", "Brief me").await?))
}
