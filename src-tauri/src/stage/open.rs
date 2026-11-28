//! Opening what a panel shows: a web page (in the browser) or a file the keeper made (open it,
//! or show it in the Finder). Checked here, whatever the panel said: only http(s) addresses, and
//! only files that exist inside the person's own places (home, the temporary folder).

use std::path::PathBuf;

use crate::kernel::{DeskError, Result};

/// A path as written, before any check: "~" is the home folder, "~/…" and a bare name
/// ("Documents/a.pdf") are inside it, and a full path stays as it is.
pub fn expand_home(path: &str) -> PathBuf {
    let p = path.trim();
    let Some(home) = dirs::home_dir() else { return PathBuf::from(p) };
    if p == "~" {
        home
    } else if let Some(rest) = p.strip_prefix("~/") {
        home.join(rest)
    } else if p.starts_with('/') {
        PathBuf::from(p)
    } else {
        home.join(p)
    }
}

/// A file or folder a panel (or an ability) names, as a real path inside the person's own places
/// (home, the temporary folder), or None. It must exist, and links are followed before the
/// check, so nothing climbs or links out.
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
        assert!(super::person_file("../../etc").is_none(), "no climbing out from a bare name");
        let home = dirs::home_dir().unwrap().canonicalize().unwrap();
        assert_eq!(super::person_file("~"), Some(home.clone()));
        assert_eq!(super::person_file("Library"), Some(home.join("Library")), "a bare name is from home");
        let tmp = std::path::Path::new("/tmp/keeper-open-test.txt");
        std::fs::write(tmp, "hi").unwrap();
        assert!(super::person_file("/tmp/keeper-open-test.txt").is_some(), "the temporary folder is the person's too");
        let _ = std::fs::remove_file(tmp);
    }
}
