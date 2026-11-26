//! The window's everyday commands outside a turn: settings, the memory overview, voice.
//! (Turn: `assistant::assistant_turn`. Installer: `setup::*`.)

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::brain::engines::{self, EngineStatus};
use crate::dkg::client::NodeStatus;
use crate::kernel::settings::{Settings, VoiceEngine};
use crate::kernel::{secrets, DeskError, Result};
use crate::voice::eleven::{self, ElevenVoice};
use crate::memory::{catalog, ActionRecord, Chat, Counts, Fact, QueryTrace, Reminder, Turn};
use crate::state::AppState;

#[tauri::command]
pub fn app_settings(state: State<'_, AppState>) -> Settings {
    state.settings()
}

/// The fields the settings sheet may change. Left out = unchanged (LES-039). A keeper's own
/// name, look, engine and model change through `keepers::keepers_update`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsChange {
    pub agent_actions: Option<bool>,
    pub voice: Option<String>,
    pub voice_engine: Option<VoiceEngine>,
    pub eleven_voice_id: Option<String>,
    pub always_listening: Option<bool>,
    pub wake_word: Option<bool>,
    pub talk_shortcut: Option<String>,
    pub visual: Option<bool>,
    pub auto_update: Option<bool>,
    pub prefetch_scenes: Option<bool>,
    pub fast_model: Option<String>,
    pub ask_before_acting: Option<bool>,
    pub quick_replies: Option<bool>,
    /// The monthly spending limit in dollars (0 = none).
    pub monthly_cap_usd: Option<f64>,
    /// The maker's name and link put on shared packs (both given together; an empty name clears them).
    pub maker: Option<(String, String)>,
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, state: State<'_, AppState>, change: SettingsChange) -> Result<Settings> {
    if let Some(id) = &change.eleven_voice_id {
        if !id.is_empty() && !eleven::valid_voice_id(id) {
            return Err(DeskError::Invalid("That is not an ElevenLabs voice.".into()));
        }
    }
    if let Some(shortcut) = &change.talk_shortcut {
        crate::hotkey::apply(&app, shortcut)?;
    }
    if change.agent_actions == Some(true) && crate::kernel::child_lock::on() {
        return Err(DeskError::Invalid("Acting on this computer stays off on a child profile.".into()));
    }
    let saved = state.update_settings(|s| {
        if let Some(a) = change.agent_actions {
            s.agent_actions = a;
        }
        if let Some(p) = change.prefetch_scenes {
            s.prefetch_scenes = p;
        }
        // The helper model is a name from the engine's own list, or "" for off.
        if let Some(m) = change.fast_model.filter(|m| m.is_empty() || (m.len() <= 40 && m.chars().all(|c| c.is_ascii_alphanumeric() || "-._".contains(c)))) {
            s.fast_model = m;
        }
        if let Some(a) = change.ask_before_acting {
            s.ask_before_acting = a;
        }
        if let Some(q) = change.quick_replies {
            s.quick_replies = q;
        }
        if let Some((name, link)) = &change.maker {
            // Kept as cleaned (a link that is not a plain https address is dropped).
            let maker = crate::keepers::kit::packs::clean_maker(name, link);
            s.maker_name = maker.as_ref().map(|m| m.name.clone()).unwrap_or_default();
            s.maker_link = maker.map(|m| m.link).unwrap_or_default();
        }
        if let Some(cap) = change.monthly_cap_usd.filter(|c| c.is_finite() && (0.0..=10_000.0).contains(c)) {
            s.monthly_cap_usd = cap;
        }
        if let Some(v) = change.voice.filter(|v| !v.trim().is_empty()) {
            s.voice = v;
        }
        if let Some(e) = change.voice_engine {
            s.voice_engine = e;
        }
        if let Some(id) = change.eleven_voice_id {
            s.eleven_voice_id = id;
        }
        if let Some(a) = change.always_listening {
            s.always_listening = a;
        }
        if let Some(w) = change.wake_word {
            s.wake_word = w;
        }
        if let Some(t) = change.talk_shortcut {
            s.talk_shortcut = t;
        }
        if let Some(v) = change.visual {
            s.visual = v;
        }
        if let Some(u) = change.auto_update {
            s.auto_update = u;
        }
    })?;
    state.voice.set_wake_required(saved.wake_word);
    if let Some(on) = change.always_listening {
        if on {
            state.voice.listen_always(&app).await?;
        } else {
            state.voice.stop_listening(&app).await?;
        }
    }
    // Showing mode, acting or the helper model may have changed the next turn's command line.
    crate::assistant::warm::warm_keeper(&state, "");
    Ok(saved)
}

