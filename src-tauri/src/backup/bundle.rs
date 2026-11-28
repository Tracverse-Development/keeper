//! What a backup holds, and the checks a backup read back from a file must pass before any of
//! it is used. A backup is the person's own, but a file is a file: every profile is cleaned the
//! way an imported pack is, and every record name and size is checked.

use serde::{Deserialize, Serialize};

use crate::keepers::kit::{look, parts, roles, species};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::{DeskError, Result};
use crate::memory::relocate::{keeper_sub, Asset};

pub const FORMAT: &str = "keeper-backup/1";
/// Bounds on what a backup may bring in (far above any real keeper).
pub const MAX_KEEPERS: usize = 12;
const MAX_ASSETS: usize = 20_000;
const MAX_QUADS: usize = 5_000;
const MAX_NAME: usize = 160;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub format: String,
    pub made_at: String,
    pub app: String,
    pub keepers: Vec<KeeperBundle>,
    /// The kit: souls, modes, wardrobe items.
    pub kit: Vec<Asset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperBundle {
    pub profile: KeeperProfile,
    pub memory: Vec<Asset>,
    /// The home graph the keeper lived in on the computer that made the backup (read before the
    /// profile is cleaned): the same as this computer's means it is the SAME keeper coming back.
    #[serde(skip)]
    pub from_graph: String,
}

impl Bundle {
    pub fn records(&self) -> usize {
        self.kit.len() + self.keepers.iter().map(|k| k.memory.len()).sum::<usize>()
    }
}

fn bad(what: &str) -> DeskError {
    DeskError::Invalid(format!("This backup can't be used: {what}."))
}

fn check_assets(assets: &[Asset]) -> Result<()> {
    if assets.len() > MAX_ASSETS {
        return Err(bad("it holds more records than a keeper can have"));
    }
    for a in assets {
        let name_ok = !a.name.is_empty() && a.name.len() <= MAX_NAME && a.name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
        if !name_ok || a.quads.is_empty() || a.quads.len() > MAX_QUADS {
            return Err(bad("one of its records is not a Keeper record"));
        }
    }
    Ok(())
}

/// A profile from a backup, cleaned: only known bodies, modes, parts, zones and habits survive;
/// where its memory lives is decided by the computer it is restored on, never by the file.
fn clean_profile(p: &KeeperProfile) -> Result<KeeperProfile> {
    if p.id.is_empty() || keeper_sub(&p.id) != p.id {
        return Err(bad("one of its keepers has no proper id"));
    }
    let skin = if species::get(&p.skin).is_some() { p.skin.clone() } else { "robot".to_string() };
    let model_ok = p.model.len() <= 60 && p.model.chars().all(|c| c.is_ascii_alphanumeric() || "-._:/".contains(c));
    Ok(KeeperProfile {
        id: p.id.clone(),
        name: if crate::keepers::valid_name(&p.name) { p.name.trim().to_string() } else { "Keeper".into() },
        role: if roles::exists(&p.role) { p.role.clone() } else { KeeperProfile::default().role },
        soul: p.soul.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(60).collect(),
        wearables: p.wearables.iter().filter_map(|w| parts::check(w, &skin).ok().map(|ok| parts::WornPart { item: w.item.clone().filter(|i| i.len() <= 80), ..ok })).collect(),
        look: look::check_look(&p.look, &skin),
        habits: look::check_habits(&p.habits, &skin),
        brain: if crate::brain::engines::spec(&p.brain).is_some() { p.brain.clone() } else { "reflex".into() },
        model: if model_ok { p.model.clone() } else { String::new() },
        voice: p.voice.clone().filter(|v| v.id.len() <= 80 && !v.id.chars().any(char::is_control)),
        style: if crate::brain::styles::exists(&p.style) { p.style.clone() } else { String::new() },
        feelings_off: p.feelings_off,
        skin,
        graph_id: String::new(),
        memory_sub: None,
        legacy_graph: None,
        // A restored keeper keeps only loadouts naming a real mode and a real set.
        loadouts: crate::keepers::kit::loadout::checked(&p.loadouts),
        home_outfit: None,
        mode_outfits: Default::default(),
        // Only real coat names (a backup is the person's own file, not a proof: see KNOWN_ISSUES DESK-COAT-001).
        obtained: look::obtained(&p.obtained, &p.look),
    })
}

