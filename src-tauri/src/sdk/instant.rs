//! Instant answers: requests that need no AI at all, answered in well under a second and still
//! shown on the Stage. Each one is an ability that declares its own phrasings ([`Instant`] on
//! the ability), so the fast path is not a second system: one ability is one entry, whether the
//! mind asks for it or the person's words do.
//!
//! [`asked`] tries every ability this system offers, in registry order, and returns the first
//! one whose words match (an `Instant::Also` ability only where the mode offers it; an
//! `Instant::Only` one in every mode). The turn then runs it through `registry::run`: the same
//! input checks, the same `Done`, the same panels (`assistant::source`, step 1 of the chain).
//!
//! Matching is conservative: a whole phrasing ("find MY …", "what's my battery"), never a
//! keyword, so anything else goes on to the keeper's mind. Where two abilities' words could
//! overlap, the registry order decides (the table test pins the representative phrasings).
//!
//! Writing the words for an ability:
//! ```ignore
//! const ASKS: &str = r"(?i)^(?:please\s+)?how(?:'s| is) my battery\s*[?.!]?$";
//! fn battery_words(said: &str) -> Option<serde_json::Value> {
//!     instant::whole(&BATTERY, ASKS, said)
//! }
//! // … instant: Instant::Also(battery_words) on the ability.
//! ```

use std::sync::OnceLock;

use regex::Regex;

use super::{registry, Ability, Instant};
use crate::keepers::kit::roles::Role;

/// The ability the person's words ask for and its input, read with no mind; None when the
/// words are for the mind. `mode`: the chat's mode (an `Also` ability needs it to offer it).
pub fn asked(said: &str, mode: &Role) -> Option<(&'static Ability, serde_json::Value)> {
    let said = said.trim();
    registry::all().find_map(|ability| {
        let reads = match ability.instant {
            Instant::Also(_) if !mode.allows(ability.id) => return None,
            other => other.reads()?,
        };
        reads(said).map(|input| (ability, input))
    })
}

/// A phrasing compiled once (`static CELL: OnceLock<Regex>` beside its pattern).
pub fn pattern(cell: &'static OnceLock<Regex>, source: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(source).expect("an instant phrasing compiles"))
}

/// `{}` when the words are exactly this phrasing (an ability that needs no input).
pub fn whole(cell: &'static OnceLock<Regex>, source: &str, said: &str) -> Option<serde_json::Value> {
    pattern(cell, source).is_match(said.trim()).then(|| serde_json::json!({}))
}

/// An amount of time as people say it, in seconds: `amount` is digits, "a", "an" or "one";
/// `unit` starts with s (seconds), m (minutes) or h (hours). None for anything else.
/// `seconds_in("an", "hour") == Some(3600)`, `seconds_in("10", "mins") == Some(600)`.
pub fn seconds_in(amount: &str, unit: &str) -> Option<i64> {
    let n: i64 = match amount.trim().to_lowercase().as_str() {
        "a" | "an" | "one" => 1,
        digits => digits.parse().ok()?,
    };
    let per = match unit.trim().to_lowercase().chars().next()? {
        's' => 1,
        'm' => 60,
        'h' => 3600,
        _ => return None,
    };
    Some(n * per)
}

/// The words with trailing punctuation and spaces taken off ("stretch." → "stretch").
pub fn clean(words: &str) -> String {
    words.trim().trim_end_matches(['.', '!', '?', ',']).trim().to_string()
}

/// "I love my sister" → "You love your sister": what the person said about themselves, as the
/// keeper says it back (a reminder's text, a fact it learns).
pub fn to_second_person(text: &str) -> String {
    let swapped: Vec<String> = text
        .split_whitespace()
        .map(|w| {
            let lower = w.to_lowercase();
            let core = lower.trim_end_matches([',', '.', '!', '?']);
            let tail = &lower[core.len()..];
            let swapped = match core {
                "i" => "you",
                "i'm" | "im" => "you're",
                "i've" => "you've",
                "i'll" => "you'll",
                "i'd" => "you'd",
                "am" => "are",
                "my" => "your",
                "mine" => "yours",
                "me" => "you",
                "myself" => "yourself",
                _ => return w.to_string(),
            };
            format!("{swapped}{tail}")
        })
        .collect();
    let mut out = swapped.join(" ");
    if let Some(first) = out.get(0..1) {
        out = first.to_uppercase() + &out[1..];
    }
    out
}

#[cfg(test)]
#[path = "instant_tests.rs"]
mod tests;
