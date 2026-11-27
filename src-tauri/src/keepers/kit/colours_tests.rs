//! Colour choices (`colours.rs`): palettes are valid data, the core keeps only colours from an
//! item's palette, and a colour once chosen survives every save that leaves it out.

use super::*;
use crate::kernel::settings::KeeperProfile;
use crate::keepers::kit::wardrobe;
use serde_json::json;

fn is_hex(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

#[test]
fn every_palette_is_valid_data_over_real_parts_and_items() {
    for (part, swatches) in PALETTES {
        let p = parts::get(part).unwrap_or_else(|| panic!("{part} is not a part"));
        assert!(p.effects.iter().any(|e| e.key == "color"), "{part} has no colour to change");
        assert!(swatches.len() >= 3, "{part}: a few colours to choose from");
    }
    for (item, _) in ITEM_PALETTES {
        assert!(super::super::collection::of_ref(Some(item)).is_some(), "{item} is not an official item");
    }
    for (_, swatches) in PALETTES.iter().chain(ITEM_PALETTES) {
        let mut ids = std::collections::BTreeSet::new();
        for s in *swatches {
            assert!(ids.insert(s.id), "{} twice in one palette", s.id);
            assert!(!s.id.is_empty() && s.id.chars().all(|c| c.is_ascii_lowercase() || c == '-'), "{}", s.id);
            assert!(is_hex(s.color) && s.trim.map_or(true, is_hex), "{}", s.id);
        }
    }
}

#[test]
fn an_item_palette_replaces_its_parts_and_parts_without_one_have_none() {
    assert_eq!(palette(Some("official:royal-jacket"), "ark-jacket")[0].id, "crimson");
    assert_eq!(palette(Some("official:ember-jacket"), "ark-jacket")[0].id, "red", "no override: the part's palette");
    assert!(palette(Some("part:memory-halo"), "memory-halo").is_empty());
    assert!(find(Some("official:royal-jacket"), "ark-jacket", "red").is_none(), "only the item's own palette counts");
}

#[test]
fn a_swatch_sets_the_colour_and_the_parts_own_second_colour() {
    let navy = find(None, "ark-jacket", "navy").unwrap();
    assert_eq!(effects_of(navy, "ark-jacket"), [("color".to_string(), json!("#151c33")), ("trim".to_string(), json!("#d39744"))].into());
    assert_eq!(effects_of(navy, "knit-scarf").get("stripe"), Some(&json!("#d39744")), "a scarf's second colour is its stripe");
    let silver = find(None, "trail-watch", "silver").unwrap();
    assert_eq!(effects_of(silver, "trail-watch").len(), 1, "metal leaves the watch face as designed");
}

#[test]
fn the_core_keeps_only_colours_from_the_items_palette() {
    let w = |colour: &str| serde_json::from_value::<WornPart>(json!({"part": "ark-jacket", "item": "official:ember-jacket", "effects": {"color": "#e2662c", "trim": "#e3b06a", "sway": 1.2}, "colour": colour})).unwrap();
    let red = parts::check_effects(&w("red")).unwrap();
    assert_eq!((red.colour.as_deref(), red.effects.get("color")), (Some("red"), Some(&json!("#b3262e"))));
    assert_eq!(red.effects.get("sway"), Some(&json!(1.2)), "other effects untouched");
    for unknown in ["crimson", "#ff0000", "", "<b>"] {
        let back = parts::check_effects(&w(unknown)).unwrap();
        assert_eq!((back.colour, back.effects.get("color")), (None, Some(&json!("#e2662c"))), "{unknown:?} is the item's own colour");
    }
    // A part with no palette never carries a colour.
    let halo: WornPart = serde_json::from_value(json!({"part": "memory-halo", "colour": "red"})).unwrap();
    assert_eq!(parts::check_effects(&halo).unwrap().colour, None);
}

#[test]
fn older_data_without_a_colour_reads_as_the_default_and_writes_nothing_new() {
    let old: WornPart = serde_json::from_str(r##"{"part":"ark-jacket","item":"official:ember-jacket","effects":{"color":"#e2662c"}}"##).unwrap();
    assert_eq!(old.colour, None);
    assert!(!serde_json::to_string(&old).unwrap().contains("colour"));
    let mut red = old.clone();
    red.colour = Some("red".into());
    let back: WornPart = serde_json::from_str(&serde_json::to_string(&red).unwrap()).unwrap();
    assert_eq!(back.colour.as_deref(), Some("red"), "the colour is stored with the worn item");
}

fn keeper(id: &str, skin: &str) -> KeeperProfile {
    KeeperProfile { id: id.into(), name: id.into(), skin: skin.into(), wearables: vec![], ..KeeperProfile::default() }
}

#[test]
fn a_colour_survives_wearing_again_a_save_without_it_a_loadout_and_a_gift() {
    let items = wardrobe::items(&[]);
    let jacket = items.iter().find(|i| i.id == "official:ember-jacket").unwrap();
    let mut keepers = vec![keeper("a", "robot"), keeper("b", "puppy")];
    wardrobe::wear(&mut keepers, "a", jacket, &items).unwrap();
    wardrobe::recolour(&mut keepers, "a", jacket, Some("navy"), &items).unwrap();
    let worn = |k: &KeeperProfile| k.wearables.iter().find(|w| w.part == "ark-jacket").cloned().unwrap();
    assert_eq!(worn(&keepers[0]).effects.get("color"), Some(&json!("#151c33")));
    // Wearing it again (no colour asked) keeps navy.
    wardrobe::wear(&mut keepers, "a", jacket, &items).unwrap();
    assert_eq!(worn(&keepers[0]).colour.as_deref(), Some("navy"));
    // An outfit saved again without the field keeps the stored colour.
    let resaved = carried(&keepers[0].wearables, vec![jacket.worn()]);
    assert_eq!((resaved[0].colour.as_deref(), resaved[0].effects.get("color")), (Some("navy"), Some(&json!("#151c33"))));
    // The rarity and set stamps still come from the item, whatever its colour.
    let stamped = super::super::rarity::stamped(&keepers[0].wearables);
    assert_eq!(stamped[0].rarity.as_deref(), Some("uncommon"));
    // Moved to another keeper, it is still navy.
    wardrobe::give(&mut keepers, jacket, "a", "b", wardrobe::Give::Move, &items).unwrap();
    assert_eq!(worn(&keepers[1]).colour.as_deref(), Some("navy"));
    assert!(keepers[0].wearables.iter().all(|w| w.part != "ark-jacket"));
    // Back to its own colours: the designed values return.
    wardrobe::recolour(&mut keepers, "b", jacket, None, &items).unwrap();
    assert_eq!((worn(&keepers[1]).colour, worn(&keepers[1]).effects), (None, jacket.effects.clone()));
    // And a colour from outside its palette is the default too.
    wardrobe::recolour(&mut keepers, "b", jacket, Some("crimson"), &items).unwrap();
    assert_eq!(worn(&keepers[1]).colour, None);
    assert!(wardrobe::recolour(&mut keepers, "a", jacket, Some("red"), &items).unwrap_err().contains("isn't wearing"));
}
