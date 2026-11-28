//! Forging an item from a few words with no mind at all: "a cosy green scarf with cream stripes"
//! is the Knit Scarf in green with cream stripes. The Forge asks the helper model first
//! (`wardrobe_commands::design`); when there is none (no AI connected, or it did not answer),
//! this reads the plain description: the part it names, its colours in the order said, and
//! "fast" or "slow" for its motion. Anything it cannot read returns None (the person is asked to
//! name a part and colours). Pure; tested here. The result is validated like any item
//! (`parts::check_effects`).

use std::collections::BTreeMap;

use serde_json::{json, Value};

use super::parts::{self, Part};

/// Everyday words for parts whose names a person would not say ("a jacket" is the Ark Jacket).
const SYNONYMS: &[(&str, &str)] = &[
    ("jacket", "ark-jacket"), ("coat", "pea-coat"), ("scarf", "knit-scarf"), ("halo", "memory-halo"), ("aura", "star-aura"),
    ("cap", "crew-cap"), ("hat", "brim-hat"), ("backpack", "trail-pack"), ("bag", "tote"), ("necklace", "cord-necklace"),
    ("glasses", "round-spectacles"), ("spectacles", "round-spectacles"), ("watch", "trail-watch"), ("lantern", "star-lantern"),
    ("dress", "gown"), ("trousers", "trousers"), ("pants", "trousers"), ("shirt", "top"), ("tie", "neckwear"),
    ("shield", "kite-shield"), ("goggles", "flight-goggles"), ("bat", "cricket-bat"), ("collar", "dog-collar"),
    ("bracelet", "bangles"), ("bangles", "bangles"), ("shoes", "shoes"), ("boots", "shoes"), ("cape", "cape"), ("crown", "crown"),
    ("confetti", "cheer-confetti"), ("fireworks", "cheer-fireworks"), ("petals", "cheer-petals"), ("rainbow", "cheer-rainbow"),
];

/// Colour words a person says, as the colour drawn.
const COLOURS: &[(&str, &str)] = &[
    ("red", "#c62e3a"), ("crimson", "#8e1b2b"), ("pink", "#e58fb0"), ("orange", "#ff7a1e"), ("gold", "#d39744"), ("golden", "#d39744"),
    ("yellow", "#ffcf5a"), ("green", "#3f8f4e"), ("emerald", "#1f6b4f"), ("mint", "#8fe0b8"), ("teal", "#1fa3a6"), ("cyan", "#1fd2d6"),
    ("blue", "#4a8df0"), ("navy", "#151c33"), ("sky", "#7fb4e8"), ("purple", "#8a4bd6"), ("violet", "#c25cf0"), ("lilac", "#c8a8e8"),
    ("cream", "#f4eee2"), ("white", "#ffffff"), ("black", "#1a1a1a"), ("grey", "#8a9099"), ("gray", "#8a9099"), ("brown", "#7f4a24"),
    ("silver", "#c8ccd4"), ("fiery", "#ff6a1e"), ("fire", "#e2452f"),
];

/// "fast" moves at three quarters of a part's range, "slow" at a fifth.
const FAST: &[&str] = &["fast", "quick", "quickly", "rapid", "swirling", "spinning"];
const SLOW: &[&str] = &["slow", "slowly", "gentle", "gently", "calm", "lazy"];

