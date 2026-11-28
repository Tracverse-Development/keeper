//! Keeper's own file viewer: the person's folders and files shown INSIDE Keeper, beside the
//! keeper (the window's `files/` pane), instead of sending them to the Finder.
//!
//!   list(path)      a folder's entries, newest first (`MAX_ENTRIES`), hidden ones left out
//!   preview(path)   what a file looks like: a picture, a playable video or song, a text file's
//!                   words (editable through the drafts, saved only by the person), a document's
//!                   Quick Look picture and its words, or its size (`preview`)
//!
//! Only the person's own places (`stage::open::person_file`), never a hidden path or Keeper's own
//! folders (`assistant::attach::private_to_keeper`): the same lines the keeper reads by.
//! Abilities open it with `show(app, path)` (`files://show`).

pub mod commands;
mod preview;

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Emitter;

use crate::kernel::{DeskError, Result};

pub use preview::Preview;

/// The most entries one folder view lists.
pub const MAX_ENTRIES: usize = 300;

/// One entry of a folder.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    /// The full path, for the window to open it next.
    pub path: String,
    pub folder: bool,
    pub size: u64,
    /// RFC 3339, UTC.
    pub modified: String,
}

/// A folder as the window shows it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    /// The real path.
    pub path: String,
    /// The path as a person reads it ("~/Documents/Taxes").
    pub shown: String,
    /// The folder above, while it is still inside the home folder.
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
    /// Entries in all (more than `entries` when cut at `MAX_ENTRIES`).
    pub total: usize,
    /// The file asked for, when a file (not a folder) was asked for: its folder is listed.
    pub selected: Option<String>,
}

/// A path the viewer may show: real, inside the person's own places, not hidden, not Keeper's.
pub fn place(path: &str) -> Result<PathBuf> {
    let real = crate::stage::open::person_file(path).ok_or_else(|| DeskError::Invalid("That isn't in your home folder, or it no longer exists.".into()))?;
    let home = dirs::home_dir().and_then(|h| h.canonicalize().ok()).unwrap_or_default();
    let inside = real.strip_prefix(&home).unwrap_or(&real);
    if hidden(inside) || inside.starts_with("Library") {
        return Err(DeskError::Invalid("That's a hidden or system folder, so I leave it alone.".into()));
    }
    if crate::assistant::attach::private_to_keeper(&real) {
        return Err(DeskError::Invalid("That's part of Keeper itself.".into()));
    }
    Ok(real)
}

fn hidden(path: &Path) -> bool {
    path.components().any(|c| matches!(c, std::path::Component::Normal(p) if p.to_string_lossy().starts_with('.')))
}

/// "~/Documents" for a path in the home folder.
pub fn shown(path: &Path) -> String {
    match dirs::home_dir().and_then(|h| h.canonicalize().ok()).and_then(|h| path.strip_prefix(&h).ok().map(Path::to_path_buf)) {
        Some(rest) if rest.as_os_str().is_empty() => "~".into(),
        Some(rest) => format!("~/{}", rest.display()),
        None => path.display().to_string(),
    }
}

/// The folder's entries, newest first (for a file: its folder's, with the file `selected`).
pub fn list(path: &str) -> Result<Listing> {
    let asked = place(path)?;
    let (real, selected) = if asked.is_dir() { (asked, None) } else { (asked.parent().map(Path::to_path_buf).unwrap_or_default(), Some(asked.display().to_string())) };
    place(&real.display().to_string())?;
    let mut entries: Vec<Entry> = std::fs::read_dir(&real)
        .map_err(|_| DeskError::Invalid("I'm not allowed to look in that folder.".into()))?
        .flatten()
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok().map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()).unwrap_or_default();
            Some(Entry { name: e.file_name().to_string_lossy().into_owned(), path: e.path().display().to_string(), folder: meta.is_dir(), size: meta.len(), modified })
        })
        .collect();
    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    let total = entries.len();
    entries.truncate(MAX_ENTRIES);
    let parent = real.parent().filter(|p| place(&p.display().to_string()).is_ok()).map(|p| p.display().to_string());
    Ok(Listing { shown: shown(&real), path: real.display().to_string(), parent, entries, total, selected })
}

/// Opens the viewer in the window at `path` (a folder, or a file shown in its folder).
pub fn show(app: &tauri::AppHandle, path: &Path) {
    let _ = app.emit(crate::kernel::events::FILES_SHOW, serde_json::json!({ "path": path.display().to_string() }));
}

#[cfg(test)]
mod tests {
    #[test]
    fn hidden_and_library_paths_are_left_alone() {
        assert!(super::hidden(std::path::Path::new(".ssh/id_rsa")));
        assert!(super::hidden(std::path::Path::new("Documents/.git/config")));
        assert!(!super::hidden(std::path::Path::new("Documents/Taxes/2025.pdf")));
        let home = dirs::home_dir().unwrap();
        assert!(super::place(&home.join("Library").display().to_string()).is_err());
        assert!(super::place("/etc").is_err(), "outside the home folder");
    }

    #[test]
    fn a_folder_lists_newest_first_without_hidden_entries() {
        let dir = dirs::home_dir().unwrap().join(format!("keeper-explorer-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        std::fs::write(dir.join(".hidden"), "x").unwrap();
        let listing = super::list(&dir.display().to_string());
        std::fs::remove_dir_all(&dir).unwrap();
        let listing = listing.unwrap();
        assert_eq!(listing.total, 2);
        assert!(listing.entries.iter().any(|e| e.name == "sub" && e.folder));
        assert!(listing.shown.starts_with("~/keeper-explorer-test-"));
        assert!(listing.parent.is_some());
    }

    #[test]
    fn a_file_lists_its_folder_with_the_file_selected() {
        let dir = dirs::home_dir().unwrap().join(format!("keeper-explorer-file-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        let listing = super::list(&dir.join("a.txt").display().to_string());
        std::fs::remove_dir_all(&dir).unwrap();
        let listing = listing.unwrap();
        assert!(listing.selected.unwrap().ends_with("a.txt"));
        assert_eq!(listing.entries.len(), 1);
    }
}
