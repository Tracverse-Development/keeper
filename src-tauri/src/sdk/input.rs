//! Reading an ability's input: every pack validates at the boundary with these, so a missing or
//! empty field always answers the same plain sentence.

use crate::kernel::{DeskError, Result};

/// A required, non-empty text field, trimmed. Missing: "That needs a {key}."
pub fn text<'a>(input: &'a serde_json::Value, key: &str) -> Result<&'a str> {
    optional(input, key).ok_or_else(|| DeskError::Invalid(format!("That needs a {key}.")))
}

/// An optional text field, trimmed; None when missing or empty.
pub fn optional<'a>(input: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    input.get(key).and_then(|v| v.as_str()).map(str::trim).filter(|s| !s.is_empty())
}

/// A whole number from `min` to `max` (a JSON number, or digits in a string, so "40" works too).
/// Missing or out of range: "The {key} needs to be a number from {min} to {max}."
pub fn number(input: &serde_json::Value, key: &str, min: i64, max: i64) -> Result<i64> {
    let value = &input[key];
    let n = value.as_i64().or_else(|| value.as_f64().filter(|f| f.fract() == 0.0).map(|f| f as i64)).or_else(|| value.as_str().and_then(|s| s.trim().parse().ok()));
    n.filter(|n| (min..=max).contains(n)).ok_or_else(|| DeskError::Invalid(format!("The {key} needs to be a number from {min} to {max}.")))
}

/// On or off: `true`/`false`, or the words "on"/"off". Missing: "Say whether to turn {key} on or off."
pub fn switch(input: &serde_json::Value, key: &str) -> Result<bool> {
    let value = &input[key];
    value.as_bool().or_else(|| match value.as_str().map(|s| s.trim().to_lowercase()).as_deref() {
        Some("on" | "true" | "yes") => Some(true),
        Some("off" | "false" | "no") => Some(false),
        _ => None,
    }).ok_or_else(|| DeskError::Invalid(format!("Say whether to turn {key} on or off.")))
}

/// A name of something the person has (a Shortcut, a word to look up): never a path, a flag or
/// a control character, and at most `max` characters.
pub fn is_plain_name(name: &str, max: usize) -> bool {
    !name.is_empty() && name.chars().count() <= max && !name.starts_with(['-', '.', '~']) && !name.contains(['/', '\\']) && !name.chars().any(char::is_control)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn a_missing_or_blank_field_says_what_it_needs() {
        let input = json!({ "name": "  Notes ", "empty": "  " });
        assert_eq!(super::text(&input, "name").unwrap(), "Notes");
        assert_eq!(super::text(&input, "empty").unwrap_err().to_string(), "That needs a empty.");
        assert!(super::optional(&input, "missing").is_none());
    }

    #[test]
    fn numbers_stay_in_their_range() {
        let input = json!({ "level": 40, "text": "75", "big": 101, "half": 2.5, "word": "loud" });
        assert_eq!(super::number(&input, "level", 0, 100).unwrap(), 40);
        assert_eq!(super::number(&input, "text", 0, 100).unwrap(), 75);
        for key in ["big", "half", "word", "missing"] {
            assert_eq!(super::number(&input, key, 0, 100).unwrap_err().to_string(), format!("The {key} needs to be a number from 0 to 100."));
        }
    }

    #[test]
    fn a_switch_is_on_or_off() {
        let input = json!({ "a": true, "b": "Off", "c": "maybe" });
        assert!(super::switch(&input, "a").unwrap());
        assert!(!super::switch(&input, "b").unwrap());
        assert!(super::switch(&input, "c").is_err() && super::switch(&input, "missing").is_err());
    }

    #[test]
    fn plain_names_are_never_paths_or_flags() {
        assert!(super::is_plain_name("Morning routine ☀️", 100));
        for bad in ["", "-i", "--input-path", "../x", "a/b", "a\\b", "~/x", ".hidden", "line\nbreak"] {
            assert!(!super::is_plain_name(bad, 100), "{bad:?}");
        }
        assert!(!super::is_plain_name(&"x".repeat(101), 100));
    }
}
