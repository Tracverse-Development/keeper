//! The whole phrasings that make a change the person asked for in words, with no mind
//! (`Instant::Also` on the `change` abilities). Each still runs only at the Mac
//! (`registry::may_run_from`) and only in a mode that offers it.
//!
//! - `dark-mode`    "turn on dark mode", "dark mode off", "switch to light mode"
//! - `set-volume`   "set the volume to 30", "volume 30%", "mute", "unmute"
//! - `keep-awake`   "keep my Mac awake for 2 hours", "stop keeping my Mac awake"
//! - `screenshot`   "take a screenshot"
//! - `lock-screen`  "lock my screen", "lock my Mac"
//! - `screen-off`   "turn off the display", "sleep the display"
//! - `new-note`     "make a note: milk and eggs", "note that the boiler was serviced", "new note …"
//! - `run-shortcut` "run my Morning shortcut", "run the shortcut Log water"

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::{input, instant};

const DARK_ON_OFF: &str = r"(?i)^(?:please\s+)?(?:(?:turn|switch|put)\s+(on|off)\s+dark mode|(?:turn|switch|put)\s+dark mode\s+(on|off)|dark mode\s+(on|off))\s*[.!]?$";
const DARK_TO: &str = r"(?i)^(?:please\s+)?(?:switch|change|go|turn)\s+(?:it\s+)?(?:to|into)\s+(dark|light)\s+mode\s*[.!]?$";
const VOLUME_LEVEL: &str = r"(?i)^(?:please\s+)?(?:(?:set|turn|put|change)\s+(?:the\s+|my\s+)?volume\s+(?:to|at|up to|down to)\s+|volume\s+(?:to\s+|at\s+)?)(\d{1,3})\s*(?:%|percent)?\s*[.!]?$";
const MUTE: &str = r"(?i)^(?:please\s+)?(mute|unmute)(?:\s+(?:the\s+)?(?:sound|volume|audio)|\s+(?:my|the)\s+(?:mac|computer))?\s*[.!]?$";
const AWAKE_FOR: &str = r"(?i)^(?:please\s+)?keep\s+(?:my\s+|the\s+|this\s+)?(?:mac|computer|laptop|screen)\s+awake\s+for\s+(\d{1,3}|an?|one)\s*(minutes?|mins?|hours?|hrs?)\s*[.!]?$";
const AWAKE_STOP: &str = r"(?i)^(?:please\s+)?(?:stop\s+keeping\s+(?:my\s+|the\s+)?(?:mac|computer|laptop)\s+awake|let\s+(?:my\s+|the\s+)?(?:mac|computer|laptop)\s+sleep(?:\s+again)?)\s*[.!]?$";
const SCREENSHOT: &str = r"(?i)^(?:please\s+)?(?:take|grab|make)\s+a\s+screenshot(?:\s+of\s+(?:my|the)\s+(?:whole\s+)?screen)?\s*[.!]?$";
const LOCK: &str = r"(?i)^(?:please\s+)?lock\s+(?:my\s+|the\s+|this\s+)?(?:screen|mac|computer|laptop)\s*[.!]?$";
const DISPLAY_OFF: &str = r"(?i)^(?:please\s+)?(?:(?:turn|switch)\s+off|sleep)\s+(?:my\s+|the\s+)?(?:display|screen|monitor)(?:\s+now)?\s*[.!]?$|^(?:please\s+)?put\s+(?:my\s+|the\s+)?(?:display|screen|monitor)\s+to\s+sleep\s*[.!]?$";
const NOTE: &str = r"(?i)^(?:please\s+)?(?:(?:make|create|take|write)\s+(?:a\s+)?(?:new\s+)?note|new\s+note)(?:\s*[:,]\s*|\s+(?:saying|that\s+says)\s+|\s+)(.+)$|^(?:please\s+)?note\s+that\s+(.+)$";
const SHORTCUT: &str = r"(?i)^(?:please\s+)?run\s+(?:my\s+|the\s+)?(.{1,60}?)\s+shortcut\s*[.!]?$|^(?:please\s+)?run\s+(?:the\s+)?shortcut\s+(?:called\s+|named\s+)?(.{1,60}?)\s*[.!]?$";

/// The first group that matched (patterns with alternatives capture in different places).
fn first_group(c: &regex::Captures) -> Option<String> {
    c.iter().skip(1).flatten().next().map(|m| m.as_str().to_string())
}

/// `{"on": true}` for "turn on dark mode", `false` for "switch to light mode".
pub fn dark_mode_words(said: &str) -> Option<Value> {
    static ON_OFF: OnceLock<Regex> = OnceLock::new();
    static TO: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = instant::pattern(&ON_OFF, DARK_ON_OFF).captures(said.trim()) {
        return Some(json!({ "on": first_group(&c)?.eq_ignore_ascii_case("on") }));
    }
    let c = instant::pattern(&TO, DARK_TO).captures(said.trim())?;
    Some(json!({ "on": c[1].eq_ignore_ascii_case("dark") }))
}

