//! The whole phrasings that open something on this computer with no mind (`Instant::Also` on
//! the `open` abilities):
//!
//! - `open-settings`  "open Wi-Fi settings", "open the Bluetooth settings": a pane it knows
//! - `define-word`    "define grace", "what does serendipity mean": ONE word, never "it" or "that"

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant;
use super::open::pane_address;

const SETTINGS: &str = r"(?i)^(?:please\s+)?(?:open|show(?:\s+me)?|go\s+to)\s+(?:the\s+|my\s+)?(.{2,30}?)\s+(?:settings|preferences)\s*[.!]?$";
const DEFINE: &str = r"(?i)^(?:please\s+)?(?:define|look up the word)\s+(\p{L}[\p{L}'-]{1,30})\s*[?.!]?$|^(?:please\s+)?what\s+does\s+(?:the\s+word\s+)?(\p{L}[\p{L}'-]{1,30})\s+mean\s*\??$";

/// Words that are not a word to look up ("what does it mean" is about something said before).
const NOT_A_WORD: &[&str] = &["it", "that", "this", "he", "she", "they", "that word", "this word", "god's", "mine", "yours"];

/// `{"pane"}` for "open Wi-Fi settings", when Settings has that pane.
pub fn settings_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, SETTINGS).captures(said.trim())?;
    let pane = instant::clean(&c[1]);
    pane_address(&pane).is_some().then(|| json!({ "pane": pane }))
}

/// `{"word"}` for "define grace".
pub fn define_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, DEFINE).captures(said.trim())?;
    let word = c.iter().skip(1).flatten().next()?.as_str().to_string();
    (!NOT_A_WORD.contains(&word.to_lowercase().as_str())).then(|| json!({ "word": word }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn panes_and_words_are_read_from_whole_phrasings() {
        assert_eq!(settings_words("open wifi settings"), Some(json!({ "pane": "wifi" })));
        assert_eq!(settings_words("open the Bluetooth settings."), Some(json!({ "pane": "Bluetooth" })));
        assert_eq!(settings_words("open my party settings"), None);
        assert_eq!(define_words("define grace"), Some(json!({ "word": "grace" })));
        assert_eq!(define_words("What does serendipity mean?"), Some(json!({ "word": "serendipity" })));
        for mind in ["what does it mean", "what does that mean?", "define the problem for me", "what does my horoscope mean"] {
            assert_eq!(define_words(mind), None, "{mind}");
        }
    }
}
