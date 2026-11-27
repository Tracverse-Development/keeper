//! Tests for the wardrobe rules (pure: keeper profiles in, keeper profiles out).

use super::*;
use serde_json::json;

fn keeper(id: &str, name: &str, skin: &str) -> KeeperProfile {
    KeeperProfile { id: id.into(), name: name.into(), skin: skin.into(), ..KeeperProfile::default() }
}

fn trini_jacket() -> Variant {
    let worn: WornPart = serde_json::from_value(json!({"part": "ark-jacket", "effects": {"color": "#e2425f", "trim": "#151c33"}})).unwrap();
    Variant { id: "trini-jacket".into(), name: "Trini Boi's Jacket".into(), worn, one_of_a_kind: true }
}

fn setup() -> (Vec<KeeperProfile>, Vec<Item>) {
    (vec![keeper("k1", "Trini Boi", "robot"), keeper("k2", "Pup", "puppy")], items(&[trini_jacket()]))
}

fn find<'a>(items: &'a [Item], id: &str) -> &'a Item {
    items.iter().find(|i| i.id == id).unwrap()
}

#[test]
fn the_wardrobe_lists_every_part_the_stock_variants_and_the_persons_items() {
    let (_, items) = setup();
    for p in parts::PARTS {
        assert!(items.iter().any(|i| i.id == format!("part:{}", p.id) && i.slot == p.slot && i.source == "built-in"));
    }
    assert!(items.iter().filter(|i| i.id.starts_with("stock:")).count() >= 5, "brand-colour variants ship");
    let mine = find(&items, "kit:trini-jacket");
    assert!(mine.one_of_a_kind && mine.slot == "torso" && mine.source == "yours");
    // A bad item from the graph is skipped, and a newer save of an id replaces the older one.
    let bad = Variant { id: "x".into(), name: "X".into(), worn: WornPart { part: "laser".into(), effects: BTreeMap::new(), item: None, rarity: None }, one_of_a_kind: false };
    let mut renamed = trini_jacket();
    renamed.name = "Trini's Red Jacket".into();
    let items = super::items(&[bad, trini_jacket(), renamed]);
    assert_eq!(items.iter().filter(|i| i.id == "kit:trini-jacket").count(), 1);
    assert_eq!(find(&items, "kit:trini-jacket").name, "Trini's Red Jacket");
    assert!(!items.iter().any(|i| i.id == "kit:x"));
}

#[test]
fn a_design_is_free_to_wear_by_many_keepers_any_species() {
    let (mut keepers, items) = setup();
    let jacket = find(&items, "part:ark-jacket").clone();
    wear(&mut keepers, "k1", &jacket, &items).unwrap();
    wear(&mut keepers, "k2", &jacket, &items).unwrap();
    assert_eq!(worn_by(&jacket, &keepers, &items), vec!["k1", "k2"]);
    assert_eq!(keepers[1].wearables.last().unwrap().item.as_deref(), Some("part:ark-jacket"));
}

#[test]
fn one_thing_per_slot_wearing_replaces_whatever_was_there() {
    let (mut keepers, items) = setup();
    wear(&mut keepers, "k2", find(&items, "part:crew-cap"), &items).unwrap();
    wear(&mut keepers, "k2", find(&items, "stock:gold-cap"), &items).unwrap();
    let heads: Vec<_> = keepers[1].wearables.iter().filter(|w| w.part == "crew-cap").collect();
    assert_eq!(heads.len(), 1);
    assert_eq!(heads[0].item.as_deref(), Some("stock:gold-cap"));
    assert_eq!(heads[0].effects.get("color"), Some(&json!("#d39744")));
    assert!(parts::check_outfit(&keepers[1].wearables, "puppy").is_ok(), "the result is always a valid outfit");
}

#[test]
fn give_trini_bois_jacket_to_pup_moves_a_one_of_a_kind_item() {
    let (mut keepers, items) = setup();
    let jacket = find(&items, "kit:trini-jacket").clone();
    wear(&mut keepers, "k1", &jacket, &items).unwrap();
    let err = give(&mut keepers, &jacket, "k1", "k2", Give::Share, &items).unwrap_err();
    assert!(err.contains("one of a kind"), "{err}");
    give(&mut keepers, &jacket, "k1", "k2", Give::Move, &items).unwrap();
    assert_eq!(worn_by(&jacket, &keepers, &items), vec!["k2"]);
    // Putting it back on Trini Boi takes it off Pup again: one physical jacket.
    wear(&mut keepers, "k1", &jacket, &items).unwrap();
    assert_eq!(worn_by(&jacket, &keepers, &items), vec!["k1"]);
}

