//! The window's everyday commands outside a turn: settings, the memory overview, voice.
//! (Turn: `assistant::assistant_turn`. Installer: `setup::*`.)

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::brain::engines::{self, EngineStatus};
use crate::dkg::client::NodeStatus;
use crate::kernel::settings::{Settings, VoiceEngine};
use crate::kernel::{time, DeskError, Result};
use crate::platform;
use crate::voice::eleven::{self, ElevenVoice};
use crate::memory::{ActionRecord, Counts, Fact, QueryTrace, Reminder, Retraction, Turn};
use crate::state::AppState;

#[tauri::command]
pub fn app_settings(state: State<'_, AppState>) -> Settings {
    state.settings()
}

/// The fields the settings sheet may change. Left out = unchanged (LES-039).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsChange {
    pub brain: Option<String>,
    pub ollama_model: Option<String>,
    pub agent_actions: Option<bool>,
    pub voice: Option<String>,
    pub voice_engine: Option<VoiceEngine>,
    pub eleven_voice_id: Option<String>,
    pub always_listening: Option<bool>,
    pub wake_word: Option<bool>,
    pub skin: Option<String>,
    pub auto_update: Option<bool>,
}

/// The saved settings, and what the assistant says about the change (when it has something to say).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub settings: Settings,
    pub announcement: Option<String>,
}

/// Skins the window offers (its registry is `src/character/skins`); anything else is refused.
const SKINS: &[&str] = &["robot", "puppy"];

#[tauri::command]
pub async fn save_settings(app: AppHandle, state: State<'_, AppState>, change: SettingsChange) -> Result<Saved> {
    if let Some(skin) = &change.skin {
        if !SKINS.contains(&skin.as_str()) {
            return Err(DeskError::Invalid("That look does not exist.".into()));
        }
    }
    if let Some(id) = &change.eleven_voice_id {
        if !id.is_empty() && !eleven::valid_voice_id(id) {
            return Err(DeskError::Invalid("That is not an ElevenLabs voice.".into()));
        }
    }
    // The engine goes through the assistant, which records the change on the DKG and finds its words.
    let announcement = match &change.brain {
        Some(id) if *id != state.settings().brain => Some(crate::assistant::change_engine(&app, &state, id, "").await?),
        _ => None,
    };
    let saved = state.update_settings(|s| {
        if let Some(m) = change.ollama_model {
            s.ollama_model = m;
        }
        if let Some(a) = change.agent_actions {
            s.agent_actions = a;
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
        if let Some(skin) = change.skin {
            s.skin = skin;
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
    Ok(Saved { settings: saved, announcement })
}

/// Every engine and whether it works on this computer right now.
#[tauri::command]
pub async fn engines_list() -> Vec<EngineStatus> {
    engines::detect_all().await
}

/// Save (or, with an empty key, remove) the ElevenLabs key in the Keychain, then prove it works.
#[tauri::command]
pub async fn eleven_set_key(key: String) -> Result<Vec<ElevenVoice>> {
    let key = key.trim();
    if key.len() > 200 || key.chars().any(char::is_whitespace) {
        return Err(DeskError::Invalid("That doesn't look like an ElevenLabs key.".into()));
    }
    platform::secret_set(eleven::KEY_NAME, key)?;
    if key.is_empty() {
        return Ok(vec![]);
    }
    eleven::voices().await
}

/// The ElevenLabs voices for the saved key (empty when there is no key).
#[tauri::command]
pub async fn eleven_voices() -> Result<Vec<ElevenVoice>> {
    if platform::secret_get(eleven::KEY_NAME).is_none() {
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
pub async fn memory_overview(state: State<'_, AppState>) -> Result<Overview> {
    let memory = state.memory()?;
    let node = memory.client().status().await.ok();
    let (facts, facts_trace) = memory.facts().await?;
    let (actions, actions_trace) = memory.actions().await?;
    let (turns, turns_trace) = memory.history().await?;
    Ok(Overview {
        graph_id: memory.graph().to_string(),
        node,
        counts: memory.counts().await.unwrap_or_default(),
        facts,
        turns,
        actions,
        reminders: memory.upcoming_reminders().await.unwrap_or_default(),
        traces: vec![facts_trace, turns_trace, actions_trace],
    })
}

#[tauri::command]
pub async fn memory_forget_fact(state: State<'_, AppState>, id: String) -> Result<()> {
    if id.len() != 16 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(crate::kernel::DeskError::Invalid("That isn't a fact id.".into()));
    }
    state.memory()?.write(&Retraction { fact_id: id, at: time::now_iso() }).await;
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
pub async fn voice_speak(app: AppHandle, state: State<'_, AppState>, text: String) -> Result<()> {
    let text: String = text.chars().take(1200).collect();
    state.voice.speak(&app, &text, &state.settings()).await
}

#[tauri::command]
pub async fn voice_hush(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.hush(&app).await
}

#[tauri::command]
pub async fn voice_list(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.voice.list_voices(&app).await
}
