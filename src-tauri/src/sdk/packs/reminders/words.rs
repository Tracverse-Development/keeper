//! The whole phrasings that set a reminder with no mind (`remind`'s `Instant::Also`), in both
//! orders people use:
//!
//! - "remind me to stretch in 10 minutes", "remind me in an hour to call Maya"
//! - "remind me to pray at 5:30 pm", "remind me at 5pm to call Maya", "remind me at 17:30 to …"
//!
//! Conservative: a clock time needs am/pm or hours:minutes ("at 5" could be morning or evening,
//! so the mind asks), and a reminder that names a day ("tomorrow", "every Monday") goes to the
//! mind, which knows repeats and dates. "Remind me again in 5 minutes" is `snooze`.

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant::{self, clean, to_second_person};

const IN_AFTER: &str = r"(?i)^(?:please\s+)?remind me (?:to |that |about )?(.+?) in (\d{1,4}|an?|one) ?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\s*[.!]?$";
const IN_BEFORE: &str = r"(?i)^(?:please\s+)?remind me in (\d{1,4}|an?|one) ?(seconds?|secs?|minutes?|mins?|hours?|hrs?),?\s+(?:to |that |about )?(.+?)\s*[.!]?$";
const AT_AFTER: &str = r"(?i)^(?:please\s+)?remind me (?:to |that |about )?(.+?) at (\d{1,2})(?::(\d{2}))? ?([ap])?\.?(?:m\.?)?\s*[.!]?$";
const AT_BEFORE: &str = r"(?i)^(?:please\s+)?remind me at (\d{1,2})(?::(\d{2}))? ?(?:([ap])\.?m\.?)?,?\s+(?:to |that |about )?(.+?)\s*[.!]?$";

/// Words that tie a reminder to a day or a repeat: those are for the mind.
const DAY_WORDS: &[&str] = &["tomorrow", "tonight", "today", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "next", "every", "daily", "weekly", "weekdays", "morning", "afternoon", "evening"];

/// The `remind` input these words ask for (`{"text", "inSeconds"}` or `{"text", "atLocal"}`).
pub fn remind_words(said: &str) -> Option<Value> {
    static IN_A: OnceLock<Regex> = OnceLock::new();
    static IN_B: OnceLock<Regex> = OnceLock::new();
    static AT_A: OnceLock<Regex> = OnceLock::new();
    static AT_B: OnceLock<Regex> = OnceLock::new();
    let said = said.trim();
    if let Some(c) = instant::pattern(&IN_A, IN_AFTER).captures(said) {
        return in_seconds(&c[1], &c[2], &c[3]);
    }
    if let Some(c) = instant::pattern(&IN_B, IN_BEFORE).captures(said) {
        return in_seconds(&c[3], &c[1], &c[2]);
    }
    if let Some(c) = instant::pattern(&AT_A, AT_AFTER).captures(said) {
        return at_clock(&c[1], &c[2], c.get(3).map(|m| m.as_str()), c.get(4).map(|m| m.as_str()));
    }
    let c = instant::pattern(&AT_B, AT_BEFORE).captures(said)?;
    at_clock(&c[4], &c[1], c.get(2).map(|m| m.as_str()), c.get(3).map(|m| m.as_str()))
}

/// The reminder's words as the keeper says them back ("call my mum" → "call your mum"), or None
/// when they are not a plain thing to do now-ish (a day word, "again": snooze).
fn reminder_text(raw: &str) -> Option<String> {
    let text = clean(raw);
    let lower = text.to_lowercase();
    let has_day = lower.split(|c: char| !c.is_alphanumeric()).any(|w| DAY_WORDS.contains(&w));
    (!text.is_empty() && !has_day && lower != "again" && !lower.starts_with("again ")).then(|| as_said(&text))
}

/// In the second person, keeping the person's own first letter ("call Maya", not "Call Maya":
/// the reminder is said inside a sentence, "I'll remind you to call Maya").
fn as_said(text: &str) -> String {
    let swapped = to_second_person(text);
    if !text.starts_with(char::is_lowercase) {
        return swapped;
    }
    let mut chars = swapped.chars();
    chars.next().map(|first| first.to_lowercase().collect::<String>() + chars.as_str()).unwrap_or_default()
}

fn in_seconds(text: &str, amount: &str, unit: &str) -> Option<Value> {
    Some(json!({ "text": reminder_text(text)?, "inSeconds": instant::seconds_in(amount, unit)? }))
}

/// A clock time with am/pm (1-12), or written as hours:minutes (0-23); "at 5" alone is unclear.
fn at_clock(text: &str, hour: &str, minute: Option<&str>, half: Option<&str>) -> Option<Value> {
    let hour: u32 = hour.parse().ok()?;
    let minute_value: u32 = minute.map_or(Some(0), |m| m.parse().ok())?;
    if minute_value > 59 {
        return None;
    }
    let hour = match (half.map(str::to_lowercase), minute) {
        (Some(h), _) if (1..=12).contains(&hour) => hour % 12 + if h == "p" { 12 } else { 0 },
        (None, Some(_)) if hour <= 23 => hour,
        _ => return None,
    };
    Some(json!({ "text": reminder_text(text)?, "atLocal": format!("{hour:02}:{minute_value:02}") }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::remind_words;

    #[test]
    fn both_word_orders_set_a_reminder() {
        assert_eq!(remind_words("remind me to call Maya in 10 minutes"), Some(json!({ "text": "call Maya", "inSeconds": 600 })));
        assert_eq!(remind_words("Remind me in 10 minutes to stretch"), Some(json!({ "text": "stretch", "inSeconds": 600 })));
        assert_eq!(remind_words("remind me in an hour, call my mum."), Some(json!({ "text": "call your mum", "inSeconds": 3600 })));
        assert_eq!(remind_words("remind me to pray at 5:30 pm"), Some(json!({ "text": "pray", "atLocal": "17:30" })));
        assert_eq!(remind_words("remind me at 5pm to call Maya"), Some(json!({ "text": "call Maya", "atLocal": "17:00" })));
        assert_eq!(remind_words("remind me at 12 a.m. to sleep"), Some(json!({ "text": "sleep", "atLocal": "00:00" })));
        assert_eq!(remind_words("remind me at 17:45 to stretch"), Some(json!({ "text": "stretch", "atLocal": "17:45" })));
    }

    #[test]
    fn unclear_times_and_days_go_to_the_mind() {
        for mind in ["remind me to call Maya at 5", "remind me at 5 to call Maya", "remind me to call Maya tomorrow at 5 pm", "remind me every Monday at 9 am to pray", "remind me again in 5 minutes", "remind me to call Maya", "remind me at 13 pm to eat", "remind me at 5:75 pm to eat"] {
            assert_eq!(remind_words(mind), None, "{mind}");
        }
    }
}
