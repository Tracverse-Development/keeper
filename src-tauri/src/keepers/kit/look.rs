//! The look and the habits of a keeper, beyond its outfit.
//! - LOOK: a colour and a material for each paint zone of the body (the dog's ears, the robot's
//!   face plate…). Each species declares its zones; the window paints them (`src/character`).
//! - HABITS: what this keeper does on its own when idle (sleeps when left alone, stretches, looks
//!   around…), as weights from 0 (never) to 3 (often). Unique per keeper; a species may offer
//!   habits only it has (only a dog chases its tail).
//! Both are validated here before they are saved (unknown zones, materials and habits dropped,
//! colours checked, weights clamped). Design: `docs/design/keeper-ecosystem.md`.

use std::collections::BTreeMap;

use serde::Serialize;

pub use crate::kernel::settings::ZoneLook;

#[derive(Debug, Serialize)]
pub struct Zone {
    pub id: &'static str,
    pub name: &'static str,
}

const fn zone(id: &'static str, name: &'static str) -> Zone {
    Zone { id, name }
}

/// The paint zones each species offers.
pub const ZONES: &[(&str, &[Zone])] = &[
    ("robot", &[zone("head", "Head"), zone("face", "Face screen"), zone("eyes", "Eyes"), zone("body", "Body"), zone("core", "Chest core"), zone("antenna", "Ear antennas")]),
    ("puppy", &[zone("head", "Head"), zone("ears", "Ears"), zone("muzzle", "Muzzle"), zone("eyes", "Eyes"), zone("body", "Body"), zone("legs", "Legs"), zone("paws", "Paws"), zone("tail", "Tail")]),
];

pub const MATERIALS: &[(&str, &str)] = &[("matte", "Matte"), ("gloss", "Gloss"), ("metal", "Metal"), ("fur", "Fur"), ("glow", "Glow")];

/// Habits every species has, then those only some species have.
pub const HABITS: &[(&str, &str, &[&str])] = &[
    ("sleep", "Naps when left alone", &[]),
    ("stretch", "Stretches", &[]),
    ("look-around", "Looks around", &[]),
    ("wink", "Winks", &[]),
    ("nod", "Nods", &[]),
    ("hum", "Hums a little tune", &["robot"]),
    ("chase-tail", "Chases its tail", &["puppy"]),
    ("scratch", "Scratches an ear", &["puppy"]),
];

pub const MAX_HABIT: f64 = 3.0;

pub fn zones(species: &str) -> &'static [Zone] {
    ZONES.iter().find(|(s, _)| *s == species).map(|(_, z)| *z).unwrap_or(&[])
}

/// The habits a species offers.
pub fn habits(species: &str) -> impl Iterator<Item = &'static (&'static str, &'static str, &'static [&'static str])> + '_ {
    HABITS.iter().filter(move |(_, _, only)| only.is_empty() || only.contains(&species))
}

fn is_color(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

/// Keep only zones the species has, with a valid colour (or none) and a known material (or none).
pub fn check_look(look: &BTreeMap<String, ZoneLook>, species: &str) -> BTreeMap<String, ZoneLook> {
    let known = zones(species);
    look.iter()
        .filter(|(z, _)| known.iter().any(|k| k.id == z.as_str()))
        .map(|(z, l)| {
            let color = l.color.as_deref().filter(|c| is_color(c)).map(str::to_lowercase);
            let material = l.material.as_deref().filter(|m| MATERIALS.iter().any(|(id, _)| id == m)).map(str::to_string);
            (z.clone(), ZoneLook { color, material })
        })
        .filter(|(_, l)| l.color.is_some() || l.material.is_some())
        .collect()
}

/// Keep only habits the species has, weights clamped to 0..=MAX_HABIT.
pub fn check_habits(habits_in: &BTreeMap<String, f64>, species: &str) -> BTreeMap<String, f64> {
    habits_in
        .iter()
        .filter(|(h, w)| w.is_finite() && habits(species).any(|(id, _, _)| id == h))
        .map(|(h, w)| (h.clone(), w.clamp(0.0, MAX_HABIT)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn looks_keep_only_real_zones_colours_and_materials() {
        let mut look = BTreeMap::new();
        look.insert("ears".to_string(), ZoneLook { color: Some("#AA3311".into()), material: Some("fur".into()) });
        look.insert("antenna".to_string(), ZoneLook { color: Some("#ffffff".into()), material: None });
        look.insert("tail".to_string(), ZoneLook { color: Some("red".into()), material: Some("lava".into()) });
        let ok = check_look(&look, "puppy");
        assert_eq!(ok.len(), 1, "a dog has no antenna; a bad colour and material leave nothing: {ok:?}");
        assert_eq!(ok["ears"].color.as_deref(), Some("#aa3311"));
        for (species, _) in ZONES {
            assert!(super::super::species::get(species).is_some(), "{species}");
        }
    }

    #[test]
    fn habits_belong_to_their_species_and_are_clamped() {
        let h: BTreeMap<String, f64> = [("sleep", 9.0), ("chase-tail", 2.0), ("hum", 1.0), ("fly", 1.0)].iter().map(|(k, v)| (k.to_string(), *v)).collect();
        let dog = check_habits(&h, "puppy");
        assert_eq!(dog.get("sleep"), Some(&3.0));
        assert!(dog.contains_key("chase-tail") && !dog.contains_key("hum") && !dog.contains_key("fly"));
        assert!(check_habits(&h, "robot").contains_key("hum") && !check_habits(&h, "robot").contains_key("chase-tail"));
    }
}