#[test]
fn sharing_and_moving_a_design() {
    let (mut keepers, items) = setup();
    let scarf = find(&items, "stock:cream-scarf").clone();
    wear(&mut keepers, "k1", &scarf, &items).unwrap();
    give(&mut keepers, &scarf, "k1", "k2", Give::Share, &items).unwrap();
    assert_eq!(worn_by(&scarf, &keepers, &items), vec!["k1", "k2"]);
    // Moving to a keeper that already wears the design just takes it off the giver.
    give(&mut keepers, &scarf, "k2", "k1", Give::Move, &items).unwrap();
    assert_eq!(worn_by(&scarf, &keepers, &items), vec!["k1"]);
}

#[test]
fn refusals_are_plain_sentences() {
    let (mut keepers, items) = setup();
    let pack = find(&items, "part:trail-pack").clone();
    assert!(take_off(&mut keepers, "k1", &pack, &items).unwrap_err().contains("isn't wearing"));
    assert!(give(&mut keepers, &pack, "k1", "k2", Give::Move, &items).unwrap_err().contains("isn't wearing"));
    assert!(give(&mut keepers, &pack, "k1", "k1", Give::Move, &items).is_err());
    assert!(wear(&mut keepers, "k9", &pack, &items).unwrap_err().contains("no such keeper"));
    // A body without the slot: the wardrobe says so instead of failing.
    let mut ghost = keepers.clone();
    ghost[0].skin = "ghost".into();
    let err = wear(&mut ghost, "k1", &pack, &items).unwrap_err();
    assert_eq!(err, "Trini Boi has no back to wear the Trail Pack on.");
    assert_eq!(Give::parse("move"), Some(Give::Move));
    assert_eq!(Give::parse("steal"), None);
}

#[test]
fn outfits_from_before_the_wardrobe_still_show_who_wears_what() {
    let (mut keepers, items) = setup();
    keepers[0].wearables = vec![WornPart { part: "memory-halo".into(), effects: BTreeMap::new(), item: None, rarity: None }];
    assert_eq!(worn_by(find(&items, "part:memory-halo"), &keepers, &items), vec!["k1", "k2"]);
    take_off(&mut keepers, "k1", find(&items, "part:memory-halo"), &items).unwrap();
    assert!(keepers[0].wearables.is_empty());
}

#[test]
fn a_dogs_own_things_and_the_moment_effects_go_through_the_wardrobe() {
    let (mut keepers, items) = setup();
    // Only a dog has paws: the robot is refused in a sentence, the puppy wears the nails.
    let err = wear(&mut keepers, "k1", find(&items, "part:paw-nails"), &items).unwrap_err();
    assert_eq!(err, "Trini Boi has no paws to wear the Nail Set on.");
    wear(&mut keepers, "k2", find(&items, "part:paw-nails"), &items).unwrap();
    // The collar fits a dog's neck only.
    assert!(wear(&mut keepers, "k1", find(&items, "part:dog-collar"), &items).unwrap_err().contains("doesn't fit"));
    wear(&mut keepers, "k2", find(&items, "part:dog-collar"), &items).unwrap();
    // Every body takes a thinking and a celebrate effect; a second thinking effect replaces the first.
    for id in ["k1", "k2"] {
        wear(&mut keepers, id, find(&items, "part:think-orbit"), &items).unwrap();
        wear(&mut keepers, id, find(&items, "part:think-vortex"), &items).unwrap();
        wear(&mut keepers, id, find(&items, "part:cheer-fireworks"), &items).unwrap();
    }
    let pup: Vec<&str> = keepers[1].wearables.iter().map(|w| w.part.as_str()).collect();
    assert!(pup.contains(&"paw-nails") && pup.contains(&"dog-collar") && pup.contains(&"think-vortex") && !pup.contains(&"think-orbit"), "{pup:?}");
    assert!(parts::check_outfit(&keepers[1].wearables, "puppy").is_ok());
    assert!(parts::check_outfit(&keepers[0].wearables, "robot").is_ok());
}
