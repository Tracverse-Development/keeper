//! Where Keeper keeps its own small files (settings, the write outbox).
//! The knowledge itself lives on the DKG node, never here.

use std::path::PathBuf;

/// `~/Library/Application Support/Keeper` on macOS (the platform data dir elsewhere).
/// `KEEPER_HOME` overrides it, which is how tests stay out of the real home.
pub fn app_home() -> PathBuf {
    if let Ok(dir) = std::env::var("KEEPER_HOME") {
        return PathBuf::from(dir);
    }
    let data = dirs::data_dir().unwrap_or_else(std::env::temp_dir);
    let home = data.join("Keeper");
    // Earlier names of the app (Umoja Desk, then Nia during v0.2): the folder moves over once, settings intact.
    for old in ["Nia", "Umoja Desk"].map(|name| data.join(name)) {
        if !home.exists() && old.is_dir() {
            let _ = std::fs::rename(&old, &home);
        }
    }
    home
}

pub fn settings_file() -> PathBuf {
    app_home().join("settings.json")
}

pub fn outbox_file() -> PathBuf {
    app_home().join("outbox.jsonl")
}

/// The folder a node Keeper installs itself lives in (never the person's existing `~/.dkg`).
pub fn own_node_home() -> PathBuf {
    app_home().join("dkg-node")
}

/// Where Keeper installs engines it sets up for the person (`<app home>/engines`, bins in `bin`).
pub fn engines_home() -> PathBuf {
    app_home().join("engines")
}

/// The program folders Keeper set up itself: its engines' bins and each Node.js it unpacked.
pub fn own_tool_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![engines_home().join("bin")];
    if let Ok(entries) = std::fs::read_dir(own_node_home().join("runtime")) {
        dirs.extend(entries.flatten().map(|e| e.path().join("bin")).filter(|p| p.is_dir()));
    }
    dirs
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

/// Where Keeper keeps the drafts of files a keeper is editing (`<app home>/drafts`).
pub fn drafts_home() -> PathBuf {
    app_home().join("drafts")
}

/// The folders where the person's own files live, as real paths: their home and the temporary
/// folders (`/tmp` and the system's own). A file a keeper opens, shows or edits must be inside one.
pub fn persons_places() -> Vec<PathBuf> {
    let mut places: Vec<PathBuf> = dirs::home_dir().into_iter().collect();
    places.push(PathBuf::from("/tmp"));
    places.push(std::env::temp_dir());
    places.into_iter().filter_map(|p| p.canonicalize().ok()).collect()
}

/// A real (already resolved) path inside one of `persons_places`.
pub fn in_persons_places(real: &std::path::Path) -> bool {
    persons_places().iter().any(|place| real.starts_with(place))
}