/// A backup read from a file, checked and cleaned; anything off refuses the whole backup.
pub fn read(bytes: &[u8]) -> Result<Bundle> {
    let bundle: Bundle = serde_json::from_slice(bytes).map_err(|_| bad("it isn't readable"))?;
    if bundle.format != FORMAT {
        return Err(bad("it was made by a different version of Keeper"));
    }
    if bundle.keepers.is_empty() || bundle.keepers.len() > MAX_KEEPERS {
        return Err(bad("it holds no keepers, or too many"));
    }
    check_assets(&bundle.kit)?;
    let mut keepers = Vec::new();
    for k in &bundle.keepers {
        check_assets(&k.memory)?;
        let profile = clean_profile(&k.profile)?;
        if keepers.iter().any(|x: &KeeperBundle| x.profile.id == profile.id) {
            return Err(bad("it names the same keeper twice"));
        }
        keepers.push(KeeperBundle { profile, memory: k.memory.clone(), from_graph: k.profile.graph_id.clone() });
    }
    Ok(Bundle { keepers, ..bundle })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dkg::Quad;

    fn asset(name: &str) -> Asset {
        Asset { name: name.into(), quads: vec![Quad { subject: "urn:s".into(), predicate: "urn:p".into(), object: "\"o\"".into() }] }
    }

    fn bundle(profile: KeeperProfile) -> Bundle {
        Bundle { format: FORMAT.into(), made_at: "2026-11-26T00:00:00Z".into(), app: "0.9.1".into(), keepers: vec![KeeperBundle { profile, memory: vec![asset("desk-fact-1")], from_graph: String::new() }], kit: vec![asset("kit-soul-1")] }
    }

    fn keeper(id: &str) -> KeeperProfile {
        KeeperProfile { id: id.into(), name: "Trini Boi".into(), ..KeeperProfile::default() }
    }

    #[test]
    fn a_backup_comes_back_as_it_was_saved() {
        let saved = serde_json::to_vec(&bundle(keeper("keeper-1"))).unwrap();
        let back = read(&saved).unwrap();
        assert_eq!((back.keepers[0].profile.name.as_str(), back.records()), ("Trini Boi", 2));
        assert_eq!(back.keepers[0].memory[0], asset("desk-fact-1"));
    }

    #[test]
    fn a_profile_from_a_file_is_cleaned_and_never_says_where_memory_lives() {
        let odd = KeeperProfile { skin: "dragon".into(), role: "root".into(), brain: "mystery".into(), model: "x y;rm".into(), graph_id: "someone-elses-graph".into(), memory_sub: Some("../kit".into()), legacy_graph: Some("old".into()), name: "<b>".into(), ..keeper("keeper-9") };
        let back = read(&serde_json::to_vec(&bundle(odd)).unwrap()).unwrap();
        let p = &back.keepers[0].profile;
        assert_eq!((p.skin.as_str(), p.brain.as_str(), p.model.as_str(), p.name.as_str()), ("robot", "reflex", "", "Keeper"));
        assert!(roles::exists(&p.role));
        assert_eq!((p.graph_id.as_str(), &p.memory_sub, &p.legacy_graph), ("", &None, &None));
    }

    #[test]
    fn anything_off_refuses_the_whole_backup() {
        assert!(read(b"{}").is_err());
        assert!(read(&serde_json::to_vec(&Bundle { format: "keeper-backup/9".into(), ..bundle(keeper("keeper-1")) }).unwrap()).is_err());
        assert!(read(&serde_json::to_vec(&bundle(keeper("../kit"))).unwrap()).is_err(), "an id that is not an id");
        let mut twice = bundle(keeper("keeper-1"));
        twice.keepers.push(twice.keepers[0].clone());
        assert!(read(&serde_json::to_vec(&twice).unwrap()).is_err());
        let mut odd_record = bundle(keeper("keeper-1"));
        odd_record.kit = vec![asset("name with spaces")];
        assert!(read(&serde_json::to_vec(&odd_record).unwrap()).is_err());
    }
}
