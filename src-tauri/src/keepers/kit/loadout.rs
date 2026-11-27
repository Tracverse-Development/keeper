//! Loadouts: a keeper dresses for the job. Each mode may name an official set (`collection`):
//! when the keeper's mode changes to one with a loadout, it puts on every piece of that set it can
//! wear (its body and race fit, its level opens the rarity); when it moves on to a mode without one,
//! what it wore before is put back. Moving between two modes that both have loadouts keeps the
//! outfit it started from, so the last move home restores the right thing.
//!
//! Pure: `plan` decides from the outfit now, the outfit kept from before and the pieces the new
//! mode's set offers (the commands in `keepers/loadout_commands.rs` read the level and the wardrobe
//! and save the result). Tested below.

use std::collections::BTreeMap;

use super::parts::{self, WornPart};

/// What a change of mode does to the outfit.
#[derive(Debug, Clone, PartialEq)]
pub enum Plan {
    /// Wear `outfit`, keeping `home` (what it wore before any loadout) to come back to.
    Wear { outfit: Vec<WornPart>, home: Vec<WornPart> },
    /// Put `outfit` back (the one kept from before) and forget it.
    Restore { outfit: Vec<WornPart> },
    /// Nothing to change.
    Keep,
}

/// The slots `worn` takes (its own and any it covers, the gown's legs).
fn taken(worn: &[WornPart]) -> Vec<&'static str> {
    worn.iter().flat_map(|w| parts::takes(&w.part)).collect()
}

/// Decide the outfit for a new mode. `pieces` is what the new mode's set offers this keeper now
/// (None: the mode has no loadout; Some(empty): it has one but nothing can be worn yet, so the
/// outfit stays as it is).
pub fn plan(current: &[WornPart], home: Option<&[WornPart]>, pieces: Option<&[WornPart]>) -> Plan {
    match pieces {
        Some(pieces) if !pieces.is_empty() => {
            // Always dress from the outfit worn before any loadout, never on top of another set.
            let base = home.unwrap_or(current);
            let slots = taken(pieces);
            let mut outfit: Vec<WornPart> = base.iter().filter(|w| !parts::takes(&w.part).iter().any(|s| slots.contains(s))).cloned().collect();
            outfit.extend(pieces.iter().cloned());
            if outfit == current {
                return Plan::Keep;
            }
            Plan::Wear { outfit, home: base.to_vec() }
        }
        Some(_) => Plan::Keep,
        None => match home {
            Some(home) => Plan::Restore { outfit: home.to_vec() },
            None => Plan::Keep,
        },
    }
}

/// The pieces of a set to wear at once: the first piece wins a slot two pieces share.
pub fn one_per_slot(candidates: Vec<WornPart>) -> Vec<WornPart> {
    let mut out: Vec<WornPart> = Vec::new();
    for c in candidates {
        let slots = parts::takes(&c.part);
        if !taken(&out).iter().any(|s| slots.contains(s)) {
            out.push(c);
        }
    }
    out
}

