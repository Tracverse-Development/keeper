//! Packs: shareable `.keeper.json` files. Data only, never code: a pack carries a soul, a part
//! variant, or a whole keeper (name, species, role, soul, outfit), never memories. Everything is
//! validated on the way in (`read`): known format, known species/role/parts, effects in range,
//! text cleaned and capped, file size bounded. Wardrobe items travel as data only: a keeper's
//! outfit carries each part and its effect values, never references into the sender's wardrobe.

use serde::{Deserialize, Serialize};

use super::parts::{self, WornPart};
use super::souls::{self, Soul};
use super::{roles, species};

pub const FORMAT: &str = "keeper-pack/1";
/// A pack is small text; anything bigger is not a pack.
pub const MAX_BYTES: usize = 64 * 1024;

/// A part with its own effect values and name ("Ruby Halo"): an item in the person's wardrobe.
/// One of a kind = a single physical item (one keeper wears it at a time); otherwise a design
/// any number of keepers can wear (`wardrobe.rs`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Variant {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub worn: WornPart,
    #[serde(default, rename = "oneOfAKind", skip_serializing_if = "std::ops::Not::not")]
    pub one_of_a_kind: bool,
}

/// The id a wardrobe item or variant takes from its name ("Trini's Jacket" → "trini-s-jacket").
pub fn slug(s: &str) -> String {
    s.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect::<String>().split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-").chars().take(40).collect()
}

/// A name cleaned for display: single spaces, at most 40 characters; empty is refused.
pub fn clean_name(name: &str) -> Result<String, String> {
    let name: String = name.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(40).collect();
    if name.is_empty() || slug(&name).is_empty() {
        return Err("A wardrobe item needs a name.".into());
    }
    Ok(name)
}

