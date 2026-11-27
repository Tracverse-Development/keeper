//! Species: the keeper's body (its rig, how it moves, its built-in reactions) and the slots it
//! offers for wearables. A body is not a part: a robot body can never be worn by a dog. Mirrors
//! the window's species registry (`src/character/skins/catalog.ts`; `structure.test.ts` keeps the
//! slot lists equal). A species that leaves a slot out simply cannot wear parts for it, and the
//! wardrobe says so in plain words instead of failing.

//!
//! Every species belongs to a RACE (human, robot, animal, divine). An item names who may wear it
//! by species or by race (`parts.rs`: `["human"]` fits the man and the woman); the God Keeper
//! (race `divine`) wears everything from every race, each piece drawn in its own divine finish.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Species {
    pub id: &'static str,
    pub name: &'static str,
    pub race: &'static str,
    pub slots: &'static [&'static str],
}

/// The races, in the order the Studio lists them.
pub const RACES: &[(&str, &str)] = &[("human", "Human"), ("robot", "Robot"), ("animal", "Animal"), ("divine", "Divine")];

/// The race that may wear anything from any race.
pub const WEARS_EVERYTHING: &str = "divine";

pub const SPECIES: &[Species] = &[
    Species { id: "robot", name: "Robot", race: "robot", slots: &["halo", "head", "face", "neck", "torso", "back", "base", "aura", "thinking", "celebrate"] },
    Species { id: "puppy", name: "Dog", race: "animal", slots: &["halo", "head", "face", "neck", "torso", "back", "paws", "base", "aura", "thinking", "celebrate"] },
    Species { id: "man", name: "Man", race: "human", slots: &["halo", "head", "face", "neck", "torso", "legs", "back", "paws", "wrist", "held", "base", "aura", "thinking", "celebrate"] },
    Species { id: "woman", name: "Woman", race: "human", slots: &["halo", "head", "face", "neck", "torso", "legs", "back", "paws", "wrist", "held", "base", "aura", "thinking", "celebrate"] },
    Species { id: "owl", name: "Owl", race: "animal", slots: &["halo", "head", "face", "neck", "torso", "back", "paws", "base", "aura", "thinking", "celebrate"] },
    Species { id: "god", name: "God Keeper", race: "divine", slots: &["halo", "head", "face", "neck", "torso", "legs", "back", "paws", "wrist", "held", "base", "aura", "thinking", "celebrate"] },
];

/// The race of species `id` ("" for an unknown species).
pub fn race_of(id: &str) -> &'static str {
    get(id).map(|s| s.race).unwrap_or("")
}

/// True when an item for `who` (species or race ids; empty = everyone) may be worn by species `id`.
pub fn may_wear(who: &[&str], id: &str) -> bool {
    who.is_empty() || who.contains(&id) || who.contains(&race_of(id)) || race_of(id) == WEARS_EVERYTHING
}

pub fn get(id: &str) -> Option<&'static Species> {
    SPECIES.iter().find(|s| s.id == id)
}

/// True when species `id` offers `slot`.
pub fn offers(id: &str, slot: &str) -> bool {
    get(id).is_some_and(|s| s.slots.contains(&slot))
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_species_slot_is_a_known_slot() {
        for s in super::SPECIES {
            assert!(s.slots.iter().all(|slot| super::super::slots::get(slot).is_some()), "{}", s.id);
        }
        assert!(super::offers("puppy", "back") && !super::offers("puppy", "wings") && !super::offers("dragon", "head"));
        assert!(super::offers("puppy", "paws") && super::offers("owl", "paws") && super::offers("man", "paws") && !super::offers("robot", "paws"), "every body with feet has the feet slot; the robot floats");
        assert!(super::offers("woman", "legs") && super::offers("god", "legs") && !super::offers("puppy", "legs") && !super::offers("owl", "legs"), "only people wear trousers");
        assert!(super::SPECIES.iter().all(|s| super::offers(s.id, "thinking") && super::offers(s.id, "celebrate")), "every body has the effect slots");
        assert!(super::SPECIES.iter().all(|s| super::RACES.iter().any(|(r, _)| *r == s.race)), "every species has a known race");
    }

    #[test]
    fn races_decide_who_wears_what_and_the_god_keeper_wears_everything() {
        use super::may_wear;
        assert!(may_wear(&["human"], "man") && may_wear(&["human"], "woman"));
        assert!(!may_wear(&["human"], "robot") && !may_wear(&["human"], "puppy") && !may_wear(&["human"], "owl"));
        assert!(may_wear(&["woman"], "woman") && !may_wear(&["woman"], "man"), "a woman-only piece never fits the man");
        assert!(may_wear(&["puppy"], "puppy") && !may_wear(&["puppy"], "owl"));
        for who in [&["human"][..], &["robot"], &["puppy"], &["woman"], &["owl"], &[]] {
            assert!(may_wear(who, "god"), "the God Keeper wears {who:?}");
        }
        assert!(super::offers("god", "paws") && super::offers("god", "wrist") && super::offers("god", "held"));
        assert!(!super::offers("robot", "wrist") && !super::offers("owl", "held"), "no arms, no watch or lantern");
    }
}
