//! Slots: WHERE a wearable goes on a body. Mirrors the window's `src/character/parts/slots.ts`
//! (`structure.test.ts` keeps the two lists equal, in order). Floating slots (halo, base, aura)
//! hold parts that float steady around the body; worn slots (head, face, neck, torso, back, paws, wrist, held) hold
//! parts worn ON it, which the window fits to the shape each species publishes for that slot;
//! effect slots (thinking, celebrate) hold no thing on the body at all: the part worn there
//! changes how that moment looks (the thinking aura, the celebration burst). Whether a species
//! offers a slot is the species' business (`species.rs`); a part names one slot.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Slot {
    pub id: &'static str,
    pub name: &'static str,
    /// "floating", "worn" or "effect".
    pub kind: &'static str,
}

pub const SLOTS: &[Slot] = &[
    Slot { id: "halo", name: "Halo", kind: "floating" },
    Slot { id: "head", name: "Head", kind: "worn" },
    Slot { id: "face", name: "Face", kind: "worn" },
    Slot { id: "neck", name: "Neck", kind: "worn" },
    Slot { id: "torso", name: "Torso", kind: "worn" },
    Slot { id: "back", name: "Back", kind: "worn" },
    Slot { id: "paws", name: "Paws", kind: "worn" },
    Slot { id: "wrist", name: "Wrist", kind: "worn" },
    Slot { id: "held", name: "Held", kind: "worn" },
    Slot { id: "base", name: "Base", kind: "floating" },
    Slot { id: "aura", name: "Aura", kind: "floating" },
    Slot { id: "thinking", name: "Thinking", kind: "effect" },
    Slot { id: "celebrate", name: "Celebrate", kind: "effect" },
];

pub fn get(id: &str) -> Option<&'static Slot> {
    SLOTS.iter().find(|s| s.id == id)
}

/// The slot's name in a sentence ("head", "back").
pub fn word(id: &str) -> String {
    get(id).map(|s| s.name.to_lowercase()).unwrap_or_else(|| id.to_string())
}
