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
    ("man", &[zone("skin", "Skin"), zone("hair", "Hair"), zone("eyes", "Eyes"), zone("top", "Shirt"), zone("bottom", "Trousers"), zone("shoes", "Shoes")]),
    ("woman", &[zone("skin", "Skin"), zone("hair", "Hair"), zone("eyes", "Eyes"), zone("top", "Top"), zone("bottom", "Skirt"), zone("shoes", "Shoes")]),
    ("owl", &[zone("head", "Head"), zone("face", "Face disc"), zone("eyes", "Eyes"), zone("body", "Body"), zone("belly", "Chest"), zone("wings", "Wings"), zone("beak", "Beak and feet")]),
    ("god", &[zone("skin", "Mask and hands"), zone("body", "Armour"), zone("robe", "Robe"), zone("eyes", "Eyes"), zone("crown", "Crown of light"), zone("rings", "Rings")]),
];

pub const MATERIALS: &[(&str, &str)] = &[("matte", "Matte"), ("gloss", "Gloss"), ("metal", "Metal"), ("fur", "Fur"), ("feathers", "Feathers"), ("glow", "Glow")];

/// Materials a keeper can only OBTAIN, never pick, with their rarity: a real coat. The standard
/// body is smooth (founder 2026-11-28): fur is mythical, feathers legendary. How a keeper obtains
/// one is still to come; until then a keeper has one only if it already wore it
/// (`KeeperProfile::obtained`). Every other material anyone can pick.
pub const OBTAINED_ONLY: &[(&str, &str)] = &[("fur", "mythical"), ("feathers", "legendary")];

/// The rarity of an obtained-only material (None: anyone can pick it).
pub fn obtained_only(material: &str) -> Option<&'static super::rarity::Rarity> {
    OBTAINED_ONLY.iter().find(|(m, _)| *m == material).and_then(|(_, r)| super::rarity::get(r))
}

/// Each body that can grow a real coat: the material that grows it and the zones it grows on
/// (the dog's shell fur, the owl's feather layers; `src/character/skins`). The Studio's coat
/// switch paints exactly these zones. A body not listed has no coat.
pub const COATS: &[(&str, &str, &[&str])] = &[
    ("puppy", "fur", &["head", "ears", "muzzle", "body", "legs", "paws", "tail"]),
    ("owl", "feathers", &["head", "face", "body", "belly", "wings"]),
];

/// The coat of `species`: its material and zones (None when it grows no coat).
pub fn coat(species: &str) -> Option<(&'static str, &'static [&'static str])> {
    COATS.iter().find(|(s, _, _)| *s == species).map(|(_, m, z)| (*m, *z))
}

/// The obtained-only materials `look` wears.
pub fn rare_materials(look: &BTreeMap<String, ZoneLook>) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = OBTAINED_ONLY.iter().map(|(m, _)| *m).filter(|m| look.values().any(|l| l.material.as_deref() == Some(*m))).collect();
    out.dedup();
    out
}

/// The first obtained-only material in `look` that is not in `has` (what the keeper obtained),
/// as its display name. None when the keeper may wear the whole look.
pub fn not_obtained(look: &BTreeMap<String, ZoneLook>, has: &[String]) -> Option<&'static str> {
    rare_materials(look).into_iter().find(|m| !has.iter().any(|h| h == m)).map(|m| MATERIALS.iter().find(|(id, _)| *id == m).map(|(_, name)| *name).unwrap_or(m))
}

/// What a keeper has obtained: the list it holds, plus any coat its saved look already wears (a
/// keeper that wore fur before obtaining existed keeps it).
pub fn obtained(listed: &[String], look: &BTreeMap<String, ZoneLook>) -> Vec<String> {
    let mut out: Vec<String> = listed.iter().filter(|m| obtained_only(m).is_some()).cloned().collect();
    for m in rare_materials(look) {
        if !out.iter().any(|h| h == m) {
            out.push(m.to_string());
        }
    }
    out
}

/// `look` without obtained-only materials (colours kept): what a shared pack's keeper arrives
/// with, so a pack is never a way to a coat nobody obtained.
pub fn without_rare(look: BTreeMap<String, ZoneLook>) -> BTreeMap<String, ZoneLook> {
    look.into_iter()
        .map(|(z, l)| {
            let material = l.material.filter(|m| obtained_only(m).is_none());
            (z, ZoneLook { material, ..l })
        })
        .filter(|(_, l)| l.color.is_some() || l.material.is_some())
        .collect()
}

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

    fn painted(zone: &str, material: &str) -> BTreeMap<String, ZoneLook> {
        [(zone.to_string(), ZoneLook { color: Some("#e0a64a".into()), material: Some(material.into()) })].into_iter().collect()
    }

    #[test]
    fn a_coat_is_obtained_never_picked() {
        assert_eq!(obtained_only("fur").map(|r| r.id), Some("mythical"));
        assert_eq!(obtained_only("feathers").map(|r| r.id), Some("legendary"));
        assert!(obtained_only("gloss").is_none());
        assert_eq!(not_obtained(&painted("body", "fur"), &[]), Some("Fur"));
        assert_eq!(not_obtained(&painted("body", "fur"), &["fur".into()]), None);
        assert_eq!(not_obtained(&painted("wings", "feathers"), &["fur".into()]), Some("Feathers"));
        assert_eq!(not_obtained(&painted("body", "metal"), &[]), None);
    }

    #[test]
    fn a_keeper_keeps_the_coat_it_already_wore() {
        let has = obtained(&["lava".into()], &painted("body", "fur"));
        assert_eq!(has, ["fur"], "a worn coat counts as obtained; unknown names are dropped");
        assert_eq!(obtained(&["fur".into()], &BTreeMap::new()), ["fur"], "turning it off keeps it obtained");
    }

    #[test]
    fn a_pack_keeper_arrives_without_a_coat() {
        let mut look = painted("body", "fur");
        look.insert("ears".into(), ZoneLook { color: None, material: Some("feathers".into()) });
        let start = without_rare(look);
        assert_eq!(start["body"].material, None, "the colour stays, the fur goes");
        assert!(start["body"].color.is_some() && !start.contains_key("ears"));
    }

    #[test]
    fn coats_are_real_zones_grown_by_obtained_only_materials() {
        for (species, material, zones_of) in COATS {
            assert!(obtained_only(material).is_some(), "{species}: {material}");
            for z in *zones_of {
                assert!(zones(species).iter().any(|k| k.id == *z), "{species}: {z}");
            }
        }
        assert!(coat("robot").is_none() && coat("god").is_none());
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
