//! Opening what a panel shows: a web page (in the browser) or a file the keeper made (open it,
//! or show it in the Finder). Checked here, whatever the panel said: only http(s) addresses, and
//! only files that exist inside the person's own places (home, the temporary folder).

use std::path::PathBuf;

use crate::kernel::{DeskError, Result};

/// A path as written (`~/…` means the home folder), before any check.
pub fn expand_home(path: &str) -> PathBuf {
    let p = path.trim();
    match (p.strip_prefix("~/"), dirs::home_dir()) {
        (Some(rest), Some(home)) => home.join(rest),
        _ => PathBuf::from(p),
    }
}

/// A file a panel names, as a real path (links resolved) inside the person's own places (or None).
pub fn person_file(path: &str) -> Option<PathBuf> {
    let real = expand_home(path).canonicalize().ok()?;
    crate::kernel::paths::in_persons_places(&real).then_some(real)
}

/// `how`: "open" (a page in the browser, or a file in its app) or "reveal" (a file in the Finder).
#[tauri::command]
pub fn stage_open(target: String, how: String) -> Result<()> {
    if super::cap::web_address(&target) {
        return crate::platform::open_url(target.trim());
    }
    let file = person_file(&target).ok_or_else(|| DeskError::Invalid("That file isn't in your home folder, or it no longer exists.".into()))?;
    if how == "reveal" {
        crate::platform::reveal(&file);
        Ok(())
    } else {
        crate::platform::open_url(&file.display().to_string())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_real_files_in_the_persons_places() {
        assert!(super::person_file("/etc/hosts").is_none(), "outside home");
        assert!(super::person_file("~/../../etc/hosts").is_none(), "no climbing out");
        assert!(super::person_file("~/definitely-not-here-123.txt").is_none(), "must exist");
        let tmp = std::path::Path::new("/tmp/keeper-open-test.txt");
        std::fs::write(tmp, "hi").unwrap();
        assert!(super::person_file("/tmp/keeper-open-test.txt").is_some(), "the temporary folder is the person's too");
        let _ = std::fs::remove_file(tmp);
    }
}
