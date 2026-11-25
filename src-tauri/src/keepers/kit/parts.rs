//! Parts (wearables): the catalogue (Registry). Each fills one slot (`slots.rs`), fits the species
//! it lists (empty = any species that offers the slot), and carries declarative EFFECTS with
//! ranges. The core uses this to validate what is worn and what packs import; the window draws
//! the parts and fits worn ones to each body (`src/character/parts/catalog.ts`; `structure.test.ts`
//! keeps the two lists equal: ids, slots, effect keys and ranges). A variant is a part with other
//! effect values ("Ruby Halo"), the safe unit of sharing: data only, never code.

use std::collections::BTreeMap;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Effect {
    pub key: &'static str,
    /// "number" (with min/max) or "color" (#rrggbb).
    pub kind: &'static str,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Serialize)]
pub struct Part {
    pub id: &'static str,
    pub name: &'static str,
    pub slot: &'static str,
    /// Species ids it fits; empty = any species.
    pub species: &'static [&'static str],
    pub effects: &'static [Effect],
}

const fn num(key: &'static str, min: f64, max: f64) -> Effect {
    Effect { key, kind: "number", min, max }
}
const fn color(key: &'static str) -> Effect {
    Effect { key, kind: "color", min: 0.0, max: 0.0 }
}

pub const PARTS: &[Part] = &[
    Part { id: "memory-halo", name: "Memory Halo", slot: "halo", species: &[], effects: &[color("color"), num("spinIdle", 0.0, 4.0), num("spinWork", 0.0, 8.0), num("nodes", 24.0, 200.0)] },
    Part { id: "ark-hull", name: "Ark Hull", slot: "base", species: &[], effects: &[color("color"), num("rock", 0.0, 3.0)] },
    Part { id: "star-aura", name: "Star Aura", slot: "aura", species: &[], effects: &[color("color"), num("count", 8.0, 120.0), num("speed", 0.0, 4.0)] },
    Part { id: "ark-jacket", name: "Ark Jacket", slot: "torso", species: &[], effects: &[color("color"), color("trim"), num("sway", 0.0, 2.0)] },
    Part { id: "knit-scarf", name: "Knit Scarf", slot: "neck", species: &[], effects: &[color("color"), color("stripe"), num("sway", 0.0, 2.0)] },
    Part { id: "crew-cap", name: "Crew Cap", slot: "head", species: &[], effects: &[color("color"), color("trim")] },
    Part { id: "trail-pack", name: "Trail Pack", slot: "back", species: &[], effects: &[color("color"), color("trim"), num("sway", 0.0, 2.0)] },
];

pub fn get(id: &str) -> Option<&'static Part> {
    PARTS.iter().find(|p| p.id == id)
}

pub use crate::kernel::settings::WornPart;

fn is_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// A wardrobe reference worth keeping: `part:`, `stock:` or `kit:` and a short kebab id.
fn item_ref(item: &Option<String>) -> Option<String> {
    let r = item.as_deref()?;
    let (kind, id) = r.split_once(':')?;
    let ok = matches!(kind, "part" | "stock" | "kit") && !id.is_empty() && id.len() <= 60 && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    ok.then(|| r.to_string())
}

/// Validate a worn part on its own (any body): a known part, effects only from its schema and in
/// range (numbers clamped, bad colours dropped), a wardrobe reference kept only when well formed.
pub fn check_effects(worn: &WornPart) -> Result<WornPart, String> {
    let part = get(&worn.part).ok_or_else(|| format!("There is no part called {}.", worn.part))?;
    let mut effects = BTreeMap::new();
    for e in part.effects {
        let Some(v) = worn.effects.get(e.key) else { continue };
        match e.kind {
            "color" => {
                if let Some(s) = v.as_str().filter(|s| is_color(s)) {
                    effects.insert(e.key.to_string(), serde_json::Value::String(s.to_lowercase()));
                }
            }
            _ => {
                if let Some(n) = v.as_f64().filter(|n| n.is_finite()) {
                    effects.insert(e.key.to_string(), serde_json::json!(n.clamp(e.min, e.max)));
                }
            }
        }
    }
    Ok(WornPart { part: part.id.to_string(), effects, item: item_ref(&worn.item) })
}

