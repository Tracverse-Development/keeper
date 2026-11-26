//! Rarity: how special an item is, from common to mythical. Every part, variant and effect has
//! one; it sets the frame and shine the Studio draws, and the keeper level needed to put it on
//! (`levels::level_for_rarity`). Kept in a table beside the parts catalogue (not inside `Part`),
//! so the catalogue's shape, which the window mirrors, does not change for it.

use serde::Serialize;

#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
pub struct Rarity {
    pub id: &'static str,
    pub name: &'static str,
    /// Keeper level needed to wear an item of this rarity.
    pub level: u32,
    /// The frame colour in the Studio (#rrggbb).
    pub color: &'static str,
}

pub const RARITIES: [Rarity; 5] = [
    Rarity { id: "common", name: "Common", level: 1, color: "#9aa3b5" },
    Rarity { id: "uncommon", name: "Uncommon", level: 2, color: "#4fbf7a" },
    Rarity { id: "rare", name: "Rare", level: 4, color: "#4a8df0" },
    Rarity { id: "legendary", name: "Legendary", level: 10, color: "#e3b06a" },
    Rarity { id: "mythical", name: "Mythical", level: 15, color: "#c25cf0" },
];

/// Each catalogue part's rarity (a part not listed is common).
pub const PART_RARITY: &[(&str, &str)] = &[
    ("memory-halo", "rare"),
    ("star-aura", "uncommon"),
    ("ark-jacket", "uncommon"),
    ("paw-nails", "rare"),
    ("dog-collar", "uncommon"),
    ("think-classic", "common"),
    ("think-pulse", "uncommon"),
    ("think-orbit", "rare"),
    ("think-nebula", "legendary"),
    ("think-vortex", "mythical"),
    ("cheer-confetti", "common"),
    ("cheer-fireworks", "rare"),
    ("cheer-starburst", "mythical"),
];

pub fn get(id: &str) -> Option<&'static Rarity> {
    RARITIES.iter().find(|r| r.id == id)
}

/// The rarity of catalogue part `part_id`.
pub fn of_part(part_id: &str) -> &'static Rarity {
    PART_RARITY.iter().find(|(p, _)| *p == part_id).and_then(|(_, r)| get(r)).unwrap_or(&RARITIES[0])
}

#[cfg(test)]
mod tests {
    #[test]
    fn rarities_climb_in_level_and_every_listed_part_exists() {
        assert!(super::RARITIES.windows(2).all(|w| w[0].level < w[1].level));
        for (part, rarity) in super::PART_RARITY {
            assert!(super::super::parts::get(part).is_some(), "{part}");
            assert!(super::get(rarity).is_some(), "{rarity}");
        }
        assert_eq!(super::of_part("crew-cap").id, "common");
        assert_eq!(super::of_part("memory-halo").id, "rare");
        assert_eq!(super::of_part("think-vortex").id, "mythical");
        assert_eq!(super::of_part("cheer-fireworks").id, "rare");
    }
}
