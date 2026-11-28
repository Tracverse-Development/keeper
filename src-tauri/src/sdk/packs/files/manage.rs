//! Keeping the person's files in order, by asking: a new folder, a new name, a move, the Trash.
//! Every path is checked by `explorer::place` (their own places, never hidden, `~/Library` or
//! Keeper's own); nothing is ever written over (a name already taken is refused), the person's
//! main folders (Documents, Desktop…) are never renamed, moved or trashed, and the Trash is the
//! Finder's (Put Back works). Afterwards the folder opens in Keeper's file viewer.
//!
//!   new-folder   "make a folder called Receipts in my documents"
//!   rename-file  {path, name}      move-file {path, to}      trash-file {path}

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::{input, instant, Ability, Access, Cx, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "new-folder",
        how: "{\"name\": \"Receipts\", \"in\": \"~/Documents\"} makes a new folder (in defaults to ~/Documents) and shows it",
        access: Access::Change,
        platforms: MAC, modes: &["assistant"], instant: Instant::Also(new_folder_words),
        run: |input, cx| Box::pin(async move { new_folder(input, cx) }),
    },
    Ability {
        id: "rename-file",
        how: "{\"path\": \"~/Documents/notes.txt\", \"name\": \"Garden notes.txt\"} renames a file or folder in place (never over another)",
        access: Access::Change,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(async move { rename(input, cx) }),
    },
    Ability {
        id: "move-file",
        how: "{\"path\": \"~/Downloads/plan.pdf\", \"to\": \"~/Documents/Garden Club\"} moves a file or folder into another folder (never over another)",
        access: Access::Change,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(async move { move_file(input, cx) }),
    },
    Ability {
        id: "trash-file",
        how: "{\"path\": \"~/Downloads/old.zip\"} moves a file or folder to the Trash (the person can put it back); only when they ask to delete or trash it",
        access: Access::Change,
        platforms: MAC, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(trash(input, cx)),
    },
];

const NEW_FOLDER_ASKS: &str = r"(?i)^(?:please\s+)?(?:make|create|add)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named)\s+(.{1,80}?)(?:\s+(?:in|on)\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|music|movies|home)(?:\s+folder)?)?\s*[.!]?$";

fn new_folder_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, NEW_FOLDER_ASKS).captures(said.trim())?;
    let mut out = json!({ "name": instant::clean(&c[1]) });
    if let Some(place) = c.get(2) {
        out["in"] = json!(super::find::known(place.as_str())?.display().to_string());
    }
    Some(out)
}

/// A name for a file or folder: no slashes, not hidden, not empty, at most 200 characters.
fn valid_name(name: &str) -> Result<&str> {
    let name = name.trim();
    let ok = !name.is_empty() && name.chars().count() <= 200 && !name.contains(['/', ':', '\0']) && !name.starts_with('.');
    ok.then_some(name).ok_or_else(|| DeskError::Invalid("That name won't work for a file (no slashes, colons, or a dot at the start).".into()))
}

/// The person's main folders, and their home: never renamed, moved or trashed.
fn is_main_folder(path: &Path) -> bool {
    let Some(home) = dirs::home_dir().and_then(|h| h.canonicalize().ok()) else { return true };
    path == home || ["Documents", "Desktop", "Downloads", "Pictures", "Music", "Movies", "Public", "Applications"].iter().any(|f| path == home.join(f))
}

/// A path the person names that may be changed: checked, and not a main folder.
fn changeable(said: &str) -> Result<PathBuf> {
    let path = crate::explorer::place(said)?;
    if is_main_folder(&path) {
        return Err(DeskError::Invalid("That's one of your main folders, so I leave it where it is.".into()));
    }
    Ok(path)
}

fn not_taken(path: &Path) -> Result<()> {
    if path.exists() {
        return Err(DeskError::Invalid(format!("There's already something called {} there, so I didn't touch either.", path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default())));
    }
    Ok(())
}

fn shown_in(cx: &Cx<'_>, path: &Path) {
    if cx.at_the_mac {
        crate::explorer::show(cx.app, path);
    }
}

fn new_folder(input: &Value, cx: &Cx<'_>) -> Result<Done> {
    let name = valid_name(input::text(input, "name")?)?;
    let parent = crate::explorer::place(input::optional(input, "in").unwrap_or("~/Documents"))?;
    let folder = parent.join(name);
    not_taken(&folder)?;
    std::fs::create_dir(&folder).map_err(|_| DeskError::Io("I couldn't make that folder there.".into()))?;
    shown_in(cx, &folder);
    Ok(Done::said(format!("Made the folder {name} in {}.", crate::explorer::shown(&parent))))
}

fn rename(input: &Value, cx: &Cx<'_>) -> Result<Done> {
    let path = changeable(input::text(input, "path")?)?;
    let name = valid_name(input::text(input, "name")?)?;
    let target = path.with_file_name(name);
    not_taken(&target)?;
    std::fs::rename(&path, &target).map_err(|_| DeskError::Io("I couldn't rename that.".into()))?;
    shown_in(cx, &target);
    Ok(Done::said(format!("Renamed it to {name}.")))
}

fn move_file(input: &Value, cx: &Cx<'_>) -> Result<Done> {
    let path = changeable(input::text(input, "path")?)?;
    let to = crate::explorer::place(input::text(input, "to")?)?;
    if !to.is_dir() || to.starts_with(&path) {
        return Err(DeskError::Invalid("That isn't a folder I can move it into.".into()));
    }
    let name = path.file_name().ok_or_else(|| DeskError::Invalid("That can't be moved.".into()))?;
    let target = to.join(name);
    not_taken(&target)?;
    std::fs::rename(&path, &target).map_err(|_| DeskError::Io("I couldn't move that (moving between disks isn't something I do yet).".into()))?;
    shown_in(cx, &target);
    Ok(Done::said(format!("Moved {} to {}.", name.to_string_lossy(), crate::explorer::shown(&to))))
}

async fn trash(input: &Value, cx: &Cx<'_>) -> Result<Done> {
    let path = changeable(input::text(input, "path")?)?;
    crate::platform::move_to_trash(&path).await?;
    if let Some(parent) = path.parent() {
        shown_in(cx, parent);
    }
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(Done::said(format!("Moved {name} to the Trash. It's there if you want it back.")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_new_folder_by_its_words() {
        assert_eq!(new_folder_words("make a folder called Receipts").unwrap()["name"], "Receipts");
        let v = new_folder_words("Create a new folder named Garden 2027 on my desktop.").unwrap();
        assert_eq!(v["name"], "Garden 2027");
        assert!(v["in"].as_str().unwrap().ends_with("Desktop"));
        assert!(new_folder_words("make a folder").is_none());
    }

    #[test]
    fn names_never_climb_or_hide() {
        assert!(valid_name("Garden notes.txt").is_ok());
        for bad in ["", "../x", "a/b", ".hidden", "a:b"] {
            assert!(valid_name(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn main_folders_stay_put() {
        let home = dirs::home_dir().unwrap().canonicalize().unwrap();
        assert!(is_main_folder(&home));
        assert!(is_main_folder(&home.join("Documents")));
        assert!(!is_main_folder(&home.join("Documents/Garden Club")));
    }

    #[test]
    fn nothing_is_written_over() {
        let dir = dirs::home_dir().unwrap().join(format!("keeper-manage-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.txt"), "a").unwrap();
        let taken = not_taken(&dir.join("a.txt"));
        let free = not_taken(&dir.join("b.txt"));
        std::fs::remove_dir_all(&dir).unwrap();
        assert!(taken.is_err());
        assert!(free.is_ok());
    }
}