/// An outfit as data only: wardrobe references stripped (they name items in someone's wardrobe).
pub fn data_only(worn: &[WornPart]) -> Vec<WornPart> {
    worn.iter().map(|w| WornPart { item: None, ..w.clone() }).collect()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperBlueprint {
    pub name: String,
    pub species: String,
    pub role: String,
    pub soul: Soul,
    #[serde(default)]
    pub wearables: Vec<WornPart>,
    /// Colour and material per paint zone (validated against the species on import).
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub look: std::collections::BTreeMap<String, super::look::ZoneLook>,
    /// Idle habits (validated against the species on import).
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub habits: std::collections::BTreeMap<String, f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Pack {
    Soul { format: String, soul: Soul },
    Variant { format: String, variant: Variant },
    Keeper { format: String, keeper: KeeperBlueprint },
}

/// Read and validate a pack file's text.
pub fn read(text: &str) -> Result<Pack, String> {
    if text.len() > MAX_BYTES {
        return Err("That file is too big to be a keeper pack.".into());
    }
    let pack: Pack = serde_json::from_str(text).map_err(|_| "That isn't a keeper pack (or it's damaged).".to_string())?;
    let format_ok = |f: &str| if f == FORMAT { Ok(()) } else { Err(format!("This pack is for a different Keeper version ({f}).")) };
    match pack {
        Pack::Soul { format, soul } => {
            format_ok(&format)?;
            Ok(Pack::Soul { format, soul: souls::sanitize(&soul)? })
        }
        Pack::Variant { format, variant } => {
            format_ok(&format)?;
            let worn = WornPart { item: None, ..parts::check_effects(&variant.worn)? };
            let name = clean_name(&variant.name).map_err(|_| "A part variant needs a name.".to_string())?;
            Ok(Pack::Variant { format, variant: Variant { id: slug(&name), name, worn, one_of_a_kind: variant.one_of_a_kind } })
        }
        Pack::Keeper { format, keeper } => {
            format_ok(&format)?;
            if species::get(&keeper.species).is_none() {
                return Err(format!("This Keeper doesn't have the {} body yet.", keeper.species));
            }
            if !roles::exists(&keeper.role) {
                return Err(format!("This Keeper doesn't know the role {} yet.", keeper.role));
            }
            let name: String = keeper.name.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(24).collect();
            if !crate::keepers::valid_name(&name) {
                return Err("The keeper in this pack has an unusable name.".into());
            }
            let soul = if keeper.soul.builtin && souls::builtin().iter().any(|b| b.id == keeper.soul.id) { keeper.soul } else { souls::sanitize(&keeper.soul)? };
            let (look, habits) = (super::look::without_rare(super::look::check_look(&keeper.look, &keeper.species)), super::look::check_habits(&keeper.habits, &keeper.species));
            Ok(Pack::Keeper { format, keeper: KeeperBlueprint { name, wearables: data_only(&parts::check_outfit(&keeper.wearables, &keeper.species)?), species: keeper.species, role: keeper.role, soul, look, habits } })
        }
    }
}

/// Who made a pack: a name and, optionally, a link to them. Travels beside the pack's data as
/// a `maker` field and is shown before a pack is added; it is a label, never a proof of who
/// made it (packs are not signed).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Maker {
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub link: String,
}

/// A maker from what the person typed: a cleaned name (none: no maker) and a link that is kept
/// only when it is a plain https address.
pub fn clean_maker(name: &str, link: &str) -> Option<Maker> {
    let name: String = name.split_whitespace().collect::<Vec<_>>().join(" ").chars().filter(|c| !c.is_control()).take(40).collect();
    if name.is_empty() {
        return None;
    }
    let link = link.trim();
    let link_ok = link.len() > 8 && link.len() <= 200 && link.starts_with("https://") && !link.chars().any(|c| c.is_whitespace() || c.is_control() || ['"', '<', '>', '\\'].contains(&c));
    Some(Maker { name, link: if link_ok { link.to_string() } else { String::new() } })
}

/// The text of a pack (pretty JSON), ready to save as `<name>.keeper.json`: its maker's name when
/// the person gave one, and signed with this person's key (`pack_sign`).
pub fn write(pack: &Pack, maker: Option<&Maker>) -> crate::kernel::Result<String> {
    let mut value = serde_json::to_value(pack).unwrap_or_default();
    if let (Some(maker), Some(object)) = (maker, value.as_object_mut()) {
        object.insert("maker".into(), serde_json::to_value(maker).unwrap_or_default());
    }
    super::pack_sign::sign(&mut value)?;
    Ok(serde_json::to_string_pretty(&value).unwrap_or_default())
}

/// The maker a pack's text names, if any (read without trusting it; cleaned).
pub fn maker_of(text: &str) -> Option<Maker> {
    let v: serde_json::Value = serde_json::from_str(text).ok()?;
    clean_maker(v["maker"]["name"].as_str()?, v["maker"]["link"].as_str().unwrap_or(""))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_halo_dog_keeper_pack_round_trips() {
        let text = json!({"kind": "keeper", "format": FORMAT, "keeper": {"name": "Halo Dog", "species": "puppy", "role": "companion",
            "soul": {"id": "sunny-pup", "name": "Sunny Pup", "builtin": true}, "wearables": [{"part": "memory-halo", "effects": {"color": "#ff0000"}}]}}).to_string();
        let Pack::Keeper { keeper, .. } = read(&text).unwrap() else { panic!() };
        assert_eq!((keeper.name.as_str(), keeper.species.as_str(), keeper.wearables[0].part.as_str()), ("Halo Dog", "puppy", "memory-halo"));
        let maker = clean_maker("  Amos   Thomas ", "https://umojaark.com/amos").unwrap();
        let text = write(&Pack::Keeper { format: FORMAT.into(), keeper }, Some(&maker)).unwrap();
        assert!(read(&text).is_ok(), "a pack with a maker still reads");
        assert!(text.contains("\"maker\"") && text.contains("Amos Thomas") && text.contains("https://umojaark.com/amos"));
        assert_eq!(clean_maker("Amos", "javascript:alert(1)").unwrap().link, "", "only https links are kept");
        assert_eq!(clean_maker("Amos", "http://plain.example").unwrap().link, "");
        assert!(clean_maker("   ", "https://x.example").is_none(), "no name, no maker");
    }

    #[test]
    fn a_keeper_pack_carries_its_look_and_habits_checked_for_its_body() {
        let text = json!({"kind": "keeper", "format": FORMAT, "keeper": {"name": "Red Ears", "species": "puppy", "role": "companion",
            "soul": {"id": "sunny-pup", "name": "Sunny Pup", "builtin": true},
            "look": {"ears": {"color": "#e2425f", "material": "fur"}, "antenna": {"color": "#ffffff"}},
            "habits": {"chase-tail": 3, "hum": 2, "sleep": 99}}}).to_string();
        let Pack::Keeper { keeper, .. } = read(&text).unwrap() else { panic!() };
        assert_eq!(keeper.look.len(), 1, "a dog has no antenna");
        assert_eq!(keeper.look["ears"].color.as_deref(), Some("#e2425f"));
        assert_eq!(keeper.habits.get("chase-tail"), Some(&3.0));
        assert_eq!(keeper.habits.get("sleep"), Some(&3.0), "clamped");
        assert!(!keeper.habits.contains_key("hum"), "humming is the robot's");
        let again = read(&write(&Pack::Keeper { format: FORMAT.into(), keeper: keeper.clone() }, None).unwrap()).unwrap();
        assert_eq!(again, Pack::Keeper { format: FORMAT.into(), keeper });
    }

    #[test]
    fn bad_packs_are_refused_in_plain_words() {
        assert!(read("{\"kind\":\"keeper\"}").is_err());
        assert!(read(&json!({"kind": "variant", "format": FORMAT, "variant": {"id": "x", "name": "Laser", "part": "laser-eyes"}}).to_string()).is_err());
        assert!(read(&json!({"kind": "soul", "format": "keeper-pack/9", "soul": {"id": "a", "name": "A"}}).to_string()).unwrap_err().contains("different"));
        assert!(read(&"x".repeat(MAX_BYTES + 1)).is_err());
        let v = read(&json!({"kind": "variant", "format": FORMAT, "variant": {"id": "x", "name": "Ruby Halo", "part": "memory-halo", "effects": {"spinWork": 50}}}).to_string()).unwrap();
        let Pack::Variant { variant, .. } = v else { panic!() };
        assert_eq!((variant.id.as_str(), variant.worn.effects.get("spinWork")), ("ruby-halo", Some(&json!(8.0))));
    }

    #[test]
    fn wardrobe_items_travel_as_data_only() {
        let text = json!({"kind": "keeper", "format": FORMAT, "keeper": {"name": "Pup", "species": "puppy", "role": "companion",
            "soul": {"id": "sunny-pup", "name": "Sunny Pup", "builtin": true},
            "wearables": [{"part": "ark-jacket", "item": "kit:trini-jacket", "effects": {"color": "#151c33"}}, {"part": "trail-pack", "item": "part:trail-pack"}]}}).to_string();
        let Pack::Keeper { keeper, .. } = read(&text).unwrap() else { panic!() };
        assert_eq!(keeper.wearables.len(), 2);
        assert!(keeper.wearables.iter().all(|w| w.item.is_none()), "{:?}", keeper.wearables);
        assert_eq!(keeper.wearables.iter().find(|w| w.part == "ark-jacket").unwrap().effects.get("color"), Some(&json!("#151c33")));
        let two_in_one_slot = json!({"kind": "keeper", "format": FORMAT, "keeper": {"name": "Pup", "species": "puppy", "role": "companion",
            "soul": {"id": "sunny-pup", "name": "Sunny Pup", "builtin": true}, "wearables": [{"part": "crew-cap"}, {"part": "crew-cap"}]}}).to_string();
        assert!(read(&two_in_one_slot).is_err());
        let one = json!({"kind": "variant", "format": FORMAT, "variant": {"id": "x", "name": "Trini's Jacket", "part": "ark-jacket", "oneOfAKind": true, "item": "kit:zzz"}}).to_string();
        let Pack::Variant { variant, .. } = read(&one).unwrap() else { panic!() };
        assert!(variant.one_of_a_kind && variant.worn.item.is_none() && variant.id == "trini-s-jacket");
    }
}
