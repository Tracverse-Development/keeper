//! Species: the keeper's body (its rig, how it moves, its built-in reactions) and the slots it
//! offers for wearables. A body is not a part: a robot body can never be worn by a dog. Mirrors
//! the window's species registry (`src/character/skins/catalog.ts`).

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Species {
    pub id: &'static str,
    pub name: &'static str,
    pub slots: &'static [&'static str],
}

pub const SPECIES: &[Species] = &[
    Species { id: "robot", name: "Robot", slots: &["halo", "base", "aura"] },
    Species { id: "puppy", name: "Dog", slots: &["halo", "base", "aura"] },
];

pub fn get(id: &str) -> Option<&'static Species> {
    SPECIES.iter().find(|s| s.id == id)
}
