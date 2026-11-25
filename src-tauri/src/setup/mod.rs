//! The first-run installer's steps, as commands the installer screen calls in order:
//!
//! 1. `setup_scan`          what is already here: a DKG node, Ollama models, Hermes, the voice helper
//! 2. `setup_install_node`  only when there is no node: install Keeper's own (progress events)
//! 3. `setup_create_graph`  the person's private memory graph, proven by writing and reading it back
//! 4. `setup_finish`        save the choices; the dashboard opens

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};

use crate::brain::engines::{cli, ollama};
use crate::dkg::client::NodeStatus;
use crate::dkg::{node, DkgClient};
use crate::keepers;
use crate::kernel::settings::KeeperProfile;
use crate::kernel::{events, DeskError, Result};
use crate::platform;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoundNode {
    pub home: String,
    pub port: u16,
    pub status: NodeStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scan {
    pub node: Option<FoundNode>,
    /// Folders that hold a node which did not answer (installed but stopped).
    pub silent_nodes: Vec<String>,
    pub ollama_models: Vec<String>,
    pub hermes_installed: bool,
    pub voice_helper: bool,
    pub computer_name: String,
}

#[tauri::command]
pub async fn setup_scan(state: State<'_, AppState>) -> Result<Scan> {
    let saved = state.settings().node_home;
    let mut found = None;
    let mut silent = Vec::new();
    for home in node::candidate_homes(&saved) {
        let Some(loc) = node::locate(&home) else { continue };
        match DkgClient::new(&loc).status().await {
            Ok(status) => {
                found = Some(FoundNode { home: home.display().to_string(), port: loc.port, status });
                break;
            }
            Err(_) => silent.push(home.display().to_string()),
        }
    }
    Ok(Scan {
        node: found,
        silent_nodes: silent,
        ollama_models: ollama::models().await,
        hermes_installed: cli::program("hermes").is_some(),
        voice_helper: platform::voice_helper().is_some(),
        computer_name: platform::computer_name(),
    })
}

#[tauri::command]
pub async fn setup_install_node(app: AppHandle, state: State<'_, AppState>) -> Result<FoundNode> {
    let say = |line: &str| {
        let _ = app.emit(events::SETUP_PROGRESS, json!({ "line": line }));
    };
    let loc = node::install(&platform::computer_name(), say).await?;
    let status = DkgClient::new(&loc).status().await?;
    let home = loc.home.display().to_string();
    state.update_settings(|s| s.node_home = home.clone())?;
    Ok(FoundNode { home, port: loc.port, status })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphReady {
    pub graph_id: String,
    pub uri: String,
    pub profile_ual: String,
    pub merkle_root: String,
    /// The profile was read back from Working Memory (the round trip is proven, not assumed).
    pub verified: bool,
    pub query_ms: u128,
}

/// Step 3: the first keeper, the System Administration keeper, with its own Context Graph.
#[tauri::command]
pub async fn setup_create_graph(state: State<'_, AppState>, node_home: String, assistant_name: String) -> Result<GraphReady> {
    let name = assistant_name.trim().to_string();
    if !keepers::valid_name(&name) {
        return Err(DeskError::Invalid("Give your keeper a short name (letters and numbers).".into()));
    }
    let loc = node::locate(std::path::Path::new(&node_home)).ok_or_else(|| DeskError::Node("that node folder has no port or sign-in token".into()))?;
    let client = DkgClient::new(&loc);
    let existing = state.settings().keepers.first().cloned();
    let keeper = KeeperProfile {
        id: "keeper-1".into(),
        name: name.clone(),
        skin: existing.as_ref().map(|k| k.skin.clone()).unwrap_or_else(|| "robot".into()),
        role: "system".into(),
        soul: existing.as_ref().map(|k| k.soul.clone()).unwrap_or_else(|| "steady".into()),
        wearables: existing.as_ref().map(|k| k.wearables.clone()).unwrap_or_else(crate::kernel::settings::default_wearables),
        graph_id: keepers::graph_id_for(&name, true),
        brain: existing.as_ref().map(|k| k.brain.clone()).unwrap_or_else(|| "reflex".into()),
        model: existing.map(|k| k.model).unwrap_or_default(),
    };
    let started = std::time::Instant::now();
    let soul = state.soul(&keeper.soul);
    let (profile_ual, verified) = keepers::write_profile(&client, &keeper, &soul).await?;
    let query_ms = started.elapsed().as_millis();
    let graph_id = keeper.graph_id.clone();
    let home = node_home.clone();
    state.update_settings(|s| {
        s.node_home = home;
        s.keepers.retain(|k| k.id != "keeper-1");
        s.keepers.insert(0, keeper);
        s.active_keeper = "keeper-1".into();
    })?;
    state.refresh_voice_names();
    Ok(GraphReady { uri: format!("did:dkg:context-graph:{graph_id}"), graph_id, profile_ual, merkle_root: String::new(), verified, query_ms })
}

#[tauri::command]
pub async fn setup_finish(state: State<'_, AppState>, brain: String, model: String, voice: String) -> Result<()> {
    if crate::brain::engines::spec(&brain).is_none() {
        return Err(DeskError::Invalid("Choose one of the listed engines.".into()));
    }
    state.update_settings(|s| {
        if let Some(k) = s.keeper_mut("keeper-1") {
            k.brain = brain;
            k.model = model;
        }
        if !voice.trim().is_empty() {
            s.voice = voice;
        }
        s.setup_complete = true;
    })?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct FolderAccess {
    pub folder: &'static str,
    pub granted: bool,
}

/// Ask for the folders a System Administration keeper works in, up front: reading each one
/// makes macOS ask "Keeper would like to access files in your Desktop folder" now, during setup,
/// instead of in the middle of a task later.
#[tauri::command]
pub fn setup_folders() -> Vec<FolderAccess> {
    let home = dirs::home_dir().unwrap_or_default();
    ["Desktop", "Documents", "Downloads"]
        .into_iter()
        .map(|folder| FolderAccess { folder, granted: std::fs::read_dir(home.join(folder)).is_ok() })
        .collect()
}
