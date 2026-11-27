//! The person's Pictures folder: where Keeper's photo mode saves its stills
//! (`keepers::photo_commands`). OS-neutral: `dirs` names the folder on every system
//! (~/Pictures on macOS and Linux, the user's Pictures on Windows).
//!
//! A file is never overwritten: each save opens a NEW file (`create_new`, which the system
//! refuses when the name exists, so two saves in the same second cannot race onto one name)
//! and adds `-2`, `-3`, ... until a name is free. The stem is the caller's to make safe; this
//! only refuses one that could leave the folder.

use std::io::Write;
use std::path::{Path, PathBuf};

use crate::kernel::{DeskError, Result};

/// The folder inside Pictures that Keeper writes to.
pub const PICTURES_FOLDER: &str = "Keeper";
/// How many numbered names are tried before giving up.
const MAX_SUFFIX: u32 = 999;

/// `~/Pictures/Keeper` (or `~/Pictures` under the home folder when the system names none).
pub fn keeper_pictures_dir() -> Result<PathBuf> {
    let pictures = dirs::picture_dir().or_else(|| dirs::home_dir().map(|h| h.join("Pictures"))).ok_or_else(|| DeskError::Io("I couldn't find your Pictures folder.".into()))?;
    Ok(pictures.join(PICTURES_FOLDER))
}

/// Write `bytes` as `<stem>.png` in `~/Pictures/Keeper` (made when missing), numbered when that
/// name is taken. Returns the path written.
pub fn save_png(stem: &str, bytes: &[u8]) -> Result<PathBuf> {
    write_new(&keeper_pictures_dir()?, stem, "png", bytes)
}

/// Write `bytes` to a new `<stem>.<ext>` in `dir` (created when missing), never over an existing
/// file: `<stem>-2.<ext>`, `<stem>-3.<ext>`, ... until one is free.
pub fn write_new(dir: &Path, stem: &str, ext: &str, bytes: &[u8]) -> Result<PathBuf> {
    let leaves = |s: &str| s.is_empty() || s.contains(['/', '\\', '\0']) || s.starts_with('.');
    if leaves(stem) || leaves(ext) {
        return Err(DeskError::Invalid("That isn't a file name I can use.".into()));
    }
    std::fs::create_dir_all(dir)?;
    for n in 1..=MAX_SUFFIX {
        let name = if n == 1 { format!("{stem}.{ext}") } else { format!("{stem}-{n}.{ext}") };
        let path = dir.join(name);
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(bytes).and_then(|_| file.sync_all()) {
                    // Never leave half a picture behind.
                    drop(file);
                    let _ = std::fs::remove_file(&path);
                    return Err(e.into());
                }
                return Ok(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.into()),
        }
    }
    Err(DeskError::Io("There are too many pictures with that name already.".into()))
}

#[cfg(test)]
mod tests {
    use super::write_new;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("keeper-pictures-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn makes_the_folder_and_never_overwrites() {
        let dir = scratch("never-overwrites").join("Keeper");
        let first = write_new(&dir, "Malik-2026-11-27-143005", "png", b"one").unwrap();
        let second = write_new(&dir, "Malik-2026-11-27-143005", "png", b"two").unwrap();
        let third = write_new(&dir, "Malik-2026-11-27-143005", "png", b"three").unwrap();
        assert_eq!(first, dir.join("Malik-2026-11-27-143005.png"));
        assert_eq!(second, dir.join("Malik-2026-11-27-143005-2.png"));
        assert_eq!(third, dir.join("Malik-2026-11-27-143005-3.png"));
        assert_eq!(std::fs::read(&first).unwrap(), b"one");
        assert_eq!(std::fs::read(&second).unwrap(), b"two");
        let _ = std::fs::remove_dir_all(dir.parent().unwrap());
    }

    #[test]
    fn refuses_a_name_that_could_leave_the_folder() {
        let dir = scratch("refuses");
        for stem in ["", "../escape", "a/b", "a\\b", ".hidden", "nul\0"] {
            assert!(write_new(&dir, stem, "png", b"x").is_err(), "{stem:?}");
        }
        assert!(write_new(&dir, "ok", "../png", b"x").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
