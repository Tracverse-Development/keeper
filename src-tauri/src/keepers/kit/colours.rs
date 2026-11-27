//! Colour choices: each wearable can be worn in a few colours (a jacket in red, navy or gold),
//! picked in the Studio. Pure data and rules, no new models: a PALETTE per part kind (every cloth
//! piece shares one, metal pieces another), with per-item overrides for official items whose own
//! design wants different choices (`ITEM_PALETTES`, keyed by the wardrobe id `official:<id>`).
//!
//! A choice is stored with the worn item (`WornPart::colour`, a swatch id) and applied to its
//! effect values (`color`, and the second colour: `trim`, `stripe` or `tag`), so the character draws
//! it with no lookup and rarity, the divine finish and the set glow (all keyed on the item and its
//! rarity, never its colour) keep working. The core is the only judge: a colour not in the item's
//! palette is dropped (the item's own colours), and missing (older data) means the same.
//!
//! How to use: `palette(item, part)` lists the swatches; `choices` is what the window is sent
//! (each swatch with the effect values it sets); `validated` cleans a worn part (called by
//! `parts::check_effects`); `recolour` changes the colour of a worn part; `carried` keeps a stored
//! colour when an outfit is saved again without one (LES-039).

use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;

use super::parts::{self, WornPart};

/// One colour an item can be worn in.
#[derive(Debug, PartialEq)]
pub struct Swatch {
    /// Short kebab id, stored on the worn item ("navy").
    pub id: &'static str,
    /// What the person sees ("Navy").
    pub name: &'static str,
    /// The main colour (#rrggbb, lower case).
    pub color: &'static str,
    /// The second colour, for parts that have one (`SECOND_KEYS`); None leaves it as designed.
    pub trim: Option<&'static str>,
}

const fn sw(id: &'static str, name: &'static str, color: &'static str, trim: Option<&'static str>) -> Swatch {
    Swatch { id, name, color, trim }
}

/// The effect keys a swatch's second colour goes to, the first one the part has.
const SECOND_KEYS: &[&str] = &["trim", "stripe", "tag"];

const CLOTH: &[Swatch] = &[
    sw("red", "Red", "#b3262e", Some("#f4eee2")),
    sw("navy", "Navy", "#151c33", Some("#d39744")),
    sw("gold", "Gold", "#d39744", Some("#151c33")),
    sw("forest", "Forest", "#2f6b45", Some("#e9dcc0")),
    sw("plum", "Plum", "#5b2a86", Some("#ffcf5a")),
    sw("charcoal", "Charcoal", "#2b2b30", Some("#c8ccd4")),
];

const METAL: &[Swatch] = &[
    sw("gold", "Gold", "#d39744", None),
    sw("silver", "Silver", "#c8ccd4", None),
    sw("rose-gold", "Rose gold", "#c98a72", None),
    sw("bronze", "Bronze", "#9a6a3a", None),
    sw("black", "Black", "#2a2a2e", None),
];

const LEATHER: &[Swatch] = &[
    sw("brown", "Brown", "#6b4226", Some("#d39744")),
    sw("black", "Black", "#1e1e22", Some("#c8ccd4")),
    sw("tan", "Tan", "#b57b2c", Some("#f4eee2")),
    sw("oxblood", "Oxblood", "#5a1f1f", Some("#d39744")),
    sw("olive", "Olive", "#5b5a2e", Some("#e9dcc0")),
];

const SHOES: &[Swatch] = &[
    sw("black", "Black", "#1e1e22", Some("#c8ccd4")),
    sw("brown", "Brown", "#6b4226", Some("#e9dcc0")),
    sw("white", "White", "#ece9e2", Some("#151c33")),
    sw("red", "Red", "#b3262e", Some("#f4eee2")),
    sw("navy", "Navy", "#151c33", Some("#d39744")),
];

const PET: &[Swatch] = &[
    sw("red", "Red", "#b3262e", Some("#ffcf5a")),
    sw("navy", "Navy", "#151c33", Some("#d39744")),
    sw("forest", "Forest", "#2f6b45", Some("#ffcf5a")),
    sw("pink", "Pink", "#e58fb0", Some("#f4eee2")),
    sw("gold", "Gold", "#d39744", Some("#151c33")),
];

/// Royal pieces choose between jewel tones rather than everyday cloth.
const JEWEL: &[Swatch] = &[
    sw("crimson", "Crimson", "#8e1b2b", Some("#ffcf5a")),
    sw("emerald", "Emerald", "#1f6b4f", Some("#ffcf5a")),
    sw("sapphire", "Sapphire", "#1f3f8e", Some("#ffcf5a")),
    sw("midnight", "Midnight", "#151c33", Some("#e3b06a")),
];

