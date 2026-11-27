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
    /// The races (human, robot, animal, divine) species belong to and items are worn by.
    pub races: &'static [(&'static str, &'static str)],
    pub parts: &'static [parts::Part],
    pub roles: Vec<roles::Role>,
    pub souls: Vec<souls::Soul>,
    pub variants: Vec<Variant>,
}

#[tauri::command]
pub async fn kit_catalog(state: State<'_, AppState>) -> Result<Catalog> {
    state.refresh_souls().await;
    let variants = match state.client() {
        Ok(c) => match inventory::kit(&c, &state.kit_place()).await { Ok(g) => inventory::variants(&c, &g).await, Err(e) => Err(e) }.unwrap_or_default(),
        Err(_) => vec![],
    };
    let mut all = souls::builtin();
    all.extend(state.custom_souls());
    Ok(Catalog { species: species::SPECIES, races: species::RACES, parts: parts::PARTS, roles: roles::all(), souls: all, variants })
}

/// Save (create or update) one of the person's own souls in their kit graph.
#[tauri::command]
pub async fn souls_save(state: State<'_, AppState>, soul: souls::Soul) -> Result<souls::Soul> {
    if crate::kernel::child_lock::on() {
        return Err(DeskError::Invalid("Souls can't be changed on a child profile.".into()));
    }
    let clean = souls::sanitize(&soul).map_err(DeskError::Invalid)?;
    let client = state.client()?;
    inventory::save_soul(&client, &inventory::kit(&client, &state.kit_place()).await?, &clean).await?;
    state.refresh_souls().await;
    Ok(clean)
}

/// Save a mode: an edited built-in or one of the person's own (validated: tools from the closed
/// list, known skills, http(s) links). The keeper uses it from the next message.
#[tauri::command]
pub async fn modes_save(state: State<'_, AppState>, mode: roles::Role) -> Result<Vec<roles::Role>> {
    if crate::kernel::child_lock::on() {
        return Err(DeskError::Invalid("Modes can't be changed on a child profile.".into()));
    }
    let clean = roles::sanitize(&mode, &crate::skills::names()).map_err(DeskError::Invalid)?;
    let client = state.client()?;
    inventory::save_mode(&client, &inventory::kit(&client, &state.kit_place()).await?, &clean, false).await?;
    state.refresh_souls().await;
    Ok(roles::all())
}

/// Reset a built-in mode to Keeper's version, or delete one of the person's own modes.
#[tauri::command]
pub async fn modes_reset(state: State<'_, AppState>, id: String) -> Result<Vec<roles::Role>> {
    let mode = roles::all().into_iter().find(|m| m.id == id).ok_or_else(|| DeskError::Invalid("There is no such mode.".into()))?;
    if state.settings().keepers.iter().any(|k| k.role == id) && !mode.builtin {
        return Err(DeskError::Invalid(format!("A keeper uses {} as its default mode; choose another first.", mode.title)));
    }
    let client = state.client()?;
    inventory::save_mode(&client, &inventory::kit(&client, &state.kit_place()).await?, &mode, true).await?;
    state.refresh_souls().await;
    Ok(roles::all())
}

/// One skill a mode can be given: its name and what it does.
#[derive(Serialize)]
pub struct SkillInfo {
    pub name: &'static str,
    pub what: &'static str,
}

/// Every skill a mode can be given (the Studio's Modes tab).
#[tauri::command]
pub fn skills_list() -> Vec<SkillInfo> {
    crate::skills::catalogue().into_iter().map(|(name, what)| SkillInfo { name, what }).collect()
}

/// Every mode in effect (built-ins, edited built-ins, the person's own).
#[tauri::command]
pub fn modes_list() -> Vec<roles::Role> {
    roles::all()
}

pub(super) fn downloads_file(name: &str) -> std::path::PathBuf {
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
            let bp = KeeperBlueprint { name: k.name.clone(), species: k.skin.clone(), role: k.role.clone(), soul: state.soul(&k.soul), wearables: packs::data_only(&k.wearables), look: k.look.clone(), habits: k.habits.clone() };
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
    std::fs::write(&path, packs::write(&pack, packs::clean_maker(&state.settings().maker_name, &state.settings().maker_link).as_ref())?)?;
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
    // A pack that says it is signed but does not check out was changed or forged: refused.
    let signature = super::kit::pack_sign::check(&text);
    if signature == super::kit::pack_sign::Check::Broken {
        return Err(DeskError::Invalid("This pack's signature doesn't match its contents: it was changed after it was made, so I won't add it.".into()));
    }
    // A signed pack's key is remembered with the maker name it gave (trust on first use).
    if let (super::kit::pack_sign::Check::Valid { key, .. }, Some(maker)) = (&signature, packs::maker_of(&text)) {
        let (key, name) = (key.clone(), maker.name);
        let _ = state.update_settings(|s| {
            s.known_makers.entry(key).or_insert(name);
        });
    }
    if crate::kernel::child_lock::on() {
        return Err(DeskError::Invalid("Packs from other people are switched off on a child profile.".into()));
    }
    let client = state.client()?;
    let kit = inventory::kit(&client, &state.kit_place()).await?;
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
            let id = format!("keeper-{}", short_hash(&seed, 10));
            let profile = KeeperProfile {
                memory_sub: Some(crate::memory::relocate::keeper_sub(&id)),
                legacy_graph: None,
                id,
                name: name.clone(),
                skin: bp.species.clone(),
                role: bp.role.clone(),
                soul: bp.soul.id.clone(),
                wearables: bp.wearables.clone(),
                graph_id: super::graph_id_for(&seed, true),
                brain: settings.active().map(|k| k.brain.clone()).unwrap_or_else(|| "reflex".into()),
                model: settings.active().map(|k| k.model.clone()).unwrap_or_default(),
                look: bp.look.clone(),
                habits: bp.habits.clone(),
                voice: None,
                style: String::new(),
                feelings_off: false,
                loadouts: Default::default(),
                home_outfit: None,
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

/// What a pack says about where it comes from, checked before it is added: its signature, its
/// maker, and whether this key or this maker's name was seen before.
#[tauri::command]
pub fn pack_check(state: State<'_, AppState>, text: String) -> Result<super::kit::pack_sign::Trust> {
    if text.len() > packs::MAX_BYTES {
        return Err(DeskError::Invalid("That file is too big to be a keeper pack.".into()));
    }
    Ok(super::kit::pack_sign::trust(&text, &state.settings().known_makers))
}