/// Validate a worn part for a species: as `check_effects`, and the part fits that body (its
/// species list, and the species offers the part's slot). Err names the problem in plain words.
pub fn check(worn: &WornPart, species: &str) -> Result<WornPart, String> {
    let ok = check_effects(worn)?;
    let part = get(&ok.part).ok_or_else(|| format!("There is no part called {}.", worn.part))?;
    let body = super::species::get(species).ok_or_else(|| "There is no such body.".to_string())?;
    if !part.species.is_empty() && !part.species.contains(&species) {
        return Err(format!("The {} doesn't fit this body.", part.name));
    }
    if !body.slots.contains(&part.slot) {
        return Err(format!("A {} has no {} to wear the {} on.", body.name.to_lowercase(), super::slots::word(part.slot), part.name));
    }
    Ok(ok)
}

/// A whole outfit for a species: each part valid and fitting, and never two in one slot.
pub fn check_outfit(worn: &[WornPart], species: &str) -> Result<Vec<WornPart>, String> {
    let mut by_slot: BTreeMap<&str, WornPart> = BTreeMap::new();
    for w in worn {
        let ok = check(w, species)?;
        let slot = get(&ok.part).map(|p| p.slot).unwrap_or("");
        if by_slot.insert(slot, ok).is_some() {
            return Err(format!("Only one thing can be worn on the {} at a time.", super::slots::word(slot)));
        }
    }
    Ok(by_slot.into_values().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn effects_are_clamped_and_unknown_keys_dropped() {
        let w: WornPart = serde_json::from_value(json!({"part": "memory-halo", "effects": {"color": "#E2425F", "spinWork": 99, "evil": "x", "nodes": "lots"}})).unwrap();
        let ok = check(&w, "puppy").unwrap();
        assert_eq!(ok.effects.get("color"), Some(&json!("#e2425f")));
        assert_eq!(ok.effects.get("spinWork"), Some(&json!(8.0)));
        assert!(!ok.effects.contains_key("evil") && !ok.effects.contains_key("nodes"));
        assert!(check(&WornPart { part: "laser".into(), effects: BTreeMap::new(), item: None }, "robot").is_err());
    }

    fn worn(part: &str) -> WornPart {
        WornPart { part: part.into(), effects: BTreeMap::new(), item: None }
    }

    #[test]
    fn never_two_things_in_one_slot() {
        let err = check_outfit(&[worn("memory-halo"), worn("memory-halo")], "robot").unwrap_err();
        assert!(err.contains("halo"), "{err}");
        let outfit = check_outfit(&[worn("ark-jacket"), worn("knit-scarf"), worn("crew-cap"), worn("trail-pack"), worn("memory-halo")], "puppy").unwrap();
        assert_eq!(outfit.len(), 5);
    }

    #[test]
    fn every_part_fits_every_species_that_offers_its_slot() {
        for p in PARTS {
            assert!(super::super::slots::get(p.slot).is_some(), "{} names an unknown slot", p.id);
            for s in super::super::species::SPECIES {
                assert_eq!(check(&worn(p.id), s.id).is_ok(), s.slots.contains(&p.slot), "{} on {}", p.id, s.id);
            }
        }
        assert!(check(&worn("crew-cap"), "dragon").is_err(), "unknown bodies are refused");
    }

    #[test]
    fn wardrobe_references_are_kept_only_when_well_formed() {
        let mut w = worn("crew-cap");
        w.item = Some("kit:trini-cap".into());
        assert_eq!(check_effects(&w).unwrap().item.as_deref(), Some("kit:trini-cap"));
        for bad in ["kit:", "evil:x", "kit:Upper", "kit:a b", "part:<script>"] {
            w.item = Some(bad.into());
            assert_eq!(check_effects(&w).unwrap().item, None, "{bad}");
        }
    }
}
