//! The wardrobe: the person owns the clothes, keepers wear them. One wardrobe per person, made of
//! - every catalogue part, as a plain design (`part:<id>`),
//! - the built-in brand-colour variants (`stock:<id>`: Navy Jacket, Gold Cap, ...),
//! - the person's own items, made or imported (`kit:<id>`: `desk:KitItem` Knowledge Assets in their
//!   kit graph, each save a new time-versioned asset read newest-first, LES-004; `inventory.rs`).
//!
//! Ownership rule (kept simple on purpose): an item is a DESIGN, so wearing it is free and any
//! number of keepers can wear it at once; an item marked ONE OF A KIND is a single physical thing,
//! worn by at most one keeper, so putting it on one keeper takes it off another, and "give" moves
//! it. Each keeper's `wearables` are references into the wardrobe (`WornPart::item`) with the
//! effect values worn, so the character can draw them with no lookup and packs carry plain data.
//!
//! Pure: every rule here works on a list of keeper profiles and is tested without the DKG; the
//! commands (`keepers/wardrobe_commands.rs`) read the items from the node and save the profiles.

use std::collections::BTreeMap;

use serde::Serialize;
use serde_json::Value;

use super::packs::Variant;
use super::parts::{self, WornPart};
use super::{slots, species};
use crate::kernel::settings::KeeperProfile;

/// A built-in variant: a part in brand colours, shipped with Keeper.
struct Stock {
    id: &'static str,
    name: &'static str,
    part: &'static str,
    effects: &'static [(&'static str, &'static str)],
}

const STOCK: &[Stock] = &[
    Stock { id: "navy-jacket", name: "Navy Jacket", part: "ark-jacket", effects: &[("color", "#151c33"), ("trim", "#d39744")] },
    Stock { id: "gold-jacket", name: "Gold Jacket", part: "ark-jacket", effects: &[("color", "#d39744"), ("trim", "#151c33")] },
    Stock { id: "cream-scarf", name: "Cream Scarf", part: "knit-scarf", effects: &[("color", "#f4eee2"), ("stripe", "#d39744")] },
    Stock { id: "gold-cap", name: "Gold Cap", part: "crew-cap", effects: &[("color", "#d39744"), ("trim", "#151c33")] },
    Stock { id: "leather-pack", name: "Saddle Pack", part: "trail-pack", effects: &[("color", "#b57b2c"), ("trim", "#f4eee2")] },
];

/// One thing in the wardrobe.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    /// `part:<id>`, `stock:<id>` or `kit:<id>`.
    pub id: String,
    pub name: String,
    pub part: String,
    pub slot: String,
    pub effects: BTreeMap<String, Value>,
    pub one_of_a_kind: bool,
    /// "built-in", "official" or "yours".
    pub source: &'static str,
    /// Its rarity id: an official item's own, else its part's (`rarity.rs`).
    pub rarity: &'static str,
    /// One line about it (official items).
    pub blurb: &'static str,
}

impl Item {
    /// What a keeper wears when it puts this item on.
    pub fn worn(&self) -> WornPart {
        WornPart { part: self.part.clone(), effects: self.effects.clone(), item: Some(self.id.clone()) }
    }
}

/// The whole wardrobe: catalogue parts, stock variants, then the person's own items (invalid
/// ones skipped; a later item with the same id replaces an earlier one).
pub fn items(variants: &[Variant]) -> Vec<Item> {
    let mut out: Vec<Item> = parts::PARTS
        .iter()
        .map(|p| Item { id: format!("part:{}", p.id), name: p.name.into(), part: p.id.into(), slot: p.slot.into(), effects: BTreeMap::new(), one_of_a_kind: false, source: "built-in", rarity: super::rarity::of_part(p.id).id, blurb: "" })
        .collect();
    for s in STOCK {
        let effects = s.effects.iter().map(|(k, v)| (k.to_string(), Value::String(v.to_string()))).collect();
        if let Some(item) = item_from(format!("stock:{}", s.id), s.name, &WornPart { part: s.part.into(), effects, item: None }, false, "built-in") {
            out.push(item);
        }
    }
    for o in super::official::OFFICIAL {
        let effects: BTreeMap<String, Value> = serde_json::from_str(o.effects).unwrap_or_default();
        if let Some(mut item) = item_from(format!("official:{}", o.id), o.name, &WornPart { part: o.part.into(), effects, item: None }, false, "official") {
            item.rarity = super::rarity::get(o.rarity).map(|r| r.id).unwrap_or(item.rarity);
            item.blurb = o.blurb;
            out.push(item);
        }
    }
    for v in variants {
        if let Some(item) = item_from(format!("kit:{}", v.id), &v.name, &v.worn, v.one_of_a_kind, "yours") {
            out.retain(|o| o.id != item.id);
            out.push(item);
        }
    }
    out
}