/// The item `description` describes, as (name, part id, effects), or None when it names no part.
pub fn read(description: &str) -> Option<(String, &'static str, BTreeMap<String, Value>)> {
    let lower = description.to_lowercase();
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let part = part_named(&words)?;
    let mut effects = BTreeMap::new();
    let colours: Vec<&str> = words.iter().filter_map(|w| COLOURS.iter().find(|(name, _)| name == w).map(|(_, hex)| *hex)).collect();
    let colour_keys: Vec<&str> = part.effects.iter().filter(|e| e.kind == "color").map(|e| e.key).collect();
    for (key, hex) in colour_keys.iter().zip(colours.iter()) {
        effects.insert(key.to_string(), json!(hex));
    }
    let pace = if words.iter().any(|w| FAST.contains(w)) { Some(0.75) } else if words.iter().any(|w| SLOW.contains(w)) { Some(0.2) } else { None };
    if let Some(share) = pace {
        for e in part.effects.iter().filter(|e| e.kind == "number" && (e.key.starts_with("spin") || e.key == "speed" || e.key == "sway")) {
            effects.insert(e.key.to_string(), json!(((e.min + (e.max - e.min) * share) * 100.0).round() / 100.0));
        }
    }
    Some((name_of(description), part.id, effects))
}

/// The part the words name: an everyday word first ("scarf"), then a word of a part's own name ("lantern").
fn part_named(words: &[&str]) -> Option<&'static Part> {
    let by_synonym = words.iter().find_map(|w| SYNONYMS.iter().find(|(said, _)| said == w).map(|(_, id)| *id));
    let id = by_synonym.or_else(|| {
        parts::PARTS.iter().find(|p| p.name.to_lowercase().split_whitespace().any(|n| n.len() > 3 && words.contains(&n))).map(|p| p.id)
    })?;
    parts::PARTS.iter().find(|p| p.id == id)
}

/// A short name from the words: "a cosy green scarf with cream stripes" → "Cosy Green Scarf".
fn name_of(description: &str) -> String {
    let before_with = description.split(" with ").next().unwrap_or(description);
    let words: Vec<String> = before_with
        .split_whitespace()
        .filter(|w| !matches!(w.to_lowercase().as_str(), "a" | "an" | "the" | "my" | "some"))
        .map(|w| {
            let mut chars = w.chars();
            chars.next().map(|c| c.to_uppercase().collect::<String>() + chars.as_str()).unwrap_or_default()
        })
        .collect();
    let name = words.join(" ");
    if name.is_empty() { "My Item".into() } else { name.chars().take(40).collect() }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn a_plain_description_becomes_an_item() {
        let (name, part, effects) = super::read("a cosy green scarf with cream stripes").unwrap();
        assert_eq!((name.as_str(), part), ("Cosy Green Scarf", "knit-scarf"));
        assert_eq!(effects["color"], json!("#3f8f4e"));
        assert_eq!(effects["stripe"], json!("#f4eee2"));
    }

    #[test]
    fn every_suggestion_the_forge_shows_works_without_a_mind() {
        let (_, jacket, fx) = super::read("a neon pink jacket with gold trim").unwrap();
        assert_eq!(jacket, "ark-jacket");
        assert_eq!((fx["color"].clone(), fx["trim"].clone()), (json!("#e58fb0"), json!("#d39744")));
        let (_, halo, fx) = super::read("a slow purple halo").unwrap();
        assert_eq!(halo, "memory-halo");
        assert_eq!(fx["color"], json!("#8a4bd6"));
        assert!(fx["spinIdle"].as_f64().unwrap() < 1.0, "slow: {fx:?}");
        let (_, aura, fx) = super::read("a fiery aura that swirls fast").unwrap();
        assert_eq!(aura, "star-aura");
        assert!(fx["speed"].as_f64().unwrap() >= 3.0, "fast: {fx:?}");
    }

    #[test]
    fn words_that_name_no_part_are_left_to_the_mind() {
        assert!(super::read("something lovely for a party").is_none());
    }

    #[test]
    fn what_it_reads_is_always_a_valid_item() {
        for words in ["a cosy green scarf with cream stripes", "a neon pink jacket with gold trim", "a slow purple halo", "a fiery aura that swirls fast", "a black top hat", "a silver crown"] {
            let (_, part, effects) = super::read(words).unwrap();
            let worn = super::parts::WornPart { part: part.into(), effects, item: None, rarity: None, set: None, colour: None };
            assert!(super::parts::check_effects(&worn).is_ok(), "{words}");
        }
    }
}
