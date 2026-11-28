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
mod compose;
mod handoff;
pub(crate) mod test_drive;
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
use crate::sdk::Outcome;
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
        Some(input) => Some(attach::read(&input, Some(&app)).await?),
        None => None,
    };
    let result = run_turn_with(&app, &state, keeper.as_deref().unwrap_or(""), chat.as_deref().unwrap_or(""), &text, mode.as_deref().unwrap_or(""), attached, true).await;
    if let Err(e) = &result {
        // The failure, never the message that caused it.
        crate::kernel::log::error("turn", &e.to_string());
    }
    result
}

/// One turn asked at this Mac (the morning brief). `mode`: the mode this chat is in (a
/// `keepers::kit::roles` id; "" = the keeper's default).
pub async fn run_turn(app: &AppHandle, state: &AppState, keeper_id: &str, chat: &str, text: &str, mode: &str) -> Result<TurnResult> {
    run_turn_with(app, state, keeper_id, chat, text, mode, None, true).await
}

/// One turn from the phone link: everything a turn at the Mac does, except abilities that
/// change this Mac (`sdk::Access::Change`). `test_at_the_mac`: a developer's test link
/// (`test_drive`) standing in for someone at the Mac; ignored unless the test link is on.
pub async fn run_phone_turn(app: &AppHandle, state: &AppState, chat: &str, text: &str, mode: &str, test_at_the_mac: bool) -> Result<TurnResult> {
    run_turn_with(app, state, "", chat, text, mode, None, test_at_the_mac && test_drive::enabled()).await
}

/// The mode a chat runs in. On a child profile: always the BUILT-IN Tutor (with no tools, never an
/// edited copy that someone gave the web or a skill: review finding), unless the chat's mode is a
/// built-in one with no tools at all.
pub(crate) fn child_mode(mode: &str, child: bool) -> String {
    if !child {
        return mode.to_string();
    }
    let builtin_no_tools = crate::keepers::kit::roles::builtins().into_iter().any(|r| r.id == mode && r.tools == crate::keepers::kit::roles::Tools::None && r.skills.iter().all(|s| SAFE_FOR_A_CHILD.contains(&s.as_str())));
    if builtin_no_tools { mode.to_string() } else { "tutor".to_string() }
}

/// The skills a child may have a keeper use (nothing that opens apps or pages).
const SAFE_FOR_A_CHILD: [&str; 2] = ["remind", "ask-memory"];

/// `run_turn` with material the person handed over (`attach`); `at_the_mac`: not over the phone link.
#[allow(clippy::too_many_arguments)]
async fn run_turn_with(app: &AppHandle, state: &AppState, keeper_id: &str, chat: &str, text: &str, mode: &str, attached: Option<attach::Attached>, at_the_mac: bool) -> Result<TurnResult> {
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
    // "Run my Friday tidy": the routine's own request is what the keeper is asked.
    let routine = crate::fastlane::routines::expand(&memory, said).await;
    let said = routine.as_deref().unwrap_or(said);
    let result = turn::turn(app, &memory, state, &keeper, chat, said, None, attached, at_the_mac).await?;
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

/// The Stop button: end the turn in progress (the engine process is killed; paused work is
/// continued first, so nothing is left frozen).
#[tauri::command]
pub fn assistant_cancel() {
    crate::brain::engines::cli::cancel();
}

/// The Pause button: stop the engine in place (its time limit stops counting). Answers the
/// work's state, or "Nothing is running right now."
#[tauri::command]
pub fn assistant_pause() -> Result<crate::brain::engines::control::WorkState> {
    crate::brain::engines::control::pause().map_err(|e| DeskError::Invalid(e.words().into()))
}

/// The Resume button: the paused engine carries on where it was.
#[tauri::command]
pub fn assistant_resume() -> Result<crate::brain::engines::control::WorkState> {
    crate::brain::engines::control::resume().map_err(|e| DeskError::Invalid(e.words().into()))
}

/// Change course: the engine is stopped and starts again with the same request, this
/// correction and what it had done so far (`brain::redirect`), in the same exchange.
#[tauri::command]
pub fn assistant_redirect(correction: String) -> Result<()> {
    let correction = correction.trim();
    if correction.is_empty() {
        return Err(DeskError::Invalid("Say what to change first.".into()));
    }
    if correction.chars().count() > MAX_SAID {
        return Err(DeskError::Invalid("That's a lot at once. Try a shorter correction.".into()));
    }
    crate::brain::engines::cli::redirect(correction).map_err(|e| DeskError::Invalid(e.words().into()))
}

#[cfg(test)]
mod child_tests {
    #[test]
    fn a_child_profile_keeps_every_chat_in_a_mode_without_tools() {
        for mode in ["system", "assistant", "researcher"] {
            assert_eq!(super::child_mode(mode, true), "tutor", "{mode} has tools");
            assert_eq!(super::child_mode(mode, false), mode);
        }
        // The Companion can read contacts and add calendar events: not for a child.
        assert_eq!(super::child_mode("companion", true), "tutor");
        assert_eq!(super::child_mode("tutor", true), "tutor");
    }
}
