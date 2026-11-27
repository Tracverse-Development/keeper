//! The loadout commands (`kit::loadout` holds the rules): tie an official set to a mode, and dress
//! the keeper for the mode it is in now. The window calls `keeper_wear_mode` whenever the mode on
//! screen changes (the person picked one, a turn switched, a chat in another mode opened, the
//! keeper's default changed); only the pieces the keeper may wear now go on (body, race, level).

use tauri::State;

use super::kit::{self, loadout, parts};
use super::wardrobe_commands::own_items;
use super::KeeperList;
use crate::kernel::{DeskError, Result};
use crate::state::AppState;

/// Tie `set` to `mode` for keeper `keeper` (None or "" clears it). Refused for an unknown mode or
/// set, or a set with no piece this keeper's body may wear.
#[tauri::command]
pub fn keeper_set_loadout(state: State<'_, AppState>, keeper: String, mode: String, set: Option<String>) -> Result<KeeperList> {
    let profile = state.keeper_or_active(&keeper)?;
    if !kit::roles::exists(&mode) {
        return Err(DeskError::Invalid("There is no such mode.".into()));
    }
    let set = set.filter(|s| !s.is_empty());
    if let Some(id) = &set {
        let the_set = kit::collection::set(id).ok_or_else(|| DeskError::Invalid("There is no such set.".into()))?;
        let fits = kit::collection::all().filter(|o| o.set == the_set.id).any(|o| parts::check(&official_worn(o), &profile.skin).is_ok());
        if !fits {
            return Err(DeskError::Invalid(format!("{} can't wear any piece of {}.", profile.name, the_set.name)));
        }
    }
    state.update_settings(|s| {
        if let Some(k) = s.keeper_mut(&profile.id) {
            match &set {
                Some(id) => {
                    k.loadouts.insert(mode.clone(), id.clone());
                }
                None => {
                    k.loadouts.remove(&mode);
                }
            }
        }
    })?;
    Ok(super::list(&state))
}

/// Dress keeper `keeper` for `mode`: its loadout's pieces on, or what it wore before put back.
/// Returns whether the outfit changed (the window then reloads the keepers).
#[tauri::command]
pub async fn keeper_wear_mode(state: State<'_, AppState>, keeper: String, mode: String) -> Result<bool> {
    let profile = state.keeper_or_active(&keeper)?;
    let pieces = match profile.loadouts.get(&mode).and_then(|id| kit::collection::set(id)) {
        None => None,
        Some(the_set) => {
            let experience = kit::levels::experience_or_why(&state.memory_for(&profile)?).await.map_err(|e| kit::levels::unread(&profile.name, &e))?;
            let (own, _) = own_items(&state).await;
            let candidates = kit::wardrobe::items(&own)
                .into_iter()
                .filter(|i| i.set == the_set.id)
                .filter(|i| experience.may_wear(kit::rarity::get(i.rarity).unwrap_or_else(|| kit::rarity::of_part(&i.part))))
                .filter_map(|i| parts::check(&i.worn(), &profile.skin).ok())
                .collect();
            Some(loadout::one_per_slot(candidates))
        }
    };
    let (outfit, home) = match loadout::plan(&profile.wearables, profile.home_outfit.as_deref(), pieces.as_deref()) {
        loadout::Plan::Keep => return Ok(false),
        loadout::Plan::Wear { outfit, home } => (outfit, Some(home)),
        loadout::Plan::Restore { outfit } => (outfit, None),
    };
    state.update_settings(|s| {
        if let Some(k) = s.keeper_mut(&profile.id) {
            k.wearables = outfit;
            k.home_outfit = home;
        }
    })?;
    Ok(true)
}

fn official_worn(o: &kit::collection::Official) -> parts::WornPart {
    parts::WornPart { part: o.part.into(), effects: Default::default(), item: Some(format!("official:{}", o.id)), rarity: None, set: None }
}
