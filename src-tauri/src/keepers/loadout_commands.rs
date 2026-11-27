//! The loadout commands (`kit::loadout` holds the rules): tie an official set to a mode, and dress
//! the keeper for the mode it is in now. The window calls `keeper_wear_mode` whenever the mode on
//! screen changes (the person picked one, a turn switched, a chat in another mode opened, the
//! keeper's default changed); only the pieces the keeper may wear now go on (body, race, level).
//! What the person changes by hand while in a loadout mode is remembered for that mode
//! (`loadout::change_mode`).

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
            // Another set (or none) for this mode: its remembered outfit was made from the old one.
            if k.loadouts.get(&mode) != set.as_ref() {
                k.mode_outfits.worn.remove(&mode);
                if k.mode_outfits.on.as_deref() == Some(mode.as_str()) {
                    k.mode_outfits.on = None;
                }
            }
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
    // A remembered outfit that no longer fits (the body changed) is forgotten: the set dresses anew.
    let mut memory = profile.mode_outfits.clone();
    memory.worn.retain(|_, outfit| parts::check_outfit(outfit, &profile.skin).is_ok());
    let (plan, memory) = loadout::change_mode(&profile.wearables, profile.home_outfit.as_deref(), &memory, &mode, pieces.as_deref());
    let change = match plan {
        loadout::Plan::Keep => None,
        loadout::Plan::Wear { outfit, home } => Some((outfit, Some(home))),
        loadout::Plan::Restore { outfit } => Some((outfit, None)),
    };
    let changed = change.is_some();
    if changed || memory != profile.mode_outfits {
        state.update_settings(|s| {
            if let Some(k) = s.keeper_mut(&profile.id) {
                if let Some((outfit, home)) = change {
                    k.wearables = outfit;
                    k.home_outfit = home;
                }
                k.mode_outfits = memory;
            }
        })?;
    }
    Ok(changed)
}

fn official_worn(o: &kit::collection::Official) -> parts::WornPart {
    parts::WornPart { part: o.part.into(), effects: Default::default(), item: Some(format!("official:{}", o.id)), rarity: None, set: None, colour: None }
}
