//! Parts (wearables): each fills one slot, fits the species it lists, and carries declarative
//! EFFECTS with ranges. The core uses this to validate what is equipped and what packs import;
//! the window draws the parts (`src/character/parts/catalog.ts`; `structure.test.ts` keeps the two
//! lists equal: ids, slots, effect keys and ranges). A variant is a part with other effect
//! values ("Ruby Halo"), the safe unit of sharing: data only, never code.

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
];

pub fn get(id: &str) -> Option<&'static Part> {
    PARTS.iter().find(|p| p.id == id)
}

pub use crate::kernel::settings::WornPart;

fn is_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Validate a worn part for a species: a known part that fits, effects only from its schema and
/// in range (numbers clamped, bad colours dropped). Err names the problem in plain words.
pub fn check(worn: &WornPart, species: &str) -> Result<WornPart, String> {
    let part = get(&worn.part).ok_or_else(|| format!("There is no part called {}.", worn.part))?;
    if !part.species.is_empty() && !part.species.contains(&species) {
        return Err(format!("The {} doesn't fit this body.", part.name));
    }
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
    Ok(WornPart { part: part.id.to_string(), effects })
}

/// A whole outfit: each part valid, at most one part per slot (the last one wins).
pub fn check_outfit(worn: &[WornPart], species: &str) -> Result<Vec<WornPart>, String> {
    let mut by_slot: BTreeMap<&str, WornPart> = BTreeMap::new();
    for w in worn.iter().take(8) {
        let ok = check(w, species)?;
        by_slot.insert(get(&ok.part).map(|p| p.slot).unwrap_or(""), ok);
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
        assert!(check(&WornPart { part: "laser".into(), effects: BTreeMap::new() }, "robot").is_err());
    }

    #[test]
    fn one_part_per_slot() {
        let a = WornPart { part: "memory-halo".into(), effects: BTreeMap::new() };
        let outfit = check_outfit(&[a.clone(), a], "robot").unwrap();
        assert_eq!(outfit.len(), 1);
    }
}
