//! Keeper's private key store (API keys such as ElevenLabs'): `secrets.json` in the app's own
//! folder, owner-only (0600), written atomically, read once and cached in memory.
//!
//! Why not the macOS Keychain: Keeper is signed without an Apple Developer ID, so macOS knows it
//! only by the exact hash of each build; every update counted as a new app and the Keychain asked
//! again (the founder hit a prompt on every spoken reply, 2026-11-25). This store has the same
//! trust boundary as the person's other per-user app config (FileVault encrypts it at rest), works
//! the same on Windows and Linux, and never prompts. With a Developer ID the Keychain can return.

use std::collections::BTreeMap;
use std::sync::Mutex;

use super::{paths, DeskError, Result};

static CACHE: Mutex<Option<BTreeMap<String, String>>> = Mutex::new(None);

fn file() -> std::path::PathBuf {
    paths::app_home().join("secrets.json")
}

fn with_store<T>(f: impl FnOnce(&mut BTreeMap<String, String>) -> T) -> T {
    let mut guard = CACHE.lock().unwrap_or_else(|p| p.into_inner());
    let store = guard.get_or_insert_with(|| std::fs::read(file()).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default());
    f(store)
}

/// A saved secret, or None.
pub fn get(name: &str) -> Option<String> {
    with_store(|s| s.get(name).cloned()).filter(|v| !v.is_empty())
}

/// Save (or, with an empty value, remove) a secret.
pub fn set(name: &str, value: &str) -> Result<()> {
    with_store(|s| {
        if value.is_empty() {
            s.remove(name);
        } else {
            s.insert(name.to_string(), value.to_string());
        }
        let bytes = serde_json::to_vec_pretty(s).map_err(|e| DeskError::Io(e.to_string()))?;
        paths::write_private(&file(), &bytes).map_err(|_| DeskError::Io("The key could not be saved.".into()))
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn saves_reads_and_removes_privately() {
        let dir = std::env::temp_dir().join(format!("keeper-secrets-{}", std::process::id()));
        std::env::set_var("KEEPER_HOME", &dir);
        super::set("test-key", "abc").unwrap();
        assert_eq!(super::get("test-key").as_deref(), Some("abc"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(dir.join("secrets.json")).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
        super::set("test-key", "").unwrap();
        assert_eq!(super::get("test-key"), None);
        std::fs::remove_dir_all(dir).ok();
    }
}
