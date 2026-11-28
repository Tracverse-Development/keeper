//! Keepers: each keeper is assembled from the Keeper Kit (`kit/`, docs/design/keeper-kit.md):
//! a SOUL (who it is), a ROLE (what it can do), a BODY (species + wearables) and its own Context
//! Graph (its memory). Keeper #1 is the System Administration keeper.
//!
//! Creating a keeper creates its graph on the node and writes its profile as the graph's first
//! Knowledge Asset (who it is, what it keeps, its look), then proves the round trip by reading
//! the name back. Removing a keeper takes it off this computer's list; its graph stays on the
//! node (DKG writes are additive; nothing here deletes graph data).

pub mod kit;
pub mod kit_commands;
pub mod loadout_commands;
pub mod photo_commands;
pub mod season_commands;
pub mod studio_commands;
pub mod wardrobe_commands;

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
pub const SKINS: &[&str] = &["robot", "puppy", "man", "woman", "owl", "god"];
const MAX_KEEPERS: usize = 12;

/// A short, safe name (it is also a wake word and a graph label).
pub fn valid_name(name: &str) -> bool {
    let n = name.trim();
    !n.is_empty() && n.chars().count() <= 24 && n.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-')
}

/// Where a keeper's memory lives (its sub-graph of the home graph, after the move).
pub fn place_of(keeper: &KeeperProfile) -> crate::dkg::Place {
    crate::dkg::Place::new(&keeper.graph_id, keeper.memory_sub.as_deref())
}

/// The backup of a keeper's memory from before the move (the old graph, its root).
pub fn legacy_place_of(keeper: &KeeperProfile) -> Option<crate::dkg::Place> {
    keeper.legacy_graph.as_deref().map(crate::dkg::Place::from)
}

/// This install's short id (names no person): the computer account, or a test copy's own folder
/// (`KEEPER_HOME`), so a test copy never writes into the real home graph.
pub fn install_base() -> String {
    let home = match std::env::var("KEEPER_HOME") {
        Ok(dir) if !dir.is_empty() => format!("test\u{0}{dir}"),
        _ => dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default(),
    };
    short_hash(&format!("{home}\u{0}{}", platform::computer_name()), 10)
}

/// A new graph id: names no person, stable per keeper. The first keeper keeps the pre-keepers
/// spelling (`umoja-desk-<hash>`) so an existing graph keeps its exact id.
pub fn graph_id_for(seed: &str, first: bool) -> String {
    let base = install_base();
    if first {
        format!("umoja-desk-{base}")
    } else {
        format!("keeper-{base}-{}", short_hash(seed, 8))
    }
}