/// Loadouts worth keeping: a real mode and a real set (from a backup or an old file).
pub fn checked(loadouts: &BTreeMap<String, String>) -> BTreeMap<String, String> {
    loadouts.iter().filter(|(mode, set)| super::roles::exists(mode) && super::collection::set(set).is_some()).map(|(m, s)| (m.clone(), s.clone())).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn w(part: &str, item: &str) -> WornPart {
        WornPart { part: part.into(), effects: Default::default(), item: Some(item.into()), rarity: None, set: None }
    }

    #[test]
    fn a_loadout_swaps_only_the_slots_its_set_takes_and_remembers_what_was_worn() {
        let everyday = vec![w("memory-halo", "part:memory-halo"), w("ark-hull", "part:ark-hull"), w("crew-cap", "official:forest-cap")];
        let explorer = vec![w("brim-hat", "official:wide-brim-hat"), w("trousers", "official:cargo-trousers")];
        let Plan::Wear { outfit, home } = plan(&everyday, None, Some(&explorer)) else { panic!("it dresses for the mode") };
        assert_eq!(home, everyday, "the outfit from before is kept");
        assert!(outfit.contains(&explorer[0]) && outfit.contains(&explorer[1]));
        assert!(!outfit.contains(&everyday[2]), "the cap comes off: the hat takes the head");
        assert!(outfit.contains(&everyday[0]) && outfit.contains(&everyday[1]), "the halo and ark stay");
    }

    #[test]
    fn moving_between_two_loadouts_dresses_from_the_original_and_going_home_restores_it() {
        let everyday = vec![w("crew-cap", "official:forest-cap"), w("knit-scarf", "official:sky-scarf")];
        let explorer = vec![w("brim-hat", "official:wide-brim-hat")];
        let scholar = vec![w("round-spectacles", "official:owl-spectacles")];
        let Plan::Wear { outfit: in_explorer, home } = plan(&everyday, None, Some(&explorer)) else { panic!() };
        let Plan::Wear { outfit: in_scholar, home: still } = plan(&in_explorer, Some(&home), Some(&scholar)) else { panic!() };
        assert_eq!(still, everyday, "the kept outfit is still the one from before any loadout");
        assert!(in_scholar.contains(&everyday[0]), "the Explorer hat does not linger: the cap is back under the Scholar set");
        assert!(!in_scholar.contains(&explorer[0]));
        assert_eq!(plan(&in_scholar, Some(&still), None), Plan::Restore { outfit: everyday });
    }

    #[test]
    fn no_loadout_and_nothing_kept_changes_nothing_and_an_unwearable_set_changes_nothing() {
        let everyday = vec![w("crew-cap", "official:forest-cap")];
        assert_eq!(plan(&everyday, None, None), Plan::Keep);
        assert_eq!(plan(&everyday, None, Some(&[])), Plan::Keep, "nothing of the set opened yet: stay dressed as before");
        assert_eq!(plan(&everyday, Some(&everyday), Some(&everyday)), Plan::Keep, "already dressed for it");
    }

    #[test]
    fn a_set_puts_on_one_piece_per_slot_and_a_gown_keeps_trousers_out() {
        let pieces = one_per_slot(vec![w("top", "official:crew-tee"), w("top", "official:zip-hoodie"), w("gown", "official:evening-gown"), w("trousers", "official:denim-jeans")]);
        assert_eq!(pieces.iter().map(|p| p.item.clone().unwrap()).collect::<Vec<_>>(), ["official:crew-tee", "official:denim-jeans"], "the first top wins; the gown has no torso left");
        let gown_first = one_per_slot(vec![w("gown", "official:evening-gown"), w("trousers", "official:denim-jeans")]);
        assert_eq!(gown_first.len(), 1, "the gown takes the legs");
    }

    #[test]
    fn only_real_modes_and_real_sets_survive() {
        let mut map = BTreeMap::new();
        map.insert("researcher".to_string(), "explorer".to_string());
        map.insert("tutor".to_string(), "no-such-set".to_string());
        map.insert("pirate".to_string(), "explorer".to_string());
        assert_eq!(checked(&map).into_iter().collect::<Vec<_>>(), [("researcher".to_string(), "explorer".to_string())]);
    }

    #[test]
    fn an_older_profile_loads_with_no_loadouts_and_an_empty_one_is_not_written() {
        let old: crate::kernel::settings::KeeperProfile = serde_json::from_str(r#"{"id":"keeper-1","name":"Pup","skin":"puppy","role":"companion"}"#).unwrap();
        assert!(old.loadouts.is_empty() && old.home_outfit.is_none());
        let text = serde_json::to_string(&old).unwrap();
        assert!(!text.contains("loadouts") && !text.contains("homeOutfit"));
        let mut dressed = old.clone();
        dressed.loadouts.insert("tutor".into(), "scholar".into());
        let back: crate::kernel::settings::KeeperProfile = serde_json::from_str(&serde_json::to_string(&dressed).unwrap()).unwrap();
        assert_eq!(back.loadouts.get("tutor").map(String::as_str), Some("scholar"));
    }
}
