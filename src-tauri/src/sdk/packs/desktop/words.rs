//! The whole phrasings that open an app or a website with no mind (`Instant::Also`):
//!
//! - `open-app`      "open Notes", "launch Safari", "start the Calculator app": only an app that
//!                   is installed, so "open the door for me" goes to the mind
//! - `open-website`  "open youtube.com", "go to bbc.co.uk", "visit https://umojaark.com"
//!
//! The files pack owns "open my documents" and the known folders, and `computer/open` owns
//! "open Wi-Fi settings": the desktop pack comes first in the registry, so its words step aside
//! for those (the instant table pins it).

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant;
use super::{normalise_url, valid_app_name};

const OPEN_APP: &str = r"(?i)^(?:please\s+)?(?:open|launch|start)\s+(?:up\s+)?(?:the\s+)?(.{2,40}?)(?:\s+app)?\s*[.!]?$";
const OPEN_SITE: &str = r"(?i)^(?:please\s+)?(?:open|go to|visit|take me to)\s+(?:the\s+)?(?:website\s+|site\s+)?(\S{3,200})\s*[.!]?$";

/// Endings that make a name with a dot a file, not a website ("open notes.txt").
const FILE_ENDINGS: &[&str] = &["txt", "md", "pdf", "doc", "docx", "rtf", "pages", "key", "numbers", "csv", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg", "gif", "heic", "mp3", "mp4", "mov", "m4a", "wav", "zip", "dmg", "pkg", "app", "html", "json", "js", "ts", "rs", "py", "sh"];

/// `{"name"}` for "open Notes" when an app by that name is installed (and the words are not
/// a folder, a Settings pane or a website, which other abilities own).
pub fn app_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, OPEN_APP).captures(said.trim())?;
    let name = instant::clean(&c[1]);
    let lower = name.to_lowercase();
    let someone_elses = lower.starts_with("my ") || (lower.ends_with(" settings") && lower != "system settings") || lower.ends_with(" folder") || lower.contains('.');
    let a_folder = super::super::files::find::known(&lower).is_some();
    (!someone_elses && !a_folder && valid_app_name(&name) && crate::platform::app_installed(&name)).then(|| json!({ "name": name }))
}

/// `{"url"}` for "open youtube.com": an http(s) address or a bare domain (never a file name).
pub fn site_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, OPEN_SITE).captures(said.trim())?;
    let raw = c[1].trim_end_matches(['.', '!', ',']);
    let url = normalise_url(raw)?;
    let host = url.split("://").nth(1)?.split(['/', '?', '#', ':']).next()?.to_lowercase();
    let ending = host.rsplit('.').next()?;
    let a_domain = ending.len() >= 2 && ending.chars().all(|ch| ch.is_ascii_alphabetic()) && !FILE_ENDINGS.contains(&ending);
    a_domain.then(|| json!({ "url": raw }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn websites_are_domains_never_files() {
        assert_eq!(site_words("open youtube.com"), Some(json!({ "url": "youtube.com" })));
        assert_eq!(site_words("go to bbc.co.uk."), Some(json!({ "url": "bbc.co.uk" })));
        assert_eq!(site_words("visit https://umojaark.com/start"), Some(json!({ "url": "https://umojaark.com/start" })));
        for not_a_site in ["open notes.txt", "open Notes", "open my documents", "go to bed", "open file:///etc/passwd", "go to 10.0.0.1"] {
            assert_eq!(site_words(not_a_site), None, "{not_a_site}");
        }
    }

    #[test]
    fn only_installed_apps_open_by_their_words() {
        for not_an_app in ["open the door for me", "open my documents", "open home", "open wifi settings", "open youtube.com", "start over", "open the downloads folder"] {
            assert_eq!(app_words(not_an_app), None, "{not_an_app}");
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn apps_every_mac_has_open_by_name() {
        assert_eq!(app_words("open Notes"), Some(json!({ "name": "Notes" })));
        assert_eq!(app_words("launch the Calculator app."), Some(json!({ "name": "Calculator" })));
        assert_eq!(app_words("open system settings"), Some(json!({ "name": "system settings" })));
    }
}
