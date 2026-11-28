//! Opening what a panel shows: a web page (in the browser) or a file the keeper made (open it,
//! or show it in the Finder). Checked here, whatever the panel said: only http(s) addresses, and
//! only files that exist inside the person's home folder.

use std::path::PathBuf;

use crate::kernel::{DeskError, Result};

/// A file or folder a panel (or an ability) names, as a real path inside the person's home (or
/// None): "~", "~/Documents/a.pdf", "Documents/a.pdf" (from home) or a full path. It must exist,
/// and links are followed before the check, so nothing climbs or links out of the home folder.
pub fn home_file(path: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let p = path.trim();
    let full = if p == "~" {
        home.clone()
    } else if let Some(rest) = p.strip_prefix("~/") {
        home.join(rest)
    } else if p.starts_with('/') {
        PathBuf::from(p)
    } else {
        home.join(p)
    };
    let real = full.canonicalize().ok()?;
    real.starts_with(&home).then_some(real)
}

/// `how`: "open" (a page in the browser, or a file in its app) or "reveal" (a file in the Finder).
#[tauri::command]
pub fn stage_open(target: String, how: String) -> Result<()> {
    if super::cap::web_address(&target) {
        return crate::platform::open_url(target.trim());
    }
    let file = home_file(&target).ok_or_else(|| DeskError::Invalid("That file isn't in your home folder, or it no longer exists.".into()))?;
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
    fn only_real_files_in_the_home_folder() {
        assert!(super::home_file("/etc/hosts").is_none(), "outside home");
        assert!(super::home_file("~/../../etc/hosts").is_none(), "no climbing out");
        assert!(super::home_file("~/definitely-not-here-123.txt").is_none(), "must exist");
        assert!(super::home_file("../../etc").is_none(), "no climbing out from a bare name");
        let home = dirs::home_dir().unwrap().canonicalize().unwrap();
        assert_eq!(super::home_file("~"), Some(home.clone()));
        assert_eq!(super::home_file("Library"), Some(home.join("Library")), "a bare name is from home");
    }
}
