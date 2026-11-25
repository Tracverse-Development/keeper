//! Packs: shareable `.keeper.json` files. Data only, never code: a pack carries a soul, a part
//! variant, or a whole keeper (name, species, role, soul, outfit), never memories. Everything is
//! validated on the way in (`read`): known format, known species/role/parts, effects in range,
//! text cleaned and capped, file size bounded.

use serde::{Deserialize, Serialize};

use super::parts::{self, WornPart};
use super::souls::{self, Soul};
use super::{roles, species};

pub const FORMAT: &str = "keeper-pack/1";
/// A pack is small text; anything bigger is not a pack.
pub const MAX_BYTES: usize = 64 * 1024;

/// A part with its own effect values and name ("Ruby Halo").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Variant {
    pub id: String,
    pub name: String,
    #[serde(flatten)]
    pub worn: WornPart,
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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Pack {
    Soul { format: String, soul: Soul },
    Variant { format: String, variant: Variant },
    Keeper { format: String, keeper: KeeperBlueprint },
}

fn slug(s: &str) -> String {
    s.to_lowercase().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect::<String>().split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-").chars().take(40).collect()
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
            let worn = parts::check(&variant.worn, "any-species")
                .or_else(|_| species::SPECIES.iter().find_map(|s| parts::check(&variant.worn, s.id).ok()).ok_or_else(|| format!("There is no part called {}.", variant.worn.part)))?;
            let name: String = variant.name.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(40).collect();
            if name.is_empty() {
                return Err("A part variant needs a name.".into());
            }
            Ok(Pack::Variant { format, variant: Variant { id: slug(&name), name, worn } })
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
            Ok(Pack::Keeper { format, keeper: KeeperBlueprint { name, wearables: parts::check_outfit(&keeper.wearables, &keeper.species)?, species: keeper.species, role: keeper.role, soul } })
        }
    }
}

/// The text of a pack (pretty JSON), ready to save as `<name>.keeper.json`.
pub fn write(pack: &Pack) -> String {
    serde_json::to_string_pretty(pack).unwrap_or_default()
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
        assert!(read(&write(&Pack::Keeper { format: FORMAT.into(), keeper })).is_ok());
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
}