/// The palette of each part kind (parts not listed, such as halos, auras and moments, have none).
pub const PALETTES: &[(&str, &[Swatch])] = &[
    ("ark-jacket", CLOTH),
    ("top", CLOTH),
    ("gown", CLOTH),
    ("trousers", CLOTH),
    ("cape", CLOTH),
    ("knit-scarf", CLOTH),
    ("neckwear", CLOTH),
    ("tote", CLOTH),
    ("trail-pack", CLOTH),
    ("crew-cap", CLOTH),
    ("brim-hat", CLOTH),
    ("soft-hat", CLOTH),
    ("ranger-jacket", LEATHER),
    ("cord-necklace", LEATHER),
    ("shoes", SHOES),
    ("crown", METAL),
    ("bangles", METAL),
    ("trail-watch", METAL),
    ("star-lantern", METAL),
    ("round-spectacles", METAL),
    ("welder-visor", METAL),
    ("head-gear", METAL),
    ("dog-collar", PET),
    ("paw-nails", PET),
];

/// Per-item palettes (wardrobe ids) that replace their part's.
pub const ITEM_PALETTES: &[(&str, &[Swatch])] = &[("official:royal-jacket", JEWEL), ("official:phoenix-jacket", JEWEL)];

/// The swatches item `item` (a wardrobe id, or None) of part `part` can be worn in; empty = none.
pub fn palette(item: Option<&str>, part: &str) -> &'static [Swatch] {
    let own = item.and_then(|i| ITEM_PALETTES.iter().find(|(id, _)| *id == i));
    own.or_else(|| PALETTES.iter().find(|(p, _)| *p == part)).map(|(_, s)| *s).unwrap_or(&[])
}

/// The swatch `colour` names in that item's palette, if it is one.
pub fn find(item: Option<&str>, part: &str, colour: &str) -> Option<&'static Swatch> {
    palette(item, part).iter().find(|s| s.id == colour)
}

/// The effect values `swatch` sets on part `part`: its colour, and its second colour on the part's
/// first second-colour key.
pub fn effects_of(swatch: &Swatch, part: &str) -> BTreeMap<String, Value> {
    let mut out = BTreeMap::new();
    out.insert("color".to_string(), Value::String(swatch.color.to_string()));
    if let (Some(trim), Some(key)) = (swatch.trim, second_key(part)) {
        out.insert(key.to_string(), Value::String(trim.to_string()));
    }
    out
}

fn second_key(part: &str) -> Option<&'static str> {
    let schema = parts::get(part)?;
    SECOND_KEYS.iter().copied().find(|k| schema.effects.iter().any(|e| e.key == *k))
}

/// One colour choice as the window gets it (`Listed::colours`): the swatch and what it sets.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Choice {
    pub id: &'static str,
    pub name: &'static str,
    pub effects: BTreeMap<String, Value>,
}

/// The colour choices of wardrobe item `item` (its id) of part `part`, in palette order.
pub fn choices(item: &str, part: &str) -> Vec<Choice> {
    palette(Some(item), part).iter().map(|s| Choice { id: s.id, name: s.name, effects: effects_of(s, part) }).collect()
}

/// A worn part with its colour checked: kept (and applied to its effects) only when it is in the
/// item's palette, else dropped (the effects are left as they came).
pub fn validated(mut worn: WornPart) -> WornPart {
    let swatch = worn.colour.as_deref().and_then(|c| find(worn.item.as_deref(), &worn.part, c));
    match swatch {
        Some(s) => {
            worn.effects.extend(effects_of(s, &worn.part));
            worn.colour = Some(s.id.to_string());
        }
        None => worn.colour = None,
    }
    worn
}

/// Wear `worn` in `colour` (None or unknown: the item's own colours, taken from `original`, the
/// item's effect values as designed).
pub fn recolour(worn: &mut WornPart, colour: Option<&str>, original: &BTreeMap<String, Value>) {
    for key in std::iter::once("color").chain(SECOND_KEYS.iter().copied()) {
        match original.get(key) {
            Some(v) => worn.effects.insert(key.to_string(), v.clone()),
            None => worn.effects.remove(key),
        };
    }
    worn.colour = colour.map(str::to_string);
    *worn = validated(worn.clone());
}

/// An outfit saved again without colours keeps the ones stored: each incoming piece with no colour
/// takes the colour the same item (same wardrobe id) is worn in now (LES-039). Choosing the item's
/// own colours again goes through `recolour`, never through a save that leaves the field out.
pub fn carried(stored: &[WornPart], incoming: Vec<WornPart>) -> Vec<WornPart> {
    incoming
        .into_iter()
        .map(|w| {
            if w.colour.is_some() || w.item.is_none() {
                return w;
            }
            match stored.iter().find(|s| s.item == w.item).and_then(|s| s.colour.clone()) {
                Some(c) => validated(WornPart { colour: Some(c), ..w }),
                None => w,
            }
        })
        .collect()
}

#[cfg(test)]
#[path = "colours_tests.rs"]
mod tests;
