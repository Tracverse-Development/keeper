//! Opening things for the person: an app by name, a website. Inputs are checked here so a name
//! can never be a path or a flag and an address is only ever http(s).

use super::super::{input, Ability, Access, Done, Instant, ALL};
use crate::kernel::{DeskError, Result};
use crate::platform;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "open-app",
        how: "{\"name\": \"Notes\"} opens a Mac app by name",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::No,
        run: |input, _| Box::pin(async move { open_app(input) }),
    },
    Ability {
        id: "open-website",
        how: "{\"url\": \"https://umojaark.com\"} opens a website in the browser",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::No,
        run: |input, _| Box::pin(async move { open_website(input) }),
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

fn open_website(input: &serde_json::Value) -> Result<Done> {
    let url = normalise_url(input::text(input, "url")?).ok_or_else(|| DeskError::Invalid("That isn't a web address I can open.".into()))?;
    platform::open_url(&url)?;
    Ok(Done::said(format!("Opened {url}.")))
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