/// Create the keeper's graph and profile asset; returns the profile's UAL and whether the
/// read-back matched.
pub async fn write_profile(client: &DkgClient, keeper: &KeeperProfile, soul: &kit::souls::Soul) -> Result<(String, bool)> {
    let role = kit::roles::get(&keeper.role);
    client.ensure_graph(&keeper.graph_id, "Keeper: your keepers' memory and kit").await?;
    if let Some(sub) = &keeper.memory_sub {
        client.ensure_sub_graph(&keeper.graph_id, sub).await?;
    }
    let _ = role;
    let mut quads = AssetBuilder::new(ASSISTANT)
        .a(class::AGENT)
        .a("schema:SoftwareApplication")
        .text(pred::NAME, &keeper.name)
        .text("desk:role", &keeper.role)
        .text("desk:domain", &keeper.role)
        .text("desk:skin", &keeper.skin)
        .text("desk:soul", &soul.id)
        .text("desk:wearables", &serde_json::to_string(&keeper.wearables).unwrap_or_default())
        .text("schema:description", &role.title)
        .link(pred::ABOUT, OWNER)
        .time(pred::AT, &time::now_iso())
        .build();
    quads.extend(AssetBuilder::new(OWNER).a(class::PERSON).time(pred::AT, &time::now_iso()).build());
    let written = client.write_asset(place_of(keeper), "desk-profile", &quads).await?;
    // The soul the keeper was born with, in its own graph: who it is travels with what it remembers.
    let soul_quads = AssetBuilder::new(&format!("urn:umoja:desk:soul:{}", soul.id))
        .a("desk:Soul")
        .text(pred::NAME, &soul.name)
        .text("desk:definition", &serde_json::to_string(soul).unwrap_or_default())
        .time(pred::AT, &time::now_iso())
        .build();
    client.write_asset(place_of(keeper), "desk-soul", &soul_quads).await?;
    let sparql = "PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> SELECT ?name WHERE { <urn:umoja:desk:agent:assistant> a prov:SoftwareAgent ; schema:name ?name } LIMIT 5";
    let rows = client.query(place_of(keeper), sparql, Layer::Working).await?;
    let verified = rows.iter().any(|r| r.get("name").is_some_and(|n| n == &keeper.name));
    Ok((written.ka_ual, verified))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperList {
    pub keepers: Vec<KeeperProfile>,
    pub active: String,
    pub roles: Vec<kit::roles::Role>,
}

pub(crate) fn list(state: &AppState) -> KeeperList {
    let s = state.settings();
    let active = s.active().map(|k| k.id.clone()).unwrap_or_default();
    // Each worn item goes to the window with its rarity, so the character draws its tier.
    let keepers = s.keepers.into_iter().map(|k| KeeperProfile { wearables: kit::rarity::stamped(&k.wearables), ..k }).collect();
    KeeperList { keepers, active, roles: kit::roles::all() }
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
    pub role: String,
    /// A soul id; empty = the role's default soul.
    #[serde(default)]
    pub soul: String,
    /// A starter keeper's id (`kit::starters`): its body, role and soul, wearing its starter piece.
    #[serde(default)]
    pub starter: String,
}

/// What a new keeper wears: the default halo and ark, plus a starter keeper's own piece.
fn starter_wearables(starter: Option<&kit::starters::Starter>) -> Vec<crate::kernel::settings::WornPart> {
    let mut worn = crate::kernel::settings::default_wearables();
    let piece = starter.and_then(|s| kit::collection::get(s.piece));
    if let Some(o) = piece {
        let effects = serde_json::from_str(o.effects).unwrap_or_default();
        let raw = crate::kernel::settings::WornPart { part: o.part.into(), effects, item: Some(format!("official:{}", o.id)), rarity: None, set: None, colour: None };
        if let Ok(ok) = kit::parts::check(&raw, starter.map(|s| s.skin).unwrap_or("")) {
            let slot = kit::parts::takes(&ok.part);
            worn.retain(|w| !kit::parts::takes(&w.part).iter().any(|s| slot.contains(s)));
            worn.push(ok);
        }
    }
    worn
}

#[tauri::command]
pub async fn keepers_create(state: State<'_, AppState>, mut keeper: NewKeeper) -> Result<KeeperList> {
    let starter = if keeper.starter.is_empty() { None } else { Some(kit::starters::get(&keeper.starter).ok_or_else(|| DeskError::Invalid("There is no such starter keeper.".into()))?) };
    if let Some(s) = starter {
        (keeper.skin, keeper.role, keeper.soul) = (s.skin.into(), s.role.into(), s.soul.into());
        if keeper.name.trim().is_empty() {
            keeper.name = s.name.into();
        }
    }
    if !valid_name(&keeper.name) {
        return Err(DeskError::Invalid("Give your keeper a short name (letters and numbers).".into()));
    }
    if !SKINS.contains(&keeper.skin.as_str()) || !kit::roles::exists(&keeper.role) {
        return Err(DeskError::Invalid("Choose one of the bodies and roles offered.".into()));
    }
    let soul = state.soul(if keeper.soul.is_empty() { kit::souls::default_for(&keeper.role) } else { &keeper.soul });
    let settings = state.settings();
    if settings.keepers.len() >= MAX_KEEPERS {
        return Err(DeskError::Invalid("That's the most keepers one computer can hold for now.".into()));
    }
    if settings.keepers.iter().any(|k| k.name.eq_ignore_ascii_case(keeper.name.trim())) {
        return Err(DeskError::Invalid("You already have a keeper with that name.".into()));
    }
    let seed = format!("{}\u{0}{}", keeper.name.trim(), time::now_iso());
    let first = settings.keepers.is_empty();
    let id = if first { "keeper-1".to_string() } else { format!("keeper-{}", short_hash(&seed, 10)) };
    let profile = KeeperProfile {
        memory_sub: Some(crate::memory::relocate::keeper_sub(&id)),
        legacy_graph: None,
        id,
        name: keeper.name.trim().to_string(),
        skin: keeper.skin,
        role: keeper.role,
        soul: soul.id.clone(),
        wearables: starter_wearables(starter),
        // Every keeper lives in the ONE home graph, in its own sub-graph.
        graph_id: graph_id_for(&seed, true),
        brain: settings.active().map(|k| k.brain.clone()).unwrap_or_else(|| "reflex".into()),
        model: settings.active().map(|k| k.model.clone()).unwrap_or_default(), look: Default::default(), habits: Default::default(), voice: None, style: String::new(), feelings_off: false, loadouts: Default::default(), home_outfit: None, mode_outfits: Default::default(), obtained: Vec::new()
    };
    write_profile(&state.client()?, &profile, &soul).await?;
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
    crate::assistant::warm::warm_keeper(&state, "");
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
    pub role: Option<String>,
    pub soul: Option<String>,
    pub wearables: Option<Vec<kit::parts::WornPart>>,
    /// Colour and material per paint zone (validated against the species' zones).
    pub look: Option<std::collections::BTreeMap<String, kit::look::ZoneLook>>,
    /// Idle habits, 0..3 each (validated against the species' habits).
    pub habits: Option<std::collections::BTreeMap<String, f64>>,
    /// Its own voice.
    pub voice: Option<crate::kernel::settings::KeeperVoice>,
    /// True: go back to the app-wide voice (`voice` is ignored).
    pub app_voice: Option<bool>,
    /// How it shows its answers (`brain::styles`).
    pub style: Option<String>,
    /// Turn its (simulated) mood off in every mode, or back on.
    pub feelings_off: Option<bool>,
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
    if let Some(r) = &change.role {
        if !kit::roles::exists(r) {
            return Err(DeskError::Invalid("That role does not exist.".into()));
        }
    }
    if let Some(soul) = &change.soul {
        if state.soul_known(soul).is_none() {
            return Err(DeskError::Invalid("That soul isn't in your kit.".into()));
        }
    }
    let outfit = match &change.wearables {
        // Saved without colours, each piece keeps the colour it is worn in (LES-039).
        Some(w) => Some(kit::colours::carried(&current.wearables, kit::parts::check_outfit(w, change.skin.as_deref().unwrap_or(&current.skin)).map_err(DeskError::Invalid)?)),
        None => None,
    };
    if let Some(m) = &change.style {
        if !crate::brain::styles::exists(m) {
            return Err(DeskError::Invalid("That style does not exist.".into()));
        }
    }
    let species = change.skin.clone().unwrap_or_else(|| current.skin.clone());
    let look = change.look.as_ref().map(|l| kit::look::check_look(l, &species));
    // A coat (fur, feathers) is obtained, never picked: a look may wear one only if this keeper
    // has it (`kit::look::OBTAINED_ONLY`). Saving keeps the coat obtained even when it is taken off.
    let before = if species == current.skin { current.look.clone() } else { Default::default() };
    let obtained = kit::look::obtained(&current.obtained, &before);
    if let Some(material) = look.as_ref().and_then(|l| kit::look::not_obtained(l, &obtained)) {
        return Err(DeskError::Invalid(format!("{material} can't be picked: a keeper has to obtain it, and {} hasn't yet.", current.name)));
    }
    let habits = change.habits.as_ref().map(|h| kit::look::check_habits(h, &species));
    if let Some(v) = &change.voice {
        if v.id.is_empty() || v.id.len() > 64 || !v.id.chars().all(|c| c.is_ascii_alphanumeric() || " ()-_.".contains(c)) {
            return Err(DeskError::Invalid("That isn't a voice.".into()));
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
            if let Some(r) = change.role {
                k.role = r;
            }
            if let Some(soul) = change.soul {
                k.soul = soul;
            }
            if let Some(w) = outfit {
                k.wearables = w;
            }
            if let Some(l) = look {
                k.obtained = obtained.clone();
                k.look = l;
            }
            if let Some(h) = habits {
                k.habits = h;
            }
            if let Some(m) = change.style {
                k.style = m;
            }
            if let Some(off) = change.feelings_off {
                k.feelings_off = off;
            }
            if change.app_voice == Some(true) {
                k.voice = None;
            } else if let Some(v) = change.voice {
                k.voice = Some(v);
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
    // Its personal pictures are personal data: they go with it.
    for (kind, _) in kit::personal::KINDS {
        kit::personal::remove(&id, kind)?;
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
