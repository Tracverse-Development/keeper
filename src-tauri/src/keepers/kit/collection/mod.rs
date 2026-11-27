//! The official collection: items Keeper ships, each with a rarity the catalogue gives it (a
//! community pack can never claim one; its items take their part's rarity), most of them in a
//! SET. Shown in the Studio's Marketplace and in every wardrobe (`official:<id>`), worn once the
//! keeper's level reaches the rarity. No payments and no supply yet: items are earned by level
//! (founder decisions D5 and D9 for later).
//!
//! Items are data over the shape kits (`parts.rs`): a part, its colours and its `style`. A set names
//! who may wear its pieces (`species::may_wear`: one body, a race, or everyone), a theme, its bonus
//! and its reward (the set's signature piece). Wear three pieces of one set and they glow together
//! (`set_glow`). The God Keeper wears every set (its race wears everything).
//!
//! One file per group of sets keeps each under the size budget: `classic.rs` (no set), `robot.rs`,
//! `dog.rs`, `man.rs`, `woman.rs`, `owl.rs`, `shared.rs` (race and everyone sets), `divine.rs` and
//! `hero_sets.rs` (0.16.0: one new set per keeper, each round two new set pieces).

mod classic;
mod divine;
mod dog;
mod hero_sets;
mod man;
mod owl;
mod robot;
mod shared;
mod woman;

use serde::Serialize;

/// One official item: a part in its own colours and settings, with a rarity, one line and its set.
pub struct Official {
    pub id: &'static str,
    pub name: &'static str,
    pub part: &'static str,
    pub rarity: &'static str,
    pub blurb: &'static str,
    /// Effect values as JSON (validated against the part's schema like any item).
    pub effects: &'static str,
    /// The set it belongs to ("" for none).
    pub set: &'static str,
}

/// A set of official items.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemSet {
    pub id: &'static str,
    pub name: &'static str,
    /// Who may wear its pieces: species or race ids; empty = everyone.
    pub who: &'static [&'static str],
    pub theme: &'static str,
    pub bonus: &'static str,
    /// The set's signature piece (an official item id in the set).
    pub reward: &'static str,
}

const GROUPS: &[(&[ItemSet], &[Official])] =
    &[(&[], classic::ITEMS), (robot::SETS, robot::ITEMS), (dog::SETS, dog::ITEMS), (man::SETS, man::ITEMS), (woman::SETS, woman::ITEMS), (owl::SETS, owl::ITEMS), (shared::SETS, shared::ITEMS), (divine::SETS, divine::ITEMS), (hero_sets::SETS, hero_sets::ITEMS)];

/// Pieces of one set worn at once for the set glow.
pub const SET_GLOW_PIECES: usize = 3;

/// Every official item, in catalogue order.
pub fn all() -> impl Iterator<Item = &'static Official> {
    GROUPS.iter().flat_map(|(_, items)| items.iter())
}

/// Every set, in catalogue order.
pub fn sets() -> impl Iterator<Item = &'static ItemSet> {
    GROUPS.iter().flat_map(|(sets, _)| sets.iter())
}

pub fn get(id: &str) -> Option<&'static Official> {
    all().find(|o| o.id == id)
}

pub fn set(id: &str) -> Option<&'static ItemSet> {
    sets().find(|s| s.id == id)
}

/// The official item a worn reference names (`official:<id>`), if any.
pub fn of_ref(item: Option<&str>) -> Option<&'static Official> {
    item.and_then(|i| i.strip_prefix("official:")).and_then(get)
}

/// Who may wear official item `o`: its set's rule (empty = no rule beyond its part's).
pub fn who(o: &Official) -> &'static [&'static str] {
    set(o.set).map(|s| s.who).unwrap_or(&[])
}

