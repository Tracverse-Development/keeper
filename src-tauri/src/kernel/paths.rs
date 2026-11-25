//! Where Umoja Desk keeps its own small files (settings, the write outbox).
//! The knowledge itself lives on the DKG node, never here.

use std::path::PathBuf;

/// `~/Library/Application Support/Umoja Desk` on macOS (the platform data dir elsewhere).
/// `UMOJA_DESK_HOME` overrides it, which is how tests stay out of the real home.
pub fn app_home() -> PathBuf {
    if let Ok(dir) = std::env::var("UMOJA_DESK_HOME") {
        return PathBuf::from(dir);
    }
    dirs::data_dir().unwrap_or_else(std::env::temp_dir).join("Umoja Desk")
}

pub fn settings_file() -> PathBuf {
    app_home().join("settings.json")
}

pub fn outbox_file() -> PathBuf {
    app_home().join("outbox.jsonl")
}

/// The folder a node Umoja Desk installs itself lives in (never the person's existing `~/.dkg`).
pub fn own_node_home() -> PathBuf {
    app_home().join("dkg-node")
}

/// Write a file atomically with owner-only permissions (a temp file renamed into place).
pub fn write_private(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))?;
    }
    std::fs::rename(tmp, path)
}
