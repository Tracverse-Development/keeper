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
pub mod attach;
mod intent;
mod speech;
pub mod persona;
mod prefetch;
mod source;
pub mod touch;
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
    /// The mode that answered (it may have switched from the chat's mode).
    pub mode: String,
    /// This turn moved the chat to another mode.
    pub switched: bool,
    pub chat: String,
    pub reply: String,
    pub mind: MindUsed,
    pub learned: Vec<Fact>,
    pub forgotten: Vec<Fact>,
    /// What the keeper knew about the person when it answered: the facts recall handed the
    /// mind for this turn (empty for an answer reopened from the scene cache). Shown under
    /// the answer with a Forget button each ("Why did you say that?").
    pub used: Vec<Fact>,
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
    /// The first Stage panel arrived (a lesson's first picture), when the answer has panels.
    pub panel_ms: Option<u128>,
    /// Something could first be spoken: the reply's first sentence (or the whole reply).
    pub speak_ms: Option<u128>,
    /// The answer's source (instant, cache, plan, engine) took this long.
    pub think_ms: u128,
    /// The whole turn, up to the reply (the DKG writes happen after it).
    pub total_ms: u128,
    /// Which mind or source answered ("instant", "cache", "claude"…).
    pub source: String,
    /// What the engine says the answer cost, in dollars at its own prices (absent: it reported
    /// none, or the answer needed no cloud mind).
    pub cost_usd: Option<f64>,
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
pub async fn assistant_turn(app: AppHandle, state: State<'_, AppState>, text: String, keeper: Option<String>, chat: Option<String>, mode: Option<String>, attach: Option<attach::AttachInput>) -> Result<TurnResult> {
    // Material handed over with the message (a dropped file) is read first: a file that cannot
    // be read fails the turn in plain words before anything is asked of the mind.
    let attached = match attach {
        Some(input) => Some(attach::read(&input).await?),
        None => None,
    };
    run_turn_with(&app, &state, keeper.as_deref().unwrap_or(""), chat.as_deref().unwrap_or(""), &text, mode.as_deref().unwrap_or(""), attached).await
}

/// One turn, from the window, the talk window or the phone link.
/// `mode`: the mode this chat is in (a `keepers::kit::roles` id; "" = the keeper's default).
pub async fn run_turn(app: &AppHandle, state: &AppState, keeper_id: &str, chat: &str, text: &str, mode: &str) -> Result<TurnResult> {
    run_turn_with(app, state, keeper_id, chat, text, mode, None).await
}

/// The mode a chat runs in: its own, or on a child profile (when its own has tools) the Tutor.
pub(crate) fn child_mode(mode: &str, child: bool) -> String {
    let has_tools = crate::keepers::kit::roles::get(mode).tools != crate::keepers::kit::roles::Tools::None;
    if child && has_tools { "tutor".to_string() } else { mode.to_string() }
}

/// `run_turn` with material the person handed over (`attach`).
async fn run_turn_with(app: &AppHandle, state: &AppState, keeper_id: &str, chat: &str, text: &str, mode: &str, attached: Option<attach::Attached>) -> Result<TurnResult> {
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
    // This chat's mode, for this turn: the keeper works as that job (its skills, tools, brief).
    if !mode.is_empty() && !crate::keepers::kit::roles::exists(mode) {
        return Err(DeskError::Invalid("That mode does not exist.".into()));
    }
    let keeper = if mode.is_empty() { keeper } else { crate::kernel::settings::KeeperProfile { role: mode.to_string(), ..keeper } };
    // On a child profile every chat is in a mode with no tools (no computer, no web).
    let keeper = crate::kernel::settings::KeeperProfile { role: child_mode(&keeper.role, crate::kernel::child_lock::on()), ..keeper };
    let result = turn::turn(app, &memory, state, &keeper, chat, said, None, attached).await?;
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
    Ok(Some(run_turn(&app, &state, "", "", "Brief me", "").await?))
}

/// The Stop button: end the turn in progress (the engine process is killed).
#[tauri::command]
pub fn assistant_cancel() {
    crate::brain::engines::cli::cancel();
}

#[cfg(test)]
mod child_tests {
    #[test]
    fn a_child_profile_keeps_every_chat_in_a_mode_without_tools() {
        for mode in ["system", "assistant", "researcher"] {
            assert_eq!(super::child_mode(mode, true), "tutor", "{mode} has tools");
            assert_eq!(super::child_mode(mode, false), mode);
        }
        assert_eq!(super::child_mode("companion", true), "companion");
        assert_eq!(super::child_mode("tutor", true), "tutor");
    }
}