/// The sets a keeper's outfit glows for: every set with at least `SET_GLOW_PIECES` pieces worn.
pub fn glowing(worn: &[super::parts::WornPart]) -> Vec<&'static str> {
    let mut count: std::collections::BTreeMap<&str, usize> = Default::default();
    for w in worn {
        if let Some(o) = of_ref(w.item.as_deref()).filter(|o| !o.set.is_empty()) {
            *count.entry(o.set).or_default() += 1;
        }
    }
    count.into_iter().filter(|(_, n)| *n >= SET_GLOW_PIECES).map(|(s, _)| s).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_official_item_is_valid_rated_and_unique() {
        let mut ids = std::collections::BTreeSet::new();
        for o in all() {
            assert!(ids.insert(o.id), "{} is listed twice", o.id);
            let effects: std::collections::BTreeMap<String, serde_json::Value> = serde_json::from_str(o.effects).expect(o.id);
            let worn = super::super::parts::check_effects(&super::super::parts::WornPart { part: o.part.into(), effects: effects.clone(), item: None, rarity: None, set: None }).expect(o.id);
            assert_eq!(worn.effects.len(), effects.len(), "{}: every effect is in its part's schema and range", o.id);
            assert!(super::super::rarity::get(o.rarity).is_some(), "{}", o.id);
            assert!(o.set.is_empty() || set(o.set).is_some(), "{}: its set {} exists", o.id, o.set);
        }
        for r in super::super::rarity::RARITIES {
            assert!(all().any(|o| o.rarity == r.id), "the collection has a {} item", r.id);
        }
    }

    #[test]
    fn every_set_has_pieces_a_reward_inside_it_and_someone_to_wear_it() {
        use super::super::species::{may_wear, SPECIES};
        let mut ids = std::collections::BTreeSet::new();
        for s in sets() {
            assert!(ids.insert(s.id), "set {} is listed twice", s.id);
            let pieces: Vec<_> = all().filter(|o| o.set == s.id).collect();
            assert!(pieces.len() >= 4, "{} has {} pieces", s.id, pieces.len());
            assert!(pieces.iter().any(|o| o.id == s.reward), "{}: its reward is one of its pieces", s.id);
            let wearers: Vec<_> = SPECIES.iter().filter(|sp| may_wear(s.who, sp.id)).collect();
            assert!(!wearers.is_empty(), "{}: some body wears it", s.id);
            // Every piece fits at least one body the set is for (its slot is offered and its part allows it).
            for o in &pieces {
                let fits = wearers.iter().any(|sp| {
                    let worn = super::super::parts::WornPart { part: o.part.into(), effects: Default::default(), item: Some(format!("official:{}", o.id)), rarity: None, set: None };
                    super::super::parts::check(&worn, sp.id).is_ok()
                });
                assert!(fits, "{} ({}) fits nobody it is for", o.id, s.id);
            }
        }
    }

    #[test]
    fn set_rules_keep_pieces_on_their_own_bodies() {
        let check = |id: &str, species: &str| {
            let o = get(id).unwrap();
            super::super::parts::check(&super::super::parts::WornPart { part: o.part.into(), effects: Default::default(), item: Some(format!("official:{id}")), rarity: None, set: None }, species).is_ok()
        };
        assert!(check("linen-shirt", "man") && !check("linen-shirt", "woman") && !check("linen-shirt", "robot"), "a man's piece fits only the man");
        assert!(check("evening-gown", "woman") && !check("evening-gown", "man"));
        assert!(check("crew-tee", "man") && check("crew-tee", "woman") && !check("crew-tee", "owl"), "a human piece fits any human");
        assert!(check("charm-collar", "puppy") && check("charm-collar", "owl") && !check("charm-collar", "man"));
        assert!(check("pilgrim-scarf", "robot") && check("pilgrim-scarf", "owl"), "Ark Pilgrim is for everyone");
        for id in ["linen-shirt", "evening-gown", "navigator-plating", "rescue-vest", "tweed-waistcoat", "seraph-crown"] {
            assert!(check(id, "god"), "the God Keeper wears {id}");
        }
        assert!(!check("seraph-crown", "man"), "the regalia is the God Keeper's own");
    }

    #[test]
    fn three_pieces_of_a_set_glow_and_two_do_not() {
        let w = |id: &str| super::super::parts::WornPart { part: get(id).unwrap().part.into(), effects: Default::default(), item: Some(format!("official:{id}")), rarity: None, set: None };
        assert!(glowing(&[w("linen-shirt"), w("straw-fedora")]).is_empty());
        assert_eq!(glowing(&[w("linen-shirt"), w("straw-fedora"), w("rolled-chinos"), w("field-watch")]), ["island-linen"]);
    }
}
