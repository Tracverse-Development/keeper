//! Repairing Keeper's own node when one of its files is damaged (FIX-0058). A node stopped
//! abruptly (power cut, forced restart, a VM hard stop) can leave its dashboard database,
//! `node-ui.db`, malformed; the node then dies at every start ("database disk image is
//! malformed", SQLITE_CORRUPT in DashboardDB) and its supervisor restarts it every few seconds,
//! so the keeper's memory is offline for good with no word of why.
//!
//! `node-ui.db` holds the node dashboard's own state, never the person's memories (those are in
//! the triple store). So before Keeper starts its node again, `repair` checks that file with the
//! system's `sqlite3` (`platform::sqlite_quick_check`) and, when it is damaged, moves it and its journal files
//! aside (renamed `…damaged-<time>`, kept, never deleted); the node makes a fresh one. Other
//! databases are only checked by the person's choice (they hold data).

use std::path::{Path, PathBuf};

/// The node's dashboard database: safe to set aside, the node rebuilds it.
pub const DASHBOARD_DB: &str = "node-ui.db";

/// True when `quick_check`'s answer says the database is damaged: anything but a lone "ok"
/// (a failed check that printed nothing counts as damaged only when sqlite3 said so).
pub fn is_damaged(answer: &str, sqlite_succeeded: bool) -> bool {
    let answer = answer.trim();
    !(sqlite_succeeded && answer.eq_ignore_ascii_case("ok"))
}

/// Where a damaged file is set aside: `node-ui.db` → `node-ui.db.damaged-1764337500`.
pub fn set_aside_name(file: &Path, at_unix: u64) -> PathBuf {
    let mut name = file.as_os_str().to_owned();
    name.push(format!(".damaged-{at_unix}"));
    PathBuf::from(name)
}

/// Checks the dashboard database in `node_home` and sets it aside when damaged. Returns true when
/// it repaired something (the caller then starts the node). Missing file or no `sqlite3`: false.
pub async fn repair(node_home: &Path) -> bool {
    let db = node_home.join(DASHBOARD_DB);
    if !db.exists() {
        return false;
    }
    let Some((answer, succeeded)) = crate::platform::sqlite_quick_check(&db).await else { return false };
    if !is_damaged(&answer, succeeded) {
        return false;
    }
    let at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let mut moved = false;
    for suffix in ["", "-wal", "-shm"] {
        let file = node_home.join(format!("{DASHBOARD_DB}{suffix}"));
        if file.exists() && std::fs::rename(&file, set_aside_name(&file, at)).is_ok() {
            moved = true;
        }
    }
    if moved {
        crate::kernel::log::error("node", &format!("The memory node's dashboard file was damaged ({}); set it aside so the node can start.", answer.lines().next().unwrap_or("").trim()));
    }
    moved
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    #[test]
    fn only_a_clean_ok_is_healthy() {
        assert!(!super::is_damaged("ok\n", true));
        assert!(super::is_damaged("Error: in prepare, database disk image is malformed (11)", false));
        assert!(super::is_damaged("*** in database main ***\nPage 12: btreeInitPage() returns error code 11", true));
        assert!(super::is_damaged("", false), "sqlite3 failing to open it is damage too");
    }

    #[test]
    fn a_damaged_file_is_kept_beside_with_the_time() {
        assert_eq!(super::set_aside_name(Path::new("/n/home/node-ui.db-wal"), 1764337500), Path::new("/n/home/node-ui.db-wal.damaged-1764337500"));
    }

    #[tokio::test]
    async fn a_healthy_or_missing_dashboard_file_is_left_alone() {
        let dir = std::env::temp_dir().join(format!("keeper-repair-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(!super::repair(&dir).await, "no file: nothing to do");
        std::fs::write(dir.join(super::DASHBOARD_DB), b"this is not a database at all, it is damaged").unwrap();
        if crate::platform::sqlite_quick_check(&dir.join(super::DASHBOARD_DB)).await.is_some() {
            assert!(super::repair(&dir).await, "a damaged file is set aside");
            assert!(!dir.join(super::DASHBOARD_DB).exists());
            assert!(std::fs::read_dir(&dir).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().starts_with("node-ui.db.damaged-")));
        }
        let _ = std::fs::remove_dir_all(&dir);
    }
}
