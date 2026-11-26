//! Backup: everything that makes the person's keepers theirs, in ONE file sealed with their
//! passphrase, to move to another computer or to keep. It is also the "export my data" right.
//!
//! In the file: every keeper's profile (name, body, look, mode, soul, voice choice) and every
//! record of its memory, and the kit (souls, modes, wardrobe). Records are read from the DKG
//! node exactly as written and restored under their own names, so a restored fact is still
//! forgettable by name and a restore that stopped can simply run again.
//!
//! NOT in the file: API keys and sign-ins (`kernel::secrets`), personal pictures, and the
//! node itself. A restored keeper's memory lives where THIS computer puts it (its sub-graph of
//! this install's home graph): the file never says where to write.
//!
//! `seal` = the encryption; `bundle` = the shape and the checks on a file read back.

mod bundle;
mod seal;

use base64::Engine;
use serde::Serialize;
use tauri::State;

use crate::kernel::settings::KeeperProfile;
use crate::kernel::{time, DeskError, Result};
use crate::memory::relocate;
use crate::state::AppState;

use bundle::{Bundle, KeeperBundle};

/// A backup larger than this is not read (the window sends it as one message).
const MAX_FILE_BYTES: usize = 200 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Saved {
    pub path: String,
    pub keepers: usize,
    pub records: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Restored {
    pub keepers: Vec<String>,
    /// Records written now, and records that were already here (left as they were).
    pub written: usize,
    pub already: usize,
}

/// Save a backup of every keeper and the kit to the Downloads folder, sealed with `passphrase`.
#[tauri::command]
pub async fn backup_save(state: State<'_, AppState>, passphrase: String) -> Result<Saved> {
    seal::check_passphrase(&passphrase)?;
    let client = state.client()?;
    let mut keepers = Vec::new();
    for profile in state.settings().keepers {
        let memory = relocate::export(&client, &crate::keepers::place_of(&profile)).await?;
        keepers.push(KeeperBundle { profile, memory, from_graph: String::new() });
    }
    let kit = relocate::export(&client, &state.kit_place()).await?;
    let bundle = Bundle { format: bundle::FORMAT.into(), made_at: time::now_iso(), app: env!("CARGO_PKG_VERSION").into(), keepers, kit };
    let (count, records) = (bundle.keepers.len(), bundle.records());
    let plain = serde_json::to_vec(&bundle)?;
    // The key is derived slowly on purpose: off the async threads.
    let sealed = tauri::async_runtime::spawn_blocking(move || seal::seal(&passphrase, &plain)).await.map_err(|_| DeskError::Io("The backup was interrupted.".into()))??;
    let path = file_path(&time::now_iso());
    crate::kernel::paths::write_private(&path, &sealed)?;
    crate::platform::reveal(&path);
    Ok(Saved { path: path.display().to_string(), keepers: count, records })
}

/// `Keeper backup 2026-11-26.keeperbackup` in Downloads (a second one the same day is numbered).
fn file_path(now_iso: &str) -> std::path::PathBuf {
    let dir = dirs::download_dir().or_else(dirs::home_dir).unwrap_or_default();
    let day = now_iso.get(..10).unwrap_or("today");
    (1..100).map(|n| dir.join(if n == 1 { format!("Keeper backup {day}.keeperbackup") } else { format!("Keeper backup {day} ({n}).keeperbackup") })).find(|p| !p.exists()).unwrap_or_else(|| dir.join(format!("Keeper backup {day}.keeperbackup")))
}

/// Bring a backup in: `data` is the file's bytes in base64. Every keeper in it is added (one
/// that is already here, by id, has its memory merged and keeps its place); nothing here is
/// removed or overwritten. Nothing is written unless the whole file opens and passes its checks.
#[tauri::command]
pub async fn backup_restore(state: State<'_, AppState>, passphrase: String, data: String) -> Result<Restored> {
    // A backup can bring in keepers, souls and memory made elsewhere: a grown-up's decision.
    if crate::kernel::child_lock::on() {
        return Err(DeskError::Invalid("Bringing in a backup is switched off on a child profile.".into()));
    }
    if data.len() > MAX_FILE_BYTES {
        return Err(DeskError::Invalid("That file is too big to be a Keeper backup.".into()));
    }
    let sealed = base64::engine::general_purpose::STANDARD.decode(data.trim()).map_err(|_| DeskError::Invalid("That file isn't a Keeper backup.".into()))?;
    let plain = tauri::async_runtime::spawn_blocking(move || seal::open(&passphrase, &sealed)).await.map_err(|_| DeskError::Io("The restore was interrupted.".into()))??;
    let bundle = bundle::read(&plain)?;
    let here = state.settings().keepers;
    let new_keepers = bundle.keepers.iter().filter(|k| !here.iter().any(|h| h.id == k.profile.id)).count();
    if here.len() + new_keepers > bundle::MAX_KEEPERS {
        return Err(DeskError::Invalid(format!("Bringing this backup in would make more than {} keepers. Remove one first.", bundle::MAX_KEEPERS)));
    }
    let client = state.client()?;
    let home = crate::keepers::graph_id_for("", true);
    client.ensure_graph(&home, "Keeper: your keepers' memory and kit").await?;

    // The kit first: a restored keeper's soul and wardrobe must be there before it is.
    let mut totals = relocate::import(&client, &state.kit_place(), &bundle.kit).await?;
    must_verify(&totals, "the kit")?;
    state.refresh_souls().await;

    let mut names = Vec::new();
    for KeeperBundle { profile, memory, from_graph } in bundle.keepers {
        let profile = placed(profile, &from_graph, &bundle.made_at, &home, &state);
        let report = relocate::import(&client, &crate::keepers::place_of(&profile), &memory).await?;
        must_verify(&report, &profile.name)?;
        totals.copied += report.copied;
        totals.already += report.already;
        names.push(profile.name.clone());
        // Only now, with its memory in place, does the keeper appear.
        state.update_settings(|s| match s.keeper_mut(&profile.id) {
            Some(_) => {}
            None => s.keepers.push(profile.clone()),
        })?;
    }
    crate::memory::hot::clear();
    state.refresh_voice_names();
    Ok(Restored { keepers: names, written: totals.copied, already: totals.already })
}

fn must_verify(report: &relocate::MoveReport, what: &str) -> Result<()> {
    if report.verified {
        Ok(())
    } else {
        Err(DeskError::Io(format!("I couldn't bring in all of {what} ({} of {} records). Nothing was removed; try again.", report.copied + report.already, report.listed)))
    }
}

/// Where a restored keeper lives on THIS computer. The SAME keeper coming back (same id, and the
/// backup was made from this computer's own home graph) keeps its place and profile, and its
/// memory is merged back in. A keeper from another computer whose id is taken here (every
/// install's first keeper is keeper-1) becomes a NEW keeper, under an id made from the backup and
/// its old id, so it never merges into a different keeper and restoring the same file twice still
/// lands in the same place (review finding). A soul this computer does not have becomes the default.
fn placed(profile: KeeperProfile, from_graph: &str, made_at: &str, home: &str, state: &AppState) -> KeeperProfile {
    let settings = state.settings();
    let profile = match settings.keeper(&profile.id).cloned() {
        Some(existing) if same_keeper(from_graph, home) => return existing,
        Some(_) => {
            let id = moved_id(&profile.id, made_at);
            if let Some(already) = settings.keeper(&id).cloned() {
                return already;
            }
            let name = if settings.keepers.iter().any(|k| k.name.eq_ignore_ascii_case(&profile.name)) { restored_name(&profile.name) } else { profile.name.clone() };
            KeeperProfile { id, name, ..profile }
        }
        None => profile,
    };
    let soul = if state.soul_known(&profile.soul).is_some() { profile.soul.clone() } else { KeeperProfile::default().soul };
    KeeperProfile { graph_id: home.to_string(), memory_sub: Some(relocate::keeper_sub(&profile.id)), legacy_graph: None, soul, ..profile }
}

/// The backup's keeper was kept in this computer's own home graph.
fn same_keeper(from_graph: &str, home: &str) -> bool {
    !from_graph.is_empty() && from_graph == home
}

/// The id a keeper from another computer gets here when its own id is taken.
fn moved_id(id: &str, made_at: &str) -> String {
    format!("keeper-{}", crate::kernel::slug::short_hash(&format!("{made_at}\u{0}{id}"), 10))
}

/// "Trini Boi" → "Trini Boi 2", kept to the 24 characters a keeper name may have.
fn restored_name(name: &str) -> String {
    let base: String = name.chars().take(22).collect();
    format!("{} 2", base.trim())
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::{node, DkgClient, Layer, Place};

    /// The real node: records are exported, sealed, opened and restored into another graph's
    /// sub-graph under their own names; a second restore writes nothing.
    /// `cargo test --lib live_backup -- --ignored --nocapture` (writes only to `umoja-desk-backuptest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_backup_round_trip_restores_every_record_once() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let stamp = chrono::Utc::now().timestamp_millis();
        let (src, home) = (format!("umoja-desk-backuptest-src-{stamp}"), format!("umoja-desk-backuptest-home-{stamp}"));
        client.ensure_graph(&src, "backup test source").await.unwrap();
        client.ensure_graph(&home, "backup test home").await.unwrap();
        for i in 0..3 {
            let quads = crate::dkg::AssetBuilder::new(&format!("urn:umoja:desk:fact:bk{i}")).a("https://umojaark.com/ns/desk#Fact").text("https://umojaark.com/ns/desk#text", &format!("fact \"{i}\" with a quote")).build();
            client.write_asset(src.as_str(), &format!("desk-fact-bk{i}"), &quads).await.unwrap();
        }
        let memory = relocate::export(&client, &Place::from(src.as_str())).await.unwrap();
        assert_eq!(memory.len(), 3);
        let profile = KeeperProfile { id: "keeper-bk".into(), name: "Backup Test".into(), ..KeeperProfile::default() };
        let saved = Bundle { format: bundle::FORMAT.into(), made_at: time::now_iso(), app: "test".into(), keepers: vec![KeeperBundle { profile, memory, from_graph: String::new() }], kit: vec![] };
        let sealed = seal::seal("a passphrase for the test", &serde_json::to_vec(&saved).unwrap()).unwrap();
        let back = bundle::read(&seal::open("a passphrase for the test", &sealed).unwrap()).unwrap();
        let to = Place::new(&home, Some("keeper-bk"));
        let first = relocate::import(&client, &to, &back.keepers[0].memory).await.unwrap();
        assert_eq!((first.copied, first.verified), (3, true), "{first:?}");
        let again = relocate::import(&client, &to, &back.keepers[0].memory).await.unwrap();
        assert_eq!((again.copied, again.already, again.verified), (0, 3, true), "{again:?}");
        let rows = client.query(&to, "SELECT ?t WHERE { ?s <https://umojaark.com/ns/desk#text> ?t } LIMIT 10", Layer::Working).await.unwrap();
        println!("restored: {rows:?} · file {} bytes", sealed.len());
        assert_eq!(rows.len(), 3, "readable where it was restored");
        assert!(rows.iter().any(|r| format!("{r:?}").contains("with a quote")), "text survives exactly");
        client.discard(&to, "desk-fact-bk0").await.unwrap();
        let rows = client.query(&to, "SELECT ?t WHERE { ?s <https://umojaark.com/ns/desk#text> ?t } LIMIT 10", Layer::Working).await.unwrap();
        assert_eq!(rows.len(), 2, "a restored record is still erasable by its name");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_keeper_from_another_computer_never_merges_into_this_ones() {
        assert!(super::same_keeper("umoja-desk-abc", "umoja-desk-abc"));
        assert!(!super::same_keeper("umoja-desk-other", "umoja-desk-abc"));
        assert!(!super::same_keeper("", "umoja-desk-abc"), "unknown origin is never taken as the same keeper");
        let a = super::moved_id("keeper-1", "2026-11-26T10:00:00Z");
        assert_ne!(a, "keeper-1");
        assert_eq!(a, super::moved_id("keeper-1", "2026-11-26T10:00:00Z"), "the same backup lands in the same place twice");
        assert_eq!(crate::memory::relocate::keeper_sub(&a), a, "a valid sub-graph name");
        assert_eq!(super::restored_name("Trini Boi"), "Trini Boi 2");
        assert!(crate::keepers::valid_name(&super::restored_name(&"x".repeat(24))));
    }

    #[test]
    fn a_backup_is_named_for_its_day() {
        let path = super::file_path("2026-11-26T10:00:00Z");
        assert!(path.file_name().unwrap().to_string_lossy().starts_with("Keeper backup 2026-11-26"));
        assert_eq!(path.extension().unwrap(), "keeperbackup");
    }
}