fn item_from(id: String, name: &str, worn: &WornPart, one_of_a_kind: bool, source: &'static str) -> Option<Item> {
    let ok = parts::check_effects(worn).ok()?;
    let slot = parts::get(&ok.part)?.slot;
    let rarity = super::rarity::of_part(&ok.part).id;
    Some(Item { id, name: name.to_string(), part: ok.part, slot: slot.into(), effects: ok.effects, one_of_a_kind, source, rarity, blurb: "" })
}

/// Which item a worn part came from: its reference, or (outfits from before the wardrobe) the
/// first item with the same part and effect values.
pub fn item_of<'a>(worn: &WornPart, items: &'a [Item]) -> Option<&'a Item> {
    match &worn.item {
        Some(id) => items.iter().find(|i| &i.id == id),
        None => items.iter().find(|i| i.part == worn.part && i.effects == worn.effects),
    }
}

/// True when the worn part `w` is `item`.
fn wears(w: &WornPart, item: &Item, items: &[Item]) -> bool {
    matches!(item_of(w, items), Some(i) if i.id == item.id)
}

/// The keepers wearing `item` (ids, in keeper order).
pub fn worn_by(item: &Item, keepers: &[KeeperProfile], items: &[Item]) -> Vec<String> {
    keepers.iter().filter(|k| k.wearables.iter().any(|w| wears(w, item, items))).map(|k| k.id.clone()).collect()
}

fn keeper<'a>(keepers: &'a mut [KeeperProfile], id: &str) -> Result<&'a mut KeeperProfile, String> {
    keepers.iter_mut().find(|k| k.id == id).ok_or_else(|| "There is no such keeper.".to_string())
}

fn name_of(keepers: &[KeeperProfile], id: &str) -> String {
    keepers.iter().find(|k| k.id == id).map(|k| k.name.clone()).unwrap_or_else(|| "That keeper".into())
}

fn take_off_everyone_but(keepers: &mut [KeeperProfile], except: &str, item: &Item, items: &[Item]) {
    for k in keepers.iter_mut().filter(|k| k.id != except) {
        k.wearables.retain(|w| !wears(w, item, items));
    }
}

/// Put `item` on keeper `id`: whatever it wore in that slot comes off. A one-of-a-kind item comes
/// off whoever wore it before. Refused, in plain words, when the keeper's body has no such slot.
pub fn wear(keepers: &mut [KeeperProfile], id: &str, item: &Item, items: &[Item]) -> Result<(), String> {
    let who = keeper(keepers, id)?;
    if !species::offers(&who.skin, &item.slot) {
        return Err(format!("{} has no {} to wear the {} on.", who.name, slots::word(&item.slot), item.name));
    }
    let worn = parts::check(&item.worn(), &who.skin)?;
    who.wearables.retain(|w| !matches!(parts::get(&w.part), Some(p) if p.slot == item.slot));
    who.wearables.push(worn);
    if item.one_of_a_kind {
        take_off_everyone_but(keepers, id, item, items);
    }
    Ok(())
}

/// Take `item` off keeper `id`. Refused when it isn't wearing it.
pub fn take_off(keepers: &mut [KeeperProfile], id: &str, item: &Item, items: &[Item]) -> Result<(), String> {
    let who = keeper(keepers, id)?;
    let before = who.wearables.len();
    who.wearables.retain(|w| !wears(w, item, items));
    if who.wearables.len() == before {
        return Err(format!("{} isn't wearing the {}.", who.name, item.name));
    }
    Ok(())
}

/// How a keeper hands an item to another.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Give {
    /// The giver takes it off and the receiver puts it on.
    Move,
    /// Both wear it (designs only: a one-of-a-kind item can only move).
    Share,
}

impl Give {
    pub fn parse(s: &str) -> Option<Give> {
        match s {
            "move" => Some(Give::Move),
            "share" => Some(Give::Share),
            _ => None,
        }
    }
}

/// Keeper `from` gives `item` (which it is wearing) to keeper `to`.
pub fn give(keepers: &mut [KeeperProfile], item: &Item, from: &str, to: &str, how: Give, items: &[Item]) -> Result<(), String> {
    if from == to {
        return Err("Choose another keeper to give it to.".into());
    }
    keeper(keepers, to)?;
    if !worn_by(item, keepers, items).iter().any(|k| k == from) {
        return Err(format!("{} isn't wearing the {}.", name_of(keepers, from), item.name));
    }
    if how == Give::Share && item.one_of_a_kind {
        return Err(format!("The {} is one of a kind: move it instead.", item.name));
    }
    wear(keepers, to, item, items)?;
    if how == Give::Move && !item.one_of_a_kind {
        take_off(keepers, from, item, items)?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "wardrobe_tests.rs"]
mod tests;
