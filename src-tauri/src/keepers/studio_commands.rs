//! The Studio's command: everything the full-page keeper editor shows besides the wardrobe, in
//! one call: the keeper's experience (level, XP, unlocks), its body's paint zones, materials and
//! habits, the rarities and each catalogue part's rarity. Saving goes through `keepers_update`
//! (look, habits, voice) and the wardrobe commands (outfit, level-gated by rarity).

use std::collections::BTreeMap;

use serde::Serialize;
use tauri::State;

use super::kit::{levels, look, rarity};
use crate::kernel::Result;
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitInfo {
    pub id: &'static str,
    pub name: &'static str,
}

/// A material the Look tab offers. `obtainedOnly` (a coat: fur, feathers) is never picked, only
/// worn once the keeper has obtained it; `rarity` is its grade.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub rarity: &'static str,
    pub obtained_only: bool,
}

/// The coat this body can grow: its material and the zones the coat switch paints.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoatInfo {
    pub material: &'static str,
    pub zones: &'static [&'static str],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Studio {
    pub keeper: String,
    pub experience: levels::Experience,
    pub zones: &'static [look::Zone],
    pub materials: Vec<MaterialInfo>,
    /// The coat this body can grow (`look::COATS`; None: no coat).
    pub coat: Option<CoatInfo>,
    /// The coats this keeper has obtained (it may wear these).
    pub obtained: Vec<String>,
    pub habits: Vec<HabitInfo>,
    pub max_habit: f64,
    pub rarities: &'static [rarity::Rarity],
    /// Catalogue part id → rarity id (parts not listed are common).
    pub part_rarity: BTreeMap<&'static str, &'static str>,
    pub unlocks: &'static [levels::Unlock],
    /// The finishes this keeper's body can wear (`kit::finishes`).
    pub finishes: Vec<&'static super::kit::finishes::Finish>,
    /// The starter keepers a person can add (`kit::starters`).
    pub starters: &'static [super::kit::starters::Starter],
}

#[tauri::command]
pub async fn keeper_studio(state: State<'_, AppState>, keeper: Option<String>) -> Result<Studio> {
    let profile = state.keeper_or_active(keeper.as_deref().unwrap_or(""))?;
    let memory = state.memory_for(&profile)?;
    let experience = levels::experience_or_why(&memory).await.map_err(|e| levels::unread(&profile.name, &e))?;
    levels::record_level(&profile.id, experience.level);
    Ok(Studio {
        keeper: profile.id.clone(),
        experience,
        zones: look::zones(&profile.skin),
        materials: look::MATERIALS.iter().map(|(id, name)| MaterialInfo { id, name, rarity: look::obtained_only(id).map_or("common", |r| r.id), obtained_only: look::obtained_only(id).is_some() }).collect(),
        coat: look::coat(&profile.skin).map(|(material, zones)| CoatInfo { material, zones }),
        obtained: look::obtained(&profile.obtained, &profile.look),
        habits: look::habits(&profile.skin).map(|(id, name, _)| HabitInfo { id, name }).collect(),
        max_habit: look::MAX_HABIT,
        rarities: &rarity::RARITIES,
        part_rarity: super::kit::parts::PARTS.iter().map(|p| (p.id, rarity::of_part(p.id).id)).collect(),
        unlocks: levels::UNLOCKS,
        finishes: super::kit::finishes::for_species(&profile.skin),
        starters: super::kit::starters::STARTERS,
    })
}

/// Keep a picture for a personal item (`kind`: "pendant" or "shirt"), sent as base64. Allowed
/// once the keeper's level has opened that item; the picture stays on this computer.
#[tauri::command]
pub async fn personal_set(state: State<'_, AppState>, keeper: String, kind: String, base64: String) -> Result<Vec<super::kit::personal::Picture>> {
    use base64::Engine;
    let profile = state.keeper_or_active(&keeper)?;
    let unlock = super::kit::personal::unlock_for(&kind).ok_or_else(|| crate::kernel::DeskError::Invalid("That isn't a personal item.".into()))?;
    let experience = levels::experience_or_why(&state.memory_for(&profile)?).await.map_err(|e| levels::unread(&profile.name, &e))?;
    if !experience.unlocked.iter().any(|u| u.id == unlock) {
        let level = levels::UNLOCKS.iter().find(|u| u.id == unlock).map(|u| u.level).unwrap_or(0);
        return Err(crate::kernel::DeskError::Invalid(format!("{} unlocks this at level {level} (now level {}).", profile.name, experience.level)));
    }
    if base64.len() > super::kit::personal::MAX_BYTES * 4 / 3 + 8 {
        return Err(crate::kernel::DeskError::Invalid("That picture is too big (4 MB at most).".into()));
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64.trim()).map_err(|_| crate::kernel::DeskError::Invalid("That picture could not be read.".into()))?;
    super::kit::personal::save(&profile.id, &kind, &bytes)?;
    Ok(super::kit::personal::list(&profile.id))
}

/// Remove a personal item's picture (the file is deleted).
#[tauri::command]
pub fn personal_remove(state: State<'_, AppState>, keeper: String, kind: String) -> Result<Vec<super::kit::personal::Picture>> {
    let profile = state.keeper_or_active(&keeper)?;
    super::kit::personal::remove(&profile.id, &kind)?;
    Ok(super::kit::personal::list(&profile.id))
}

/// A keeper's personal pictures (data URLs for the character to draw).
#[tauri::command]
pub fn personal_list(state: State<'_, AppState>, keeper: String) -> Result<Vec<super::kit::personal::Picture>> {
    Ok(super::kit::personal::list(&state.keeper_or_active(&keeper)?.id))
}

/// A keeper's feelings as the Studio shows them: its current (simulated) mood and why, whether the
/// person turned feelings off, and which modes allow a mood.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeelingsInfo {
    pub view: Option<crate::feelings::engine::FeelingsView>,
    pub off: bool,
    pub modes_with_mood: Vec<String>,
    /// The keeper shows a mood right now in the mode asked about: feelings are on, that mode
    /// allows a mood, and they are not set aside. The character's body follows it only then.
    pub shows: bool,
}

#[tauri::command]
pub fn keeper_feelings(state: State<'_, AppState>, keeper: Option<String>, mode: Option<String>) -> Result<FeelingsInfo> {
    let profile = state.keeper_or_active(keeper.as_deref().unwrap_or(""))?;
    let soul = state.soul(&profile.soul);
    let view = crate::feelings::store::view(&profile.id, &soul);
    // The mode asked about (none or unknown: the keeper's own).
    let mode = mode.filter(|m| super::kit::roles::exists(m)).unwrap_or_else(|| profile.role.clone());
    Ok(FeelingsInfo {
        shows: !crate::kernel::child_lock::on() && !profile.feelings_off && super::kit::roles::get(&mode).mood && view.as_ref().is_some_and(|v| !v.stepped_aside),
        view,
        off: profile.feelings_off,
        modes_with_mood: super::kit::roles::all().into_iter().filter(|m| m.mood).map(|m| m.title).collect(),
    })
}

/// Back to the soul's own calm: no emotions, no causes.
#[tauri::command]
pub fn feelings_reset(state: State<'_, AppState>, keeper: Option<String>) -> Result<FeelingsInfo> {
    let profile = state.keeper_or_active(keeper.as_deref().unwrap_or(""))?;
    crate::feelings::store::reset(&profile.id);
    keeper_feelings(state, Some(profile.id), None)
}