/// `{"level": 30}` or `{"mute": true|false}`. A level over 100 is passed on, so the ability
/// says what it takes rather than the mind guessing.
pub fn volume_words(said: &str) -> Option<Value> {
    static LEVEL: OnceLock<Regex> = OnceLock::new();
    static MUTING: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = instant::pattern(&LEVEL, VOLUME_LEVEL).captures(said.trim()) {
        return Some(json!({ "level": c[1].parse::<i64>().ok()? }));
    }
    let c = instant::pattern(&MUTING, MUTE).captures(said.trim())?;
    Some(json!({ "mute": c[1].eq_ignore_ascii_case("mute") }))
}

/// `{"minutes": 120}` for "keep my Mac awake for 2 hours", `{"minutes": 0}` to let it sleep.
pub fn awake_words(said: &str) -> Option<Value> {
    static FOR: OnceLock<Regex> = OnceLock::new();
    static STOP: OnceLock<Regex> = OnceLock::new();
    if instant::pattern(&STOP, AWAKE_STOP).is_match(said.trim()) {
        return Some(json!({ "minutes": 0 }));
    }
    let c = instant::pattern(&FOR, AWAKE_FOR).captures(said.trim())?;
    Some(json!({ "minutes": instant::seconds_in(&c[1], &c[2])? / 60 }))
}

pub fn screenshot_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, SCREENSHOT, said)
}

pub fn lock_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, LOCK, said)
}

pub fn display_off_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, DISPLAY_OFF, said)
}

/// `{"text"}` for "make a note: milk and eggs" (the note's title is its first line).
pub fn note_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, NOTE).captures(said.trim())?;
    let text = first_group(&c)?.trim().to_string();
    (!text.is_empty()).then(|| json!({ "text": text }))
}

/// `{"name"}` for "run my Morning shortcut": a plain name (the ability matches it to theirs).
pub fn shortcut_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, SHORTCUT).captures(said.trim())?;
    let name = instant::clean(&first_group(&c)?);
    input::is_plain_name(&name, 100).then(|| json!({ "name": name }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn dark_mode_and_volume_read_their_setting() {
        for (said, on) in [("turn on dark mode", true), ("Turn dark mode off.", false), ("dark mode on", true), ("switch to light mode", false), ("switch to dark mode", true)] {
            assert_eq!(dark_mode_words(said), Some(json!({ "on": on })), "{said}");
        }
        assert_eq!(volume_words("set the volume to 30"), Some(json!({ "level": 30 })));
        assert_eq!(volume_words("volume 30%"), Some(json!({ "level": 30 })));
        assert_eq!(volume_words("mute"), Some(json!({ "mute": true })));
        assert_eq!(volume_words("unmute the sound"), Some(json!({ "mute": false })));
        for mind in ["what is dark mode", "is dark mode better for my eyes?", "turn the volume up a bit", "mute my sister"] {
            assert_eq!((dark_mode_words(mind), volume_words(mind)), (None, None), "{mind}");
        }
    }

    #[test]
    fn staying_awake_reads_minutes() {
        assert_eq!(awake_words("keep my mac awake for 2 hours"), Some(json!({ "minutes": 120 })));
        assert_eq!(awake_words("keep my Mac awake for an hour"), Some(json!({ "minutes": 60 })));
        assert_eq!(awake_words("keep the computer awake for 30 minutes."), Some(json!({ "minutes": 30 })));
        assert_eq!(awake_words("stop keeping my mac awake"), Some(json!({ "minutes": 0 })));
        assert_eq!(awake_words("how do I keep my mac awake"), None);
    }

    #[test]
    fn notes_and_shortcuts_read_their_words() {
        assert_eq!(note_words("make a note: milk and eggs"), Some(json!({ "text": "milk and eggs" })));
        assert_eq!(note_words("note that the boiler was serviced"), Some(json!({ "text": "the boiler was serviced" })));
        assert_eq!(note_words("new note Shopping list"), Some(json!({ "text": "Shopping list" })));
        assert_eq!(note_words("what's a note"), None);
        assert_eq!(shortcut_words("run my Morning routine shortcut"), Some(json!({ "name": "Morning routine" })));
        assert_eq!(shortcut_words("run the shortcut Log water"), Some(json!({ "name": "Log water" })));
        assert_eq!(shortcut_words("run the shortcut --input-path /etc/passwd"), None);
        assert!(screenshot_words("take a screenshot").is_some() && lock_words("lock my mac").is_some() && display_off_words("turn off the display").is_some() && display_off_words("sleep the display").is_some());
        assert!(lock_words("lock the door").is_none() && screenshot_words("how do I take a screenshot").is_none());
    }
}
