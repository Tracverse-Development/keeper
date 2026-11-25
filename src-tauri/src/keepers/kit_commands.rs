//! The Kit's commands: the catalog (species, parts, roles, souls, variants), saving a soul,
//! exporting a pack to the Downloads folder, and importing a pack (validated by `kit::packs`).

use serde::Serialize;
use tauri::State;

use super::kit::packs::{self, KeeperBlueprint, Pack, Variant};
use super::kit::{inventory, parts, roles, souls, species};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::slug::short_hash;
use crate::kernel::{time, DeskError, Result};
use crate::platform;
use crate::state::AppState;

#[derive(Serialize)]
pub struct Catalog {
    pub species: &'static [species::Species],
    pub parts: &'static [parts::Part],
    pub roles: &'static [roles::Role],
    pub souls: Vec<souls::Soul>,
    pub variants: Vec<Variant>,
}

#[tauri::command]
pub async fn kit_catalog(state: State<'_, AppState>) -> Result<Catalog> {
    state.refresh_souls().await;
    let variants = match state.client() {
        Ok(c) => match inventory::kit(&c).await { Ok(g) => inventory::variants(&c, &g).await, Err(e) => Err(e) }.unwrap_or_default(),
        Err(_) => vec![],
    };
    let mut all = souls::builtin();
    all.extend(state.custom_souls());
    Ok(Catalog { species: species::SPECIES, parts: parts::PARTS, roles: roles::ROLES, souls: all, variants })
}

/// Save (create or update) one of the person's own souls in their kit graph.
#[tauri::command]
pub async fn souls_save(state: State<'_, AppState>, soul: souls::Soul) -> Result<souls::Soul> {
    let clean = souls::sanitize(&soul).map_err(DeskError::Invalid)?;
    let client = state.client()?;
    inventory::save_soul(&client, &inventory::kit(&client).await?, &clean).await?;
    state.refresh_souls().await;
    Ok(clean)
}

fn downloads_file(name: &str) -> std::path::PathBuf {
    let base: String = name.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect();
    let dir = dirs::download_dir().or_else(dirs::home_dir).unwrap_or_else(std::env::temp_dir);
    dir.join(format!("{}.keeper.json", base.trim_matches('-')))
}

/// Export a keeper (soul, role, body, outfit; never memories) or one soul as a pack file in
/// Downloads, and show it in the file manager. Returns the file path.
#[tauri::command]
pub fn pack_export(state: State<'_, AppState>, kind: String, id: String) -> Result<String> {
    let (pack, name) = match kind.as_str() {
        "keeper" => {
            let k = state.settings().keeper(&id).cloned().ok_or_else(|| DeskError::Invalid("There is no such keeper.".into()))?;
            let bp = KeeperBlueprint { name: k.name.clone(), species: k.skin.clone(), role: k.role.clone(), soul: state.soul(&k.soul), wearables: k.wearables.clone() };
            (Pack::Keeper { format: packs::FORMAT.into(), keeper: bp }, k.name)
        }
        "soul" => {
            let s = state.soul_known(&id).ok_or_else(|| DeskError::Invalid("That soul isn't in your kit.".into()))?;
            let name = s.name.clone();
            (Pack::Soul { format: packs::FORMAT.into(), soul: s }, name)
        }
        _ => return Err(DeskError::Invalid("Choose a keeper or a soul to share.".into())),
    };
    let path = downloads_file(&name);
    std::fs::write(&path, packs::write(&pack))?;
    platform::reveal(&path);
    Ok(path.display().to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Imported {
    pub kind: &'static str,
    pub name: String,
    /// For a keeper pack: the new keeper's id (it becomes the active keeper).
    pub keeper: Option<String>,
}

/// Import a pack file's text: a soul or variant goes into the person's kit on the DKG; a keeper
/// becomes a new keeper with its own fresh graph (no memories come with it).
#[tauri::command]
pub async fn pack_import(state: State<'_, AppState>, text: String) -> Result<Imported> {
    let client = state.client()?;
    let kit = inventory::kit(&client).await?;
    match packs::read(&text).map_err(DeskError::Invalid)? {
        Pack::Soul { soul, .. } => {
            inventory::save_soul(&client, &kit, &soul).await?;
            state.refresh_souls().await;
            Ok(Imported { kind: "soul", name: soul.name, keeper: None })
        }
        Pack::Variant { variant, .. } => {
            inventory::save_variant(&client, &kit, &variant).await?;
            Ok(Imported { kind: "variant", name: variant.name, keeper: None })
        }
        Pack::Keeper { keeper: bp, .. } => {
            let settings = state.settings();
            let name = if settings.keepers.iter().any(|k| k.name.eq_ignore_ascii_case(&bp.name)) { format!("{} 2", bp.name) } else { bp.name.clone() };
            if !bp.soul.builtin {
                inventory::save_soul(&client, &kit, &bp.soul).await?;
                state.refresh_souls().await;
            }
            let seed = format!("{name}\u{0}{}", time::now_iso());
            let profile = KeeperProfile {
                id: format!("keeper-{}", short_hash(&seed, 10)),
                name: name.clone(),
                skin: bp.species.clone(),
                role: bp.role.clone(),
                soul: bp.soul.id.clone(),
                wearables: bp.wearables.clone(),
                graph_id: super::graph_id_for(&seed, false),
                brain: settings.active().map(|k| k.brain.clone()).unwrap_or_else(|| "reflex".into()),
                model: settings.active().map(|k| k.model.clone()).unwrap_or_default(),
            };
            super::write_profile(&client, &profile, &bp.soul).await?;
            let id = profile.id.clone();
            state.update_settings(|s| {
                s.active_keeper = id.clone();
                s.keepers.push(profile);
            })?;
            state.refresh_voice_names();
            Ok(Imported { kind: "keeper", name, keeper: Some(id) })
        }
    }
}
