//! The whole phrasings that work out a sum or a conversion with no mind (`Instant::Also`):
//!
//! - `calculate`  "what's 15% of 86", "what is 12 * 7", "calculate (3 + 4) ^ 2": only when the
//!                words after the question are a sum (digits and operators) that works out
//! - `convert`    "convert 5 km to miles", "what is 5 km in miles", "5 km in miles",
//!                "how many cups is 500 ml": only units it knows, of the same kind

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant;
use super::{maths, units};

const SUM: &str = r"(?i)^(?:please\s+)?(?:what(?:'s| is)|calculate|work out|compute|how much is)\s+(.{1,200}?)\s*[?=]*\s*$";
/// What a sum may be written with, once the words "of", "sqrt" and "square root of" are taken out.
const SUM_CHARACTERS: &str = "0123456789.,+-*/^%()x×÷ ";

const CONVERT: &str = r"(?i)^(?:please\s+)?(?:convert\s+|what(?:'s| is)\s+)?(-?\d[\d,]*(?:\.\d+)?)\s*([^\d\s?][^?]{0,20}?)\s+(?:to|into|in)\s+([^\d?][^?]{0,20}?)\s*\??$";
const HOW_MANY: &str = r"(?i)^(?:please\s+)?how\s+many\s+([^\d?][^?]{0,20}?)\s+(?:is|are|in|make)\s+(-?\d[\d,]*(?:\.\d+)?)\s*([^\d\s?][^?]{0,20}?)\s*\??$";

/// `{"sum"}` when the words ask for a sum that works out.
pub fn sum_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, SUM).captures(said.trim())?;
    // "what is the square root of 81": "the" is part of the question, not the sum.
    let sum = c[1].trim();
    let sum = sum.strip_prefix("the ").unwrap_or(sum);
    let bare = sum.to_lowercase().replace("square root of", " ").replace("sqrt", " ").replace(" of ", " ");
    let written_as_a_sum = bare.chars().all(|ch| SUM_CHARACTERS.contains(ch)) && bare.chars().any(|ch| ch.is_ascii_digit());
    let has_an_operation = bare.chars().any(|ch| "+-*/^%x×÷".contains(ch)) || sum.to_lowercase().contains("sqrt") || sum.to_lowercase().contains("square root");
    (written_as_a_sum && has_an_operation && maths::evaluate(sum).is_ok()).then(|| json!({ "sum": sum }))
}

/// `{"value", "from", "to"}` when both units are known and measure the same thing.
pub fn convert_words(said: &str) -> Option<Value> {
    static CONVERTING: OnceLock<Regex> = OnceLock::new();
    static ASKING: OnceLock<Regex> = OnceLock::new();
    let said = said.trim();
    let (number, from, to) = if let Some(c) = instant::pattern(&CONVERTING, CONVERT).captures(said) {
        (c[1].to_string(), c[2].to_string(), c[3].to_string())
    } else {
        let c = instant::pattern(&ASKING, HOW_MANY).captures(said)?;
        (c[2].to_string(), c[3].to_string(), c[1].to_string())
    };
    let value: f64 = number.replace(',', "").parse().ok()?;
    units::convert(value, from.trim(), to.trim()).ok()?;
    Some(json!({ "value": value, "from": from.trim(), "to": to.trim() }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn only_sums_are_worked_out() {
        assert_eq!(sum_words("what's 15% of 86"), Some(json!({ "sum": "15% of 86" })));
        assert_eq!(sum_words("What is 12 * 7?"), Some(json!({ "sum": "12 * 7" })));
        assert_eq!(sum_words("calculate (3 + 4) ^ 2"), Some(json!({ "sum": "(3 + 4) ^ 2" })));
        assert_eq!(sum_words("what is the square root of 81"), Some(json!({ "sum": "square root of 81" })));
        for mind in ["what's 7", "what is love", "what's 2026 going to bring", "what is x + y", "what is 5 km in miles", "what's the time"] {
            assert_eq!(sum_words(mind), None, "{mind}");
        }
    }

    #[test]
    fn conversions_need_known_units_of_one_kind() {
        assert_eq!(convert_words("convert 5 km to miles"), Some(json!({ "value": 5.0, "from": "km", "to": "miles" })));
        assert_eq!(convert_words("what is 5 km in miles?"), Some(json!({ "value": 5.0, "from": "km", "to": "miles" })));
        assert_eq!(convert_words("5 km in miles"), Some(json!({ "value": 5.0, "from": "km", "to": "miles" })));
        assert_eq!(convert_words("how many cups is 500 ml"), Some(json!({ "value": 500.0, "from": "ml", "to": "cups" })));
        assert_eq!(convert_words("convert 1,500 m to km"), Some(json!({ "value": 1500.0, "from": "m", "to": "km" })));
        for mind in ["convert 5 usd to eur", "5 kg in km", "how many people live in 10 downing street", "what is 5 apples in pears"] {
            assert_eq!(convert_words(mind), None, "{mind}");
        }
    }
}
