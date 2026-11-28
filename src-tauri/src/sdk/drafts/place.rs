//! Which files a keeper may draft an edit of, and reading and writing them safely.
//!
//! A file is editable when it is a real, ordinary file (links resolved; the dropped-file checks
//! of `assistant::attach::check_path`: not Keeper's own, not hidden), inside the person's own
//! places (home or the temporary folder, never a system folder), not an app's own data
//! (`~/Library`), at most `MAX_BYTES`, and plain text (UTF-8, no NUL bytes).

use std::io::Write;
use std::path::{Path, PathBuf};

use crate::kernel::{DeskError, Result};

/// The largest file a draft holds (256 KB).
pub const MAX_BYTES: usize = 256 * 1024;

/// The real path of a file the keeper may edit, or why not, in plain words.
pub fn editable(path: &str) -> Result<PathBuf> {
    let written = crate::stage::open::expand_home(path);
    let real = crate::assistant::attach::check_path(&written.to_string_lossy())?;
    if !crate::kernel::paths::in_persons_places(&real) {
        return Err(DeskError::Invalid("I only edit files in your home folder or the temporary folder.".into()));
    }
    if app_data(&real) {
        return Err(DeskError::Invalid("That file belongs to an app's own data, so I won't edit it.".into()));
    }
    Ok(real)
}

/// Inside `~/Library` (apps' settings, mail, caches).
fn app_data(real: &Path) -> bool {
    dirs::home_dir().and_then(|h| h.join("Library").canonicalize().ok()).is_some_and(|lib| real.starts_with(lib))
}

/// The whole text of an editable file (already checked by `editable`).
pub fn read_text(real: &Path) -> Result<String> {
    let bytes = std::fs::read(real).map_err(|_| DeskError::Invalid("I couldn't read that file.".into()))?;
    if bytes.len() > MAX_BYTES {
        return Err(too_big());
    }
    if bytes.contains(&0) {
        return Err(not_text());
    }
    String::from_utf8(bytes).map_err(|_| not_text())
}

/// Text that fits a draft, or the plain sentence why not.
pub fn fits(text: &str) -> Result<()> {
    if text.len() > MAX_BYTES {
        return Err(too_big());
    }
    if text.contains('\0') {
        return Err(not_text());
    }
    Ok(())
}

fn too_big() -> DeskError {
    DeskError::Invalid("That file is too big for me to edit here (the limit is 256 KB).".into())
}

fn not_text() -> DeskError {
    DeskError::Invalid("That isn't a plain text file, so I can't edit it here.".into())
}

/// Puts `text` in place of the file at `real` in one step: written beside it under a temporary
/// name (made fresh, never through an existing link), given the file's permissions, then renamed
/// over it, so the file is either all old or all new.
pub fn write_atomically(real: &Path, text: &str) -> Result<()> {
    let name = real.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let temp = real.with_file_name(format!(".{name}.keeper-saving"));
    // A leftover from a save that was cut off: remove it (a link is removed, not followed).
    let _ = std::fs::remove_file(&temp);
    let write = || -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(text.as_bytes())?;
        file.sync_all()?;
        std::fs::set_permissions(&temp, std::fs::metadata(real)?.permissions())?;
        std::fs::rename(&temp, real)
    };
    write().map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        DeskError::Io(format!("I couldn't save the file: {e}"))
    })
}

/// The proposed text written the way the original is: its line endings (`\r\n` or `\n`) and
/// whether it ends with a line break. Minds usually send `\n` and drop or add the last break.
pub fn like_original(original: &str, text: &str) -> String {
    let mut out = text.replace("\r\n", "\n");
    if original.contains("\r\n") {
        out = out.replace('\n', "\r\n");
    }
    let br = if original.contains("\r\n") { "\r\n" } else { "\n" };
    match (original.ends_with('\n'), out.ends_with('\n')) {
        (true, false) if !out.is_empty() => out.push_str(br),
        (false, true) if !original.is_empty() => {
            out.truncate(out.len() - br.len().min(out.len()));
        }
        _ => {}
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bench(name: &str, body: &[u8]) -> PathBuf {
        let dir = PathBuf::from("/tmp/keeper-drafts-place-test");
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join(name);
        std::fs::write(&p, body).unwrap();
        p
    }

    #[test]
    fn only_plain_text_files_in_the_persons_places() {
        let notes = bench("notes.txt", b"hello\n");
        assert!(editable(&notes.to_string_lossy()).is_ok());
        assert!(editable("/etc/hosts").is_err(), "a system file");
        assert!(editable("/tmp/keeper-drafts-place-test").is_err(), "a folder");
        assert!(editable("/tmp/keeper-drafts-place-test/missing.txt").is_err(), "must exist");
        let binary = bench("picture.bin", b"\x89PNG\0\0\x01");
        assert_eq!(read_text(&editable(&binary.to_string_lossy()).unwrap()).unwrap_err().to_string(), not_text().to_string());
        let big = bench("big.txt", &vec![b'a'; MAX_BYTES + 1]);
        assert_eq!(read_text(&big).unwrap_err().to_string(), too_big().to_string());
        assert!(fits(&"a".repeat(MAX_BYTES + 1)).is_err() && fits("fine").is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn a_link_cannot_lead_into_a_system_folder_or_a_hidden_one() {
        let dir = PathBuf::from("/tmp/keeper-drafts-place-test");
        std::fs::create_dir_all(&dir).unwrap();
        let link = dir.join("hosts-link.txt");
        let _ = std::fs::remove_file(&link);
        std::os::unix::fs::symlink("/etc/hosts", &link).unwrap();
        assert!(editable(&link.to_string_lossy()).is_err(), "the link resolves to /etc/hosts");
        let hidden = dir.join(".secret");
        std::fs::create_dir_all(&hidden).unwrap();
        std::fs::write(hidden.join("keys.txt"), "x").unwrap();
        assert!(editable(&hidden.join("keys.txt").to_string_lossy()).is_err(), "inside a hidden folder");
    }

    #[test]
    fn a_save_replaces_the_file_whole_and_keeps_its_permissions() {
        let p = bench("save.txt", b"old\n");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o640)).unwrap();
        }
        write_atomically(&p, "new\n").unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "new\n");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&p).unwrap().permissions().mode() & 0o777, 0o640);
        }
        assert!(!p.with_file_name(".save.txt.keeper-saving").exists(), "no temporary file is left");
    }

    #[test]
    fn the_draft_is_written_the_way_the_original_is() {
        assert_eq!(like_original("a\r\nb\r\n", "a\nB"), "a\r\nB\r\n");
        assert_eq!(like_original("a\nb\n", "a\nB"), "a\nB\n");
        assert_eq!(like_original("a\nb", "a\nB\n"), "a\nB");
        assert_eq!(like_original("", "new\n"), "new\n", "an empty file takes the text as it is");
    }
}
