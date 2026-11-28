//! The whole phrasings that ask for a look at this computer or the world with no mind
//! (`Instant::Also` on the `look` abilities; battery, Wi-Fi and disk space keep theirs in
//! `look.rs`):
//!
//! - `time-in`         "what time is it in Tokyo?", "time in Paris": only a place it knows, so
//!                     "what time is it in the morning there" goes to the mind
//! - `list-shortcuts`  "what shortcuts do I have?", "show me my shortcuts"

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant;
use super::cities;

const TIME_IN: &str = r"(?i)^(?:please\s+)?(?:what(?:'s| is) the time|what time is it|what's the time now|(?:and\s+)?the time|time)\s+(?:right\s+now\s+|now\s+)?in\s+(.{2,40}?)(?:\s+right now|\s+now)?\s*[?.!]?$";
const SHORTCUTS: &str = r"(?i)^(?:please\s+)?(?:(?:what|which)\s+shortcuts\s+do\s+i\s+have|(?:show|list)(?:\s+me)?\s+my\s+shortcuts)\s*[?.!]?$";

/// `{"place"}` for "what time is it in Tokyo", when the place has a known time zone.
pub fn time_in_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, TIME_IN).captures(said.trim())?;
    let place = instant::clean(&c[1]);
    cities::zone_for(&place).is_some().then(|| json!({ "place": place }))
}

pub fn shortcuts_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, SHORTCUTS, said)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn the_time_elsewhere_needs_a_known_place() {
        assert_eq!(time_in_words("What time is it in Tokyo?"), Some(json!({ "place": "Tokyo" })));
        assert_eq!(time_in_words("time in Paris"), Some(json!({ "place": "Paris" })));
        assert_eq!(time_in_words("what's the time in port of spain right now"), Some(json!({ "place": "port of spain" })));
        for mind in ["what time is it", "what time do you finish", "what time is it in the morning there", "what time is it in Atlantis"] {
            assert_eq!(time_in_words(mind), None, "{mind}");
        }
        assert!(shortcuts_words("What shortcuts do I have?").is_some() && shortcuts_words("show me my shortcuts").is_some());
        assert!(shortcuts_words("what are keyboard shortcuts for copy").is_none());
    }
}
