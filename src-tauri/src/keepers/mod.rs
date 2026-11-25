//! Keepers: each keeper is an agent with its own look, mind and DOMAIN, remembering in its own
//! Context Graph (one graph per domain it keeps). Keeper #1 is the System Administration keeper.
//!
//! Creating a keeper creates its graph on the node and writes its profile as the graph's first
//! Knowledge Asset (who it is, what it keeps, its look), then proves the round trip by reading
//! the name back. Removing a keeper takes it off this computer's list; its graph stays on the
//! node (DKG writes are additive; nothing here deletes graph data).

pub mod domains;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::dkg::ontology::{class, pred, ASSISTANT, OWNER};
use crate::dkg::{AssetBuilder, DkgClient, Layer};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::slug::short_hash;
use crate::kernel::{time, DeskError, Result};
use crate::platform;
use crate::state::AppState;

/// Skins the window offers (`src/character/skins/catalog.ts`); anything else is refused.
pub const SKINS: &[&str] = &["robot", "puppy"];
const MAX_KEEPERS: usize = 12;

/// A short, safe name (it is also a wake word and a graph label).
pub fn valid_name(name: &str) -> bool {
    let n = name.trim();
    !n.is_empty() && n.chars().count() <= 24 && n.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-')
}

/// A new graph id: names no person, stable per keeper. The first keeper keeps the pre-keepers
/// spelling (`umoja-desk-<hash>`) so an existing graph keeps its exact id.
pub fn graph_id_for(seed: &str, first: bool) -> String {
    let home = dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default();
    let base = short_hash(&format!("{home}\u{0}{}", platform::computer_name()), 10);
    if first {
        format!("umoja-desk-{base}")
    } else {
        format!("keeper-{base}-{}", short_hash(seed, 8))
    }
}