/// Every engine and whether it works on this computer right now.
#[tauri::command]
pub async fn engines_list() -> Vec<EngineStatus> {
    engines::detect_all().await
}

/// Save (or, with an empty key, remove) the ElevenLabs key in Keeper's private store, then prove it works.
#[tauri::command]
pub async fn eleven_set_key(key: String) -> Result<Vec<ElevenVoice>> {
    let key = key.trim();
    if key.len() > 200 || key.chars().any(char::is_whitespace) {
        return Err(DeskError::Invalid("That doesn't look like an ElevenLabs key.".into()));
    }
    secrets::set(eleven::KEY_NAME, key)?;
    if key.is_empty() {
        return Ok(vec![]);
    }
    eleven::voices().await
}

/// The ElevenLabs voices for the saved key (empty when there is no key).
#[tauri::command]
pub async fn eleven_voices() -> Result<Vec<ElevenVoice>> {
    if secrets::get(eleven::KEY_NAME).is_none() {
        return Ok(vec![]);
    }
    eleven::voices().await
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub graph_id: String,
    pub node: Option<NodeStatus>,
    pub counts: Counts,
    pub facts: Vec<Fact>,
    /// The conversation history, newest first (from the DKG).
    pub turns: Vec<Turn>,
    pub actions: Vec<ActionRecord>,
    pub reminders: Vec<Reminder>,
    pub traces: Vec<QueryTrace>,
}

#[tauri::command]
pub async fn memory_overview(state: State<'_, AppState>, keeper: Option<String>) -> Result<Overview> {
    let memory = state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?;
    let node = memory.client().status().await.ok();
    let (facts, facts_trace) = memory.facts().await?;
    let (actions, actions_trace) = memory.actions().await?;
    let (turns, turns_trace) = memory.history().await?;
    Ok(Overview {
        graph_id: memory.hot_key().to_string(),
        node,
        counts: memory.counts().await.unwrap_or_default(),
        facts,
        turns,
        actions,
        reminders: memory.upcoming_reminders().await.unwrap_or_default(),
        traces: vec![facts_trace, turns_trace, actions_trace],
    })
}

/// A keeper's chats, newest first (from its graph).
#[tauri::command]
pub async fn chats_list(state: State<'_, AppState>, keeper: Option<String>) -> Result<Vec<Chat>> {
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.chats().await
}

/// One chat's turns, oldest first (from its keeper's graph).
#[tauri::command]
pub async fn chat_turns(state: State<'_, AppState>, keeper: Option<String>, chat: String) -> Result<Vec<Turn>> {
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.chat_turns(&chat).await
}

/// Delete a chat and every turn in it from its keeper's graph (erased from the node).
#[tauri::command]
pub async fn chat_delete(state: State<'_, AppState>, keeper: Option<String>, chat: String) -> Result<usize> {
    if chat.is_empty() || chat.len() > 32 || !chat.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(DeskError::Invalid("That isn't a chat id.".into()));
    }
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.erase_chat(&chat).await
}

/// The question catalog (every question a keeper can ask its graph).
#[tauri::command]
pub fn catalog_list() -> Vec<catalog::QuestionInfo> {
    catalog::list()
}

#[derive(Debug, Serialize)]
pub struct Answer {
    pub trace: QueryTrace,
    pub rows: Vec<crate::dkg::Row>,
}

/// Ask one catalog question of a keeper's graph; the answer carries the SPARQL it ran.
#[tauri::command]
pub async fn catalog_run(state: State<'_, AppState>, keeper: Option<String>, question: String, args: std::collections::HashMap<String, String>) -> Result<Answer> {
    let memory = state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?;
    let (rows, trace) = memory.ask(&question, &args).await?;
    Ok(Answer { trace, rows })
}

#[tauri::command]
pub async fn memory_forget_fact(state: State<'_, AppState>, id: String, keeper: Option<String>) -> Result<()> {
    if id.len() != 16 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(crate::kernel::DeskError::Invalid("That isn't a fact id.".into()));
    }
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.erase_fact(&id).await;
    Ok(())
}

