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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Studio {
    pub keeper: String,
    pub experience: levels::Experience,
    pub zones: &'static [look::Zone],
    pub materials: Vec<HabitInfo>,
    pub habits: Vec<HabitInfo>,
    pub max_habit: f64,
    pub rarities: &'static [rarity::Rarity],
    /// Catalogue part id → rarity id (parts not listed are common).
    pub part_rarity: BTreeMap<&'static str, &'static str>,
    pub unlocks: &'static [levels::Unlock],
}

#[tauri::command]
pub async fn keeper_studio(state: State<'_, AppState>, keeper: Option<String>) -> Result<Studio> {
    let profile = state.keeper_or_active(keeper.as_deref().unwrap_or(""))?;
    let memory = state.memory_for(&profile)?;
    let experience = match levels::experience(&memory).await {
        Some(e) => {
            levels::record_level(&profile.id, e.level);
            e
        }
        None => return Err(crate::kernel::DeskError::Node("Your memory node isn't answering, so the level can't be read right now.".into())),
    };
    Ok(Studio {
        keeper: profile.id.clone(),
        experience,
        zones: look::zones(&profile.skin),
        materials: look::MATERIALS.iter().map(|(id, name)| HabitInfo { id, name }).collect(),
        habits: look::habits(&profile.skin).map(|(id, name, _)| HabitInfo { id, name }).collect(),
        max_habit: look::MAX_HABIT,
        rarities: &rarity::RARITIES,
        part_rarity: super::kit::parts::PARTS.iter().map(|p| (p.id, rarity::of_part(p.id).id)).collect(),
        unlocks: levels::UNLOCKS,
    })
}

/// Keep a picture for a personal item (`kind`: "pendant" or "shirt"), sent as base64. Allowed
/// once the keeper's level has opened that item; the picture stays on this computer.
#[tauri::command]
pub async fn personal_set(state: State<'_, AppState>, keeper: String, kind: String, base64: String) -> Result<Vec<super::kit::personal::Picture>> {
    use base64::Engine;
    let profile = state.keeper_or_active(&keeper)?;
    let unlock = super::kit::personal::unlock_for(&kind).ok_or_else(|| crate::kernel::DeskError::Invalid("That isn't a personal item.".into()))?;
    let experience = levels::experience(&state.memory_for(&profile)?)
        .await
        .ok_or_else(|| crate::kernel::DeskError::Node("Your memory node isn't answering, so the keeper's level can't be checked.".into()))?;
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

/// The largest keeper card taken (a 1080 x 1350 PNG is well under this).
const MAX_CARD_BYTES: usize = 12 * 1024 * 1024;
const PNG_MAGIC: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

/// The picture's bytes when `data` (base64) is a PNG of a sane size; nothing else is written.
fn card_bytes(data: &str) -> Result<Vec<u8>> {
    use base64::Engine;
    let refused = || crate::kernel::DeskError::Invalid("That isn't a keeper card picture.".into());
    if data.len() > MAX_CARD_BYTES * 4 / 3 + 8 {
        return Err(refused());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(data.trim()).map_err(|_| refused())?;
    if !bytes.starts_with(&PNG_MAGIC) || bytes.len() > MAX_CARD_BYTES {
        return Err(refused());
    }
    Ok(bytes)
}

/// `<name> keeper card.png` in `dir`, numbered when one is already there.
fn card_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    let clean: String = name.chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-').take(24).collect();
    let clean = if clean.trim().is_empty() { "Keeper".to_string() } else { clean.trim().to_string() };
    (1..100).map(|n| dir.join(if n == 1 { format!("{clean} keeper card.png") } else { format!("{clean} keeper card ({n}).png") })).find(|p| !p.exists()).unwrap_or_else(|| dir.join(format!("{clean} keeper card.png")))
}

/// Save a keeper card the Studio drew (a PNG, base64) to the Downloads folder and show it.
#[tauri::command]
pub fn card_save(name: String, data: String) -> Result<String> {
    let bytes = card_bytes(&data)?;
    let path = card_path(&dirs::download_dir().or_else(dirs::home_dir).unwrap_or_else(std::env::temp_dir), &name);
    std::fs::write(&path, bytes)?;
    crate::platform::reveal(&path);
    Ok(path.display().to_string())
}

#[cfg(test)]
mod card_tests {
    use base64::Engine;

    #[test]
    fn only_a_png_is_written_and_the_name_cannot_leave_the_folder() {
        let png = base64::engine::general_purpose::STANDARD.encode([super::PNG_MAGIC.as_slice(), b"rest"].concat());
        assert!(super::card_bytes(&png).is_ok());
        assert!(super::card_bytes(&base64::engine::general_purpose::STANDARD.encode(b"#!/bin/sh")).is_err());
        assert!(super::card_bytes("not base64 !!").is_err());
        let dir = std::path::Path::new("/tmp/cards");
        assert_eq!(super::card_path(dir, "../../etc/passwd"), dir.join("etcpasswd keeper card.png"));
        assert_eq!(super::card_path(dir, "Trini Boi"), dir.join("Trini Boi keeper card.png"));
        assert_eq!(super::card_path(dir, "///"), dir.join("Keeper keeper card.png"));
    }
}
