//! Opening things for the person: an app by name, a website. Inputs are checked here so a name
//! can never be a path or a flag and an address is only ever http(s). "Open Notes" and "open
//! youtube.com" run them with no mind (`words`); "switch to Safari" brings an open app to the front.
//! `quit-app` asks an app to quit (it still offers to save; never Keeper itself).

mod words;

use super::super::{input, Ability, Access, Done, Instant, ALL, MAC};
use crate::kernel::{DeskError, Result};
use crate::platform;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "quit-app",
        how: "{\"name\": \"Safari\"} quits a Mac app by name, the polite way (it still asks to save unsaved work)",
        access: Access::Change,
        platforms: MAC, modes: &["assistant"], instant: Instant::Also(words::quit_words),
        run: |input, _| Box::pin(quit_app(input)),
    },
    Ability {
        id: "open-app",
        how: "{\"name\": \"Notes\"} opens a Mac app by name",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(words::app_words),
        run: |input, _| Box::pin(async move { open_app(input) }),
    },
    Ability {
        id: "open-website",
        how: "{\"url\": \"https://umojaark.com\"} opens a website inside Keeper's own browser, in front of the person (add \"outside\": true only when they ask for their own browser)",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(words::site_words),
        run: |input, cx| Box::pin(async move { open_website(input, cx) }),
    },
];

/// App names are letters, digits, spaces and a little punctuation: never a path or a flag.
pub fn valid_app_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 60 && !name.starts_with('-') && name.chars().all(|c| c.is_alphanumeric() || " .&'+-".contains(c))
}

fn open_app(input: &serde_json::Value) -> Result<Done> {
    let name = input::text(input, "name")?;
    if !valid_app_name(name) {
        return Err(DeskError::Invalid("That doesn't look like an app name.".into()));
    }
    platform::open_app(name)?;
    Ok(Done::said(format!("Opened {name}.")))
}

async fn quit_app(input: &serde_json::Value) -> Result<Done> {
    let name = input::text(input, "name")?;
    if !valid_app_name(name) || name.eq_ignore_ascii_case("keeper") {
        return Err(DeskError::Invalid("That doesn't look like an app I can quit.".into()));
    }
    platform::quit_app(name).await?;
    Ok(Done::said(format!("I asked {name} to quit. If it had unsaved work, it asks you first.")))
}

/// Only http(s) addresses; a bare domain gets https.
pub fn normalise_url(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.chars().any(char::is_whitespace) || raw.len() > 300 {
        return None;
    }
    let url = if raw.starts_with("http://") || raw.starts_with("https://") { raw.to_string() } else if raw.contains("://") { return None } else { format!("https://{raw}") };
    let host = url.split("://").nth(1)?.split(['/', '?', '#']).next()?;
    (host.contains('.') && host.chars().all(|c| c.is_alphanumeric() || ".-:".contains(c))).then_some(url)
}

fn open_website(input: &serde_json::Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    let url = normalise_url(input::text(input, "url")?).ok_or_else(|| DeskError::Invalid("That isn't a web address I can open.".into()))?;
    // Inside Keeper by default (founder 2026-11-28: "default to that"); the person's own browser
    // when they ask for it, or when Keeper is not the one at the Mac (a phone asked).
    let outside = input.get("outside").and_then(|v| v.as_bool()).unwrap_or(false) || !cx.at_the_mac;
    if outside {
        platform::open_url(&url)?;
        return Ok(Done::said(format!("Opened {url} in your browser.")));
    }
    crate::browser::open(cx.app, &url)?;
    let host = url.split("://").nth(1).and_then(|r| r.split('/').next()).unwrap_or(&url).to_string();
    Ok(Done::said(format!("Here's {host}, open in Keeper.")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_names_cannot_be_paths_or_flags() {
        assert!(valid_app_name("Notes"));
        assert!(valid_app_name("Visual Studio Code"));
        assert!(!valid_app_name("-a Terminal"));
        assert!(!valid_app_name("/System/Applications/Terminal.app"));
        assert!(!valid_app_name("Notes; rm -rf ~"));
    }

    #[test]
    fn only_web_addresses_open() {
        assert_eq!(normalise_url("umojaark.com").as_deref(), Some("https://umojaark.com"));
        assert_eq!(normalise_url("http://localhost.test/a").as_deref(), Some("http://localhost.test/a"));
        assert_eq!(normalise_url("file:///etc/passwd"), None);
        assert_eq!(normalise_url("javascript:alert(1)"), None);
        assert_eq!(normalise_url("not a url"), None);
    }
}
