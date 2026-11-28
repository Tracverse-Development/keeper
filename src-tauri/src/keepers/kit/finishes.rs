//! Finishes: a ready-made paint and material treatment for the body itself (plan: item kind
//! "Finish"). A finish is a look over the species' own paint zones (`look.rs`), with a rarity; the
//! Studio's Look tab offers the ones for the keeper's body, and applying one sets those zones in
//! the draft look, which saves like any look (so it is undone like any look). Opened by level like
//! an item of its rarity; a finish that paints a coat (fur, feathers: `look::OBTAINED_ONLY`) is worn
//! only by a keeper that has obtained that coat.

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
    Finish { id: "golden-coat", name: "Golden Coat", species: "puppy", rarity: "uncommon", blurb: "A golden retriever's colours, smooth and glossy.", look: &[("head", "#e0a64a", "gloss"), ("body", "#e0a64a", "gloss"), ("ears", "#c98a34", "gloss"), ("legs", "#e0a64a", "gloss"), ("tail", "#c98a34", "gloss")] },
    Finish { id: "golden-fleece", name: "Golden Fleece", species: "puppy", rarity: "mythical", blurb: "A real coat of golden fur, long at the cheeks and chest.", look: &[("head", "#e0a64a", "fur"), ("muzzle", "#f0c878", "fur"), ("body", "#e0a64a", "fur"), ("ears", "#c98a34", "fur"), ("legs", "#e0a64a", "fur"), ("paws", "#f0c878", "fur"), ("tail", "#c98a34", "fur")] },
    Finish { id: "snow-coat", name: "Snow Coat", species: "puppy", rarity: "rare", blurb: "Snow white with ice-blue eyes.", look: &[("head", "#f4f4f0", "matte"), ("body", "#f4f4f0", "matte"), ("ears", "#e4e6ea", "matte"), ("legs", "#f4f4f0", "matte"), ("tail", "#e4e6ea", "matte"), ("eyes", "#9ad0ff", "gloss")] },
    Finish { id: "snow-wolf", name: "Snow Wolf", species: "puppy", rarity: "mythical", blurb: "Thick white fur of the far north, with ice-blue eyes.", look: &[("head", "#f4f4f0", "fur"), ("muzzle", "#ffffff", "fur"), ("body", "#f4f4f0", "fur"), ("ears", "#e4e6ea", "fur"), ("legs", "#f4f4f0", "fur"), ("paws", "#ffffff", "fur"), ("tail", "#e4e6ea", "fur"), ("eyes", "#9ad0ff", "glow")] },
    Finish { id: "moss-green", name: "Moss Green", species: "owl", rarity: "rare", blurb: "Green moss tones from crown to wing.", look: &[("head", "#5c7a3a", "matte"), ("body", "#5c7a3a", "matte"), ("wings", "#3f5a2a", "matte"), ("belly", "#c8d4a0", "matte")] },
    Finish { id: "tawny-plumage", name: "Tawny Plumage", species: "owl", rarity: "legendary", blurb: "Every feather of a real tawny owl: barred wings, a chevroned breast, ear tufts.", look: &[("head", "#8a6744", "feathers"), ("face", "#eee0c6", "feathers"), ("body", "#8a6744", "feathers"), ("belly", "#dcc7a2", "feathers"), ("wings", "#6e4f33", "feathers")] },
    Finish { id: "snowy-owl", name: "Snowy Owl", species: "owl", rarity: "legendary", blurb: "The feathered white owl of the far north, with golden eyes.", look: &[("head", "#f4f4f0", "feathers"), ("body", "#f0f0ea", "feathers"), ("wings", "#e4e4dc", "feathers"), ("belly", "#ffffff", "feathers"), ("face", "#ffffff", "feathers"), ("eyes", "#ffcf5a", "glow")] },
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
                if let Some(coat) = super::super::look::obtained_only(material) {
                    assert_eq!(coat.id, f.rarity, "{}: a coat finish has the coat's grade ({material})", f.id);
                }
            }
        }
    }
}
