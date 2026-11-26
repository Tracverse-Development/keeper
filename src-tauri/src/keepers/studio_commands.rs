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
