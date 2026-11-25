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
use crate::dkg::ontology::{class, pred, ASSISTANT, OWNER};
use crate::dkg::{node, AssetBuilder, DkgClient, Layer};
use crate::kernel::slug::short_hash;
use crate::kernel::{events, time, DeskError, Result};
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

/// The graph id names no person: a hash of this computer's account, so it is stable per user.
fn graph_id_for_this_computer() -> String {
    let home = dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default();
    // The prefix keeps its pre-rename spelling: existing graphs keep their exact id (DKG reference §2).
    format!("umoja-desk-{}", short_hash(&format!("{home}\u{0}{}", platform::computer_name()), 10))
}

#[tauri::command]
pub async fn setup_create_graph(state: State<'_, AppState>, node_home: String, assistant_name: String) -> Result<GraphReady> {
    let name = assistant_name.trim();
    if name.is_empty() || name.chars().count() > 24 || !name.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-') {
        return Err(DeskError::Invalid("Give your assistant a short name (letters and numbers).".into()));
    }
    let loc = node::locate(std::path::Path::new(&node_home)).ok_or_else(|| DeskError::Node("that node folder has no port or sign-in token".into()))?;
    let client = DkgClient::new(&loc);
    let graph_id = graph_id_for_this_computer();
    let uri = client.ensure_graph(&graph_id, &format!("{name}'s memory (Keeper)")).await?;

    let mut profile = AssetBuilder::new(ASSISTANT).a(class::AGENT).a("schema:SoftwareApplication").text(pred::NAME, name).link(pred::ABOUT, OWNER).time(pred::AT, &time::now_iso()).build();
    profile.extend(AssetBuilder::new(OWNER).a(class::PERSON).time(pred::AT, &time::now_iso()).build());
    let written = client.write_asset(&graph_id, "desk-profile", &profile).await?;

    let started = std::time::Instant::now();
    let sparql = "PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> SELECT ?name WHERE { <urn:umoja:desk:agent:assistant> a prov:SoftwareAgent ; schema:name ?name } LIMIT 1";
    let rows = client.query(&graph_id, sparql, Layer::Working).await?;
    let verified = rows.first().and_then(|r| r.get("name")).is_some_and(|n| n == name);

    let home = node_home.clone();
    let gid = graph_id.clone();
    let assistant = name.to_string();
    state.update_settings(|s| {
        s.node_home = home;
        s.graph_id = gid;
        s.assistant_name = assistant;
    })?;
    state.voice.set_name(name);
    state.reconnect();
    Ok(GraphReady { graph_id, uri, profile_ual: written.ka_ual, merkle_root: written.merkle_root, verified, query_ms: started.elapsed().as_millis() })
}

#[tauri::command]
pub async fn setup_finish(state: State<'_, AppState>, brain: String, ollama_model: String, voice: String) -> Result<()> {
    if crate::brain::engines::spec(&brain).is_none() {
        return Err(DeskError::Invalid("Choose one of the listed engines.".into()));
    }
    state.update_settings(|s| {
        s.brain = brain;
        s.ollama_model = ollama_model;
        if !voice.trim().is_empty() {
            s.voice = voice;
        }
        s.setup_complete = true;
    })?;
    Ok(())
}