/// Create the keeper's graph and profile asset; returns the profile's UAL and whether the
/// read-back matched.
pub async fn write_profile(client: &DkgClient, keeper: &KeeperProfile) -> Result<(String, bool)> {
    let domain = domains::get(&keeper.domain);
    client.ensure_graph(&keeper.graph_id, &format!("{}: {} (Keeper)", keeper.name, domain.title)).await?;
    let mut quads = AssetBuilder::new(ASSISTANT)
        .a(class::AGENT)
        .a("schema:SoftwareApplication")
        .text(pred::NAME, &keeper.name)
        .text("desk:domain", &keeper.domain)
        .text("desk:skin", &keeper.skin)
        .text("schema:description", domain.title)
        .link(pred::ABOUT, OWNER)
        .time(pred::AT, &time::now_iso())
        .build();
    quads.extend(AssetBuilder::new(OWNER).a(class::PERSON).time(pred::AT, &time::now_iso()).build());
    let written = client.write_asset(&keeper.graph_id, "desk-profile", &quads).await?;
    let sparql = "PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> SELECT ?name WHERE { <urn:umoja:desk:agent:assistant> a prov:SoftwareAgent ; schema:name ?name } LIMIT 5";
    let rows = client.query(&keeper.graph_id, sparql, Layer::Working).await?;
    let verified = rows.iter().any(|r| r.get("name").is_some_and(|n| n == &keeper.name));
    Ok((written.ka_ual, verified))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperList {
    pub keepers: Vec<KeeperProfile>,
    pub active: String,
    pub domains: Vec<domains::DomainInfo>,
}

fn list(state: &AppState) -> KeeperList {
    let s = state.settings();
    let active = s.active().map(|k| k.id.clone()).unwrap_or_default();
    KeeperList { keepers: s.keepers, active, domains: domains::all() }
}

#[tauri::command]
pub fn keepers_list(state: State<'_, AppState>) -> KeeperList {
    list(&state)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewKeeper {
    pub name: String,
    pub skin: String,
    pub domain: String,
}

#[tauri::command]
pub async fn keepers_create(state: State<'_, AppState>, keeper: NewKeeper) -> Result<KeeperList> {
    if !valid_name(&keeper.name) {
        return Err(DeskError::Invalid("Give your keeper a short name (letters and numbers).".into()));
    }
    if !SKINS.contains(&keeper.skin.as_str()) || !domains::exists(&keeper.domain) {
        return Err(DeskError::Invalid("Choose one of the looks and domains offered.".into()));
    }
    let settings = state.settings();
    if settings.keepers.len() >= MAX_KEEPERS {
        return Err(DeskError::Invalid("That's the most keepers one computer can hold for now.".into()));
    }
    if settings.keepers.iter().any(|k| k.name.eq_ignore_ascii_case(keeper.name.trim())) {
        return Err(DeskError::Invalid("You already have a keeper with that name.".into()));
    }
    let seed = format!("{}\u{0}{}", keeper.name.trim(), time::now_iso());
    let first = settings.keepers.is_empty();
    let profile = KeeperProfile {
        id: if first { "keeper-1".into() } else { format!("keeper-{}", short_hash(&seed, 10)) },
        name: keeper.name.trim().to_string(),
        skin: keeper.skin,
        domain: keeper.domain,
        graph_id: graph_id_for(&seed, first),
        brain: settings.active().map(|k| k.brain.clone()).unwrap_or_else(|| "reflex".into()),
        model: settings.active().map(|k| k.model.clone()).unwrap_or_default(),
    };
    write_profile(&state.client()?, &profile).await?;
    state.update_settings(|s| {
        s.active_keeper = profile.id.clone();
        s.keepers.push(profile);
    })?;
    state.refresh_voice_names();
    Ok(list(&state))
}

#[tauri::command]
pub fn keepers_activate(state: State<'_, AppState>, id: String) -> Result<KeeperList> {
    if state.settings().keeper(&id).is_none() {
        return Err(DeskError::Invalid("There is no such keeper.".into()));
    }
    state.update_settings(|s| s.active_keeper = id)?;
    Ok(list(&state))
}

/// Edits to a keeper. Left out = unchanged (LES-039).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperChange {
    pub name: Option<String>,
    pub skin: Option<String>,
    pub brain: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperSaved {
    pub list: KeeperList,
    /// What the keeper says about the change (its new brain), when it has something to say.
    pub announcement: Option<String>,
}

#[tauri::command]
pub async fn keepers_update(app: AppHandle, state: State<'_, AppState>, id: String, change: KeeperChange) -> Result<KeeperSaved> {
    let current = state.settings().keeper(&id).cloned().ok_or_else(|| DeskError::Invalid("There is no such keeper.".into()))?;
    if let Some(n) = &change.name {
        if !valid_name(n) {
            return Err(DeskError::Invalid("Give your keeper a short name (letters and numbers).".into()));
        }
    }
    if let Some(s) = &change.skin {
        if !SKINS.contains(&s.as_str()) {
            return Err(DeskError::Invalid("That look does not exist.".into()));
        }
    }
    if let Some(m) = &change.model {
        if m.len() > 80 || !m.chars().all(|c| c.is_ascii_alphanumeric() || "._:-/".contains(c)) {
            return Err(DeskError::Invalid("That isn't a model name.".into()));
        }
    }
    let announcement = match &change.brain {
        Some(b) if *b != current.brain => Some(crate::assistant::change_engine(&app, &state, &id, b, change.model.as_deref(), "").await?),
        _ => None,
    };
    state.update_settings(|s| {
        if let Some(k) = s.keeper_mut(&id) {
            if let Some(n) = change.name {
                k.name = n.trim().to_string();
            }
            if let Some(skin) = change.skin {
                k.skin = skin;
            }
            if let Some(m) = change.model {
                k.model = m;
            }
        }
    })?;
    state.refresh_voice_names();
    Ok(KeeperSaved { list: list(&state), announcement })
}

#[tauri::command]
pub fn keepers_remove(state: State<'_, AppState>, id: String) -> Result<KeeperList> {
    if state.settings().keepers.len() <= 1 {
        return Err(DeskError::Invalid("Keep at least one keeper.".into()));
    }
    state.update_settings(|s| {
        s.keepers.retain(|k| k.id != id);
        if s.active_keeper == id {
            s.active_keeper = s.keepers.first().map(|k| k.id.clone()).unwrap_or_default();
        }
    })?;
    state.refresh_voice_names();
    Ok(list(&state))
}

#[cfg(test)]
mod tests {
    #[test]
    fn names_and_graph_ids() {
        assert!(super::valid_name("Trini Boy") && !super::valid_name("<b>") && !super::valid_name(""));
        assert!(super::graph_id_for("x", true).starts_with("umoja-desk-"));
        let a = super::graph_id_for("Pup", false);
        assert!(a.starts_with("keeper-") && a != super::graph_id_for("Rex", false));
    }
}
