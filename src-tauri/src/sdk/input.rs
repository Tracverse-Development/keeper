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
}
