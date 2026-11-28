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

const OPEN_APP: &str = r"(?i)^(?:please\s+)?(?:open|launch|start|switch\s+to|bring\s+up)\s+(?:up\s+)?(?:the\s+)?(.{2,40}?)(?:\s+app)?\s*[.!]?$";
const OPEN_SITE: &str = r"(?i)^(?:please\s+)?(?:open|go to|visit|take me to)\s+(?:the\s+)?(?:website\s+|site\s+)?(\S{3,200})(\s+in\s+(?:my\s+(?:own\s+)?browser|safari|chrome))?\s*[.!]?$";

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

const QUIT_APP: &str = r"(?i)^(?:please\s+)?(?:quit|close)\s+(?:the\s+)?(.{2,40}?)(?:\s+app)?\s*[.!]?$";

/// `{"name"}` for "quit Safari" / "close the Music app" when an app by that name is installed
/// (never Keeper itself, and not "close my window", which is not an app).
pub fn quit_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, QUIT_APP).captures(said.trim())?;
    let name = instant::clean(&c[1]);
    let lower = name.to_lowercase();
    let not_an_app = lower.starts_with("my ") || lower.starts_with("this ") || lower == "keeper" || lower.contains('.');
    (!not_an_app && valid_app_name(&name) && crate::platform::app_installed(&name)).then(|| json!({ "name": name }))
}

/// Websites people name without an address ("go to my Gmail", "open YouTube"): the name as said
/// (lower case, spaces removed) and the address it means. Only sites nobody has as a Mac app.
const KNOWN_SITES: &[(&str, &str)] = &[
    ("gmail", "https://mail.google.com/"),
    ("googlemail", "https://mail.google.com/"),
    ("youtube", "https://www.youtube.com/"),
    ("google", "https://www.google.com/"),
    ("googledrive", "https://drive.google.com/"),
    ("googledocs", "https://docs.google.com/"),
    ("googlecalendar", "https://calendar.google.com/"),
    ("outlook", "https://outlook.live.com/"),
    ("hotmail", "https://outlook.live.com/"),
    ("yahoomail", "https://mail.yahoo.com/"),
    ("icloud", "https://www.icloud.com/"),
    ("facebook", "https://www.facebook.com/"),
    ("instagram", "https://www.instagram.com/"),
    ("wikipedia", "https://www.wikipedia.org/"),
    ("amazon", "https://www.amazon.com/"),
    ("linkedin", "https://www.linkedin.com/"),
    ("netflix", "https://www.netflix.com/"),
];

const OPEN_KNOWN_SITE: &str = r"(?i)^(?:please\s+)?(?:open|go to|visit|take me to|check|show me)\s+(?:up\s+)?(?:my\s+|the\s+)?([a-z][a-z ]{1,20}?)(?:\s+(?:account|inbox|email|mail|page|site|website))?(\s+in\s+(?:my\s+(?:own\s+)?browser|safari|chrome))?\s*[.!]?$";

/// `{"url"}` for "open youtube.com": an http(s) address, a bare domain (never a file name), or
/// a well-known site said by name ("go to my Gmail": `KNOWN_SITES`).
pub fn site_words(said: &str) -> Option<Value> {
    static K: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = instant::pattern(&K, OPEN_KNOWN_SITE).captures(said.trim()) {
        let name: String = c[1].to_lowercase().split_whitespace().collect();
        if let Some((_, url)) = KNOWN_SITES.iter().find(|(n, _)| *n == name) {
            return Some(if c.get(2).is_some() { json!({ "url": url, "outside": true }) } else { json!({ "url": url }) });
        }
    }
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, OPEN_SITE).captures(said.trim())?;
    let raw = c[1].trim_end_matches(['.', '!', ',']);
    let url = normalise_url(raw)?;
    let host = url.split("://").nth(1)?.split(['/', '?', '#', ':']).next()?.to_lowercase();
    let ending = host.rsplit('.').next()?;
    let a_domain = ending.len() >= 2 && ending.chars().all(|ch| ch.is_ascii_alphabetic()) && !FILE_ENDINGS.contains(&ending);
    let outside = c.get(2).is_some();
    a_domain.then(|| if outside { json!({ "url": raw, "outside": true }) } else { json!({ "url": raw }) })
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

    #[test]
    fn quit_names_an_installed_app_never_keeper_or_a_window() {
        for not_an_app in ["close my window", "quit keeper", "close notes.txt", "close this", "quit smoking"] {
            assert!(quit_words(not_an_app).is_none(), "{not_an_app}");
        }
        if crate::platform::app_installed("Safari") {
            assert_eq!(quit_words("quit Safari"), Some(json!({ "name": "Safari" })));
            assert_eq!(quit_words("close the Safari app."), Some(json!({ "name": "Safari" })));
            assert_eq!(app_words("switch to Safari"), Some(json!({ "name": "Safari" })));
        }
    }

    #[test]
    fn a_site_opens_in_keeper_unless_the_person_asks_for_their_browser() {
        assert_eq!(site_words("go to gmail.com"), Some(json!({ "url": "gmail.com" })));
        assert_eq!(site_words("open gmail.com in my browser"), Some(json!({ "url": "gmail.com", "outside": true })));
        assert_eq!(site_words("open youtube.com in Safari."), Some(json!({ "url": "youtube.com", "outside": true })));
    }

    #[test]
    fn well_known_sites_open_by_name() {
        assert_eq!(site_words("go to my gmail"), Some(json!({ "url": "https://mail.google.com/" })));
        assert_eq!(site_words("Check my Gmail inbox."), Some(json!({ "url": "https://mail.google.com/" })));
        assert_eq!(site_words("open YouTube"), Some(json!({ "url": "https://www.youtube.com/" })));
        assert_eq!(site_words("open Google Drive in Safari"), Some(json!({ "url": "https://drive.google.com/", "outside": true })));
        assert_eq!(site_words("open my notes"), None);
        assert_eq!(site_words("open Mail"), None);
    }
}
