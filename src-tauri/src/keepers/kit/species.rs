//! Species: the keeper's body (its rig, how it moves, its built-in reactions) and the slots it
//! offers for wearables. A body is not a part: a robot body can never be worn by a dog. Mirrors
//! the window's species registry (`src/character/skins/catalog.ts`; `structure.test.ts` keeps the
//! slot lists equal). A species that leaves a slot out simply cannot wear parts for it, and the
//! wardrobe says so in plain words instead of failing.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Species {
    pub id: &'static str,
    pub name: &'static str,
    pub slots: &'static [&'static str],
}

pub const SPECIES: &[Species] = &[
    Species { id: "robot", name: "Robot", slots: &["halo", "head", "neck", "torso", "back", "base", "aura"] },
    Species { id: "puppy", name: "Dog", slots: &["halo", "head", "neck", "torso", "back", "base", "aura"] },
];

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
    }
}