#[tauri::command]
pub async fn voice_authorize(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.authorize(&app).await
}

#[tauri::command]
pub async fn voice_listen_once(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.listen_once(&app).await
}

#[tauri::command]
pub async fn voice_stop(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let always = state.settings().always_listening;
    if always {
        state.voice.listen_always(&app).await
    } else {
        state.voice.stop_listening(&app).await
    }
}

#[tauri::command]
pub async fn voice_speak(app: AppHandle, state: State<'_, AppState>, text: String, queue: Option<bool>) -> Result<()> {
    let text: String = text.chars().take(1200).collect();
    state.voice.speak(&app, &text, &state.settings().speaking_as_active(), queue.unwrap_or(false)).await
}

/// Try a voice without saving it (the Studio's Test button): speak `text` with this engine
/// and voice id.
#[tauri::command]
pub async fn voice_try(app: AppHandle, state: State<'_, AppState>, engine: crate::kernel::settings::VoiceEngine, id: String, text: String) -> Result<()> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || " ()-_.".contains(c)) {
        return Err(DeskError::Invalid("That isn't a voice.".into()));
    }
    let mut settings = state.settings();
    match engine {
        crate::kernel::settings::VoiceEngine::Elevenlabs => settings.eleven_voice_id = id,
        _ => settings.voice = id,
    }
    settings.voice_engine = engine;
    let text: String = text.chars().take(300).collect();
    state.voice.speak(&app, &text, &settings, false).await
}

#[tauri::command]
pub async fn voice_hush(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.hush(&app).await
}

#[tauri::command]
pub async fn voice_list(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.list_voices(&app).await
}

/// This month's spending on cloud minds and the limit set for it (`kernel::usage`).
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spending {
    pub usd: f64,
    pub calls: u64,
    /// The monthly limit in dollars (0 = none) and whether it is reached.
    pub cap_usd: f64,
    pub reached: bool,
}

#[tauri::command]
pub fn usage_month(state: State<'_, AppState>) -> Spending {
    let (month, cap_usd) = (crate::kernel::usage::this_month(), state.settings().monthly_cap_usd);
    Spending { usd: month.usd, calls: month.calls, cap_usd, reached: crate::kernel::usage::reached(cap_usd, month.usd) }
}

/// Is the child profile on (`kernel::child_lock`)?
#[tauri::command]
pub fn child_profile() -> bool {
    crate::kernel::child_lock::on()
}

/// Turn the child profile on (setting its passcode) or off (with that passcode).
#[tauri::command]
pub fn child_profile_set(state: State<'_, AppState>, on: bool, passcode: String) -> Result<bool> {
    crate::kernel::child_lock::set(on, &passcode)?;
    // A phone link left running would reach the keeper without the grown-up (review finding).
    if crate::kernel::child_lock::on() {
        state.phone.stop();
    }
    Ok(crate::kernel::child_lock::on())
}

/// A fact as the window sends it back to undo a forget (validated: it becomes memory again).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactBack {
    pub text: String,
    pub category: String,
    pub at: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub topics: Vec<String>,
}

/// The categories a fact may have (what the mind is told to use).
const CATEGORIES: [&str; 8] = ["identity", "preference", "person", "place", "health", "schedule", "general", "work"];

/// Undo a forget or a replacement: the fact is remembered again, as it was.
#[tauri::command]
pub async fn memory_restore_fact(state: State<'_, AppState>, keeper: Option<String>, fact: FactBack) -> Result<crate::memory::Fact> {
    let text = fact.text.trim();
    if text.is_empty() || text.chars().count() > 500 || text.chars().any(char::is_control) {
        return Err(DeskError::Invalid("That isn't a fact I can put back.".into()));
    }
    let category = if CATEGORIES.contains(&fact.category.as_str()) { fact.category.as_str() } else { "general" };
    let at = crate::kernel::time::parse_iso(&fact.at).map(crate::kernel::time::iso).unwrap_or_else(crate::kernel::time::now_iso);
    let mode = if crate::keepers::kit::roles::exists(&fact.mode) { fact.mode.as_str() } else { "" };
    let restored = crate::memory::Fact::new(text, category, &at).about(&fact.topics);
    let restored = crate::memory::Fact { mode: mode.to_string(), ..restored };
    let memory = state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?;
    memory.restore_fact(&restored).await;
    Ok(restored)
}
