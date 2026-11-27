//! Finishes: a ready-made paint and material treatment for the body itself (plan: item kind
//! "Finish"). A finish is a look over the species' own paint zones (`look.rs`), with a rarity; the
//! Studio's Look tab offers the ones for the keeper's body, and applying one sets those zones in
//! the draft look, which saves like any look (so it is undone like any look). Opened by level like
//! an item of its rarity.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finish {
    pub id: &'static str,
    pub name: &'static str,
    pub species: &'static str,
    pub rarity: &'static str,
    pub blurb: &'static str,
    /// (zone, colour, material): every zone it paints.
    pub look: &'static [(&'static str, &'static str, &'static str)],
}

pub const FINISHES: &[Finish] = &[
    Finish { id: "brushed-titanium", name: "Brushed Titanium", species: "robot", rarity: "rare", blurb: "Brushed metal across the body, with a cool blue core.", look: &[("head", "#b8bec8", "metal"), ("body", "#a8aeb8", "metal"), ("antenna", "#8a9099", "metal"), ("core", "#6aa3f5", "glow")] },
    Finish { id: "solar-gold", name: "Solar Gold", species: "robot", rarity: "legendary", blurb: "Polished gold plate with a sunlit core.", look: &[("head", "#e3b06a", "metal"), ("body", "#d39744", "metal"), ("antenna", "#ffcf5a", "metal"), ("core", "#ffcf5a", "glow"), ("eyes", "#fff2c0", "glow")] },
    Finish { id: "golden-coat", name: "Golden Coat", species: "puppy", rarity: "uncommon", blurb: "A golden retriever's glossy coat.", look: &[("head", "#e0a64a", "fur"), ("body", "#e0a64a", "fur"), ("ears", "#c98a34", "fur"), ("legs", "#e0a64a", "fur"), ("tail", "#c98a34", "fur")] },
    Finish { id: "snow-coat", name: "Snow Coat", species: "puppy", rarity: "rare", blurb: "A snow-white coat with ice-blue eyes.", look: &[("head", "#f4f4f0", "fur"), ("body", "#f4f4f0", "fur"), ("ears", "#e4e6ea", "fur"), ("legs", "#f4f4f0", "fur"), ("tail", "#e4e6ea", "fur"), ("eyes", "#9ad0ff", "gloss")] },
    Finish { id: "moss-feathers", name: "Moss Feathers", species: "owl", rarity: "rare", blurb: "Green moss tones through the feathers.", look: &[("head", "#5c7a3a", "fur"), ("body", "#5c7a3a", "fur"), ("wings", "#3f5a2a", "fur"), ("belly", "#c8d4a0", "fur")] },
    Finish { id: "snowy-owl", name: "Snowy Owl", species: "owl", rarity: "legendary", blurb: "The white owl of the far north, with golden eyes.", look: &[("head", "#f4f4f0", "fur"), ("body", "#f0f0ea", "fur"), ("wings", "#e4e4dc", "fur"), ("belly", "#ffffff", "fur"), ("face", "#ffffff", "fur"), ("eyes", "#ffcf5a", "glow")] },
    Finish { id: "obsidian-sovereign", name: "Obsidian Sovereign", species: "god", rarity: "mythical", blurb: "Black glass armour veined with violet fire.", look: &[("body", "#1a1424", "gloss"), ("robe", "#2a1840", "gloss"), ("skin", "#3a2a4a", "metal"), ("crown", "#c25cf0", "glow"), ("rings", "#c25cf0", "glow"), ("eyes", "#e6c8ff", "glow")] },
    Finish { id: "dawn", name: "Dawn", species: "god", rarity: "legendary", blurb: "Rose gold and morning light.", look: &[("body", "#e8b0a0", "metal"), ("robe", "#fff0e8", "gloss"), ("crown", "#ffb8a0", "glow"), ("rings", "#ffd8c0", "glow")] },
];

/// The finishes for species `id`.
pub fn for_species(id: &str) -> Vec<&'static Finish> {
    FINISHES.iter().filter(|f| f.species == id).collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_finish_paints_real_zones_with_real_materials() {
        for f in super::FINISHES {
            let zones = super::super::look::zones(f.species);
            assert!(!zones.is_empty(), "{}: species {}", f.id, f.species);
            assert!(super::super::rarity::get(f.rarity).is_some(), "{}", f.id);
            for (zone, colour, material) in f.look {
                assert!(zones.iter().any(|z| z.id == *zone), "{}: zone {zone}", f.id);
                assert!(colour.len() == 7 && colour.starts_with('#'), "{}: {colour}", f.id);
                assert!(super::super::look::MATERIALS.iter().any(|(m, _)| m == material), "{}: {material}", f.id);
            }
        }
    }
}
