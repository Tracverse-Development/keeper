//! The web, inside Keeper, by asking: a search, a place on a map or the way there, the weather.
//! Each opens in Keeper's own browser in front of the person (`browser::open`); over the phone
//! link, or when they ask for their own browser, the person's browser opens instead.
//!
//!   search-web   "search the web for tomato varieties", "google the best compost"  (DuckDuckGo)
//!   map          "directions to Port of Spain", "show Central Park on a map"      (Google Maps)
//!   weather      "what's the weather", "weather in Tokyo tomorrow"                (a search)
//!
//! What is searched travels only to the site the person asked for, as the person's own search
//! would; nothing about them is added.

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::{input, instant, Ability, Access, Done, Instant, ALL};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "search-web",
        how: "{\"query\": \"best tomato varieties for pots\"} searches the web inside Keeper's browser, in front of the person (then read the results page and open what fits)",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(search_words),
        run: |input, cx| Box::pin(async move { search(input, cx) }),
    },
    Ability {
        id: "map",
        how: "{\"place\": \"Port of Spain\"} shows a place on a map inside Keeper; with \"directions\": true, the way there (\"from\": optional, else from where they are)",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(map_words),
        run: |input, cx| Box::pin(async move { map(input, cx) }),
    },
    Ability {
        id: "weather",
        how: "{\"place\": \"Tokyo\", \"when\": \"tomorrow\"} shows the weather inside Keeper (both optional: here and now)",
        access: Access::Open,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(weather_words),
        run: |input, cx| Box::pin(async move { weather(input, cx) }),
    },
];

/// The most words a search, a place or a time may have.
const MAX_WORDS: usize = 200;

const SEARCH_ASKS: &str = r"(?i)^(?:please\s+)?(?:search\s+(?:the\s+web|the\s+internet|online|google)\s+for|search\s+for|google|look\s+up\s+online|look\s+online\s+for)\s+(.{2,200}?)(\s+in\s+(?:my\s+(?:own\s+)?browser|safari|chrome))?\s*[.!?]?$";
const DIRECTIONS_ASKS: &str = r"(?i)^(?:please\s+)?(?:(?:give\s+me\s+|get\s+|show\s+me\s+)?directions|how\s+do\s+i\s+get)\s+to\s+(.{2,120}?)(?:\s+from\s+(.{2,120}?))?\s*[.!?]?$";
const PLACE_ASKS: &str = r"(?i)^(?:please\s+)?(?:show\s+(?:me\s+)?|where\s+is\s+|find\s+)(.{2,120}?)\s+on\s+(?:a|the)\s+map\s*[.!?]?$|^(?:please\s+)?(?:show\s+me\s+)?(?:a\s+)?map\s+of\s+(.{2,120}?)\s*[.!?]?$";
const WEATHER_ASKS: &str = r"(?i)^(?:please\s+)?(?:what(?:'s|\s+is)\s+the\s+|how(?:'s|\s+is)\s+the\s+|show\s+me\s+the\s+)?weather(?:\s+(?:forecast|like))?(?:\s+(today|tonight|tomorrow|this\s+weekend|this\s+week))?(?:\s+(?:in|for|at)\s+(.{2,60}?))?(?:\s+(today|tonight|tomorrow|this\s+weekend|this\s+week))?\s*[?.!]?$";

fn search_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, SEARCH_ASKS).captures(said.trim())?;
    let query = instant::clean(&c[1]);
    Some(if c.get(2).is_some() { json!({ "query": query, "outside": true }) } else { json!({ "query": query }) })
}

fn map_words(said: &str) -> Option<Value> {
    static D: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = instant::pattern(&D, DIRECTIONS_ASKS).captures(said.trim()) {
        let place = instant::clean(&c[1]);
        // "take me to youtube.com" is a website, not a journey.
        if place.contains('.') && !place.contains(' ') {
            return None;
        }
        let mut out = json!({ "place": place, "directions": true });
        if let Some(from) = c.get(2) {
            out["from"] = json!(instant::clean(from.as_str()));
        }
        return Some(out);
    }
    static P: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&P, PLACE_ASKS).captures(said.trim())?;
    let place = c.get(1).or_else(|| c.get(2))?;
    Some(json!({ "place": instant::clean(place.as_str()) }))
}

fn weather_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, WEATHER_ASKS).captures(said.trim())?;
    let mut out = json!({});
    if let Some(place) = c.get(2) {
        out["place"] = json!(instant::clean(place.as_str()));
    }
    if let Some(when) = c.get(1).or_else(|| c.get(3)) {
        out["when"] = json!(when.as_str().to_lowercase());
    }
    Some(out)
}

/// A phrase for an address: trimmed, at most `MAX_WORDS` characters, never empty.
fn phrase(raw: &str) -> Result<String> {
    let words: String = raw.trim().chars().take(MAX_WORDS).collect();
    if words.is_empty() {
        return Err(DeskError::Invalid("What should I look for?".into()));
    }
    Ok(words)
}

/// `base` with its query parameters, every value encoded.
fn address(base: &str, params: &[(&str, &str)]) -> String {
    tauri::Url::parse_with_params(base, params).map(|u| u.to_string()).unwrap_or_else(|_| base.to_string())
}

pub fn search_address(query: &str) -> String {
    address("https://duckduckgo.com/", &[("q", query)])
}

pub fn map_address(place: &str, directions: bool, from: Option<&str>) -> String {
    match (directions, from) {
        (true, Some(from)) => address("https://www.google.com/maps/dir/", &[("api", "1"), ("destination", place), ("origin", from)]),
        (true, None) => address("https://www.google.com/maps/dir/", &[("api", "1"), ("destination", place)]),
        (false, _) => address("https://www.google.com/maps/search/", &[("api", "1"), ("query", place)]),
    }
}

/// Opens `url` in Keeper's browser at the Mac (or the person's browser when asked or away), and
/// says `said` (or where it opened it).
fn show(url: &str, outside: bool, said: String, cx: &super::super::Cx<'_>) -> Result<Done> {
    if outside || !cx.at_the_mac {
        crate::platform::open_url(url)?;
        return Ok(Done::said(format!("{said} It's open in your browser.")));
    }
    crate::browser::open(cx.app, url)?;
    Ok(Done::said(said))
}

fn search(input: &Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    let query = phrase(input::text(input, "query")?)?;
    let outside = input.get("outside").and_then(Value::as_bool).unwrap_or(false);
    show(&search_address(&query), outside, format!("Here's what the web says about {query}."), cx)
}

fn map(input: &Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    let place = phrase(input::text(input, "place")?)?;
    let directions = input.get("directions").and_then(Value::as_bool).unwrap_or(false);
    let from = input::optional(input, "from").map(phrase).transpose()?;
    let said = if directions { format!("Here's the way to {place}.") } else { format!("Here's {place} on the map.") };
    show(&map_address(&place, directions, from.as_deref()), false, said, cx)
}

fn weather(input: &Value, cx: &super::super::Cx<'_>) -> Result<Done> {
    let place = input::optional(input, "place").map(phrase).transpose()?;
    let when = input::optional(input, "when").map(phrase).transpose()?;
    let query = ["weather", when.as_deref().unwrap_or(""), place.as_deref().map(|p| format!("in {p}")).as_deref().unwrap_or("")].iter().filter(|w| !w.is_empty()).copied().collect::<Vec<_>>().join(" ");
    let said = match (&place, &when) {
        (Some(p), Some(w)) => format!("Here's the weather in {p} {w}."),
        (Some(p), None) => format!("Here's the weather in {p}."),
        (None, Some(w)) => format!("Here's the weather {w}."),
        (None, None) => "Here's the weather.".to_string(),
    };
    show(&search_address(&query), false, said, cx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn searches_are_asked_for_in_whole_phrasings() {
        assert_eq!(search_words("search the web for tomato varieties"), Some(json!({ "query": "tomato varieties" })));
        assert_eq!(search_words("Google the best compost bins?"), Some(json!({ "query": "the best compost bins" })));
        assert_eq!(search_words("search for flights to Miami in Safari"), Some(json!({ "query": "flights to Miami", "outside": true })));
        assert_eq!(search_words("search my files"), None, "two words is not a search phrase on its own");
        assert_eq!(search_words("look up grace"), None, "a word to look up is the Dictionary's");
    }

    #[test]
    fn maps_and_directions_by_their_words() {
        assert_eq!(map_words("directions to Port of Spain"), Some(json!({ "place": "Port of Spain", "directions": true })));
        assert_eq!(map_words("how do I get to the airport from home?"), Some(json!({ "place": "the airport", "directions": true, "from": "home" })));
        assert_eq!(map_words("show Central Park on a map"), Some(json!({ "place": "Central Park" })));
        assert_eq!(map_words("map of Trinidad"), Some(json!({ "place": "Trinidad" })));
        assert_eq!(map_words("directions to youtube.com"), None, "a website is open-website's");
        assert_eq!(map_words("take me to my documents"), None);
    }

    #[test]
    fn the_weather_with_a_place_and_a_day() {
        assert_eq!(weather_words("what's the weather"), Some(json!({})));
        assert_eq!(weather_words("What's the weather in Tokyo tomorrow?"), Some(json!({ "place": "Tokyo", "when": "tomorrow" })));
        assert_eq!(weather_words("weather tomorrow"), Some(json!({ "when": "tomorrow" })));
        assert_eq!(weather_words("how's the weather in Port of Spain"), Some(json!({ "place": "Port of Spain" })));
        assert_eq!(weather_words("whether or not"), None);
    }

    #[test]
    fn addresses_encode_every_value() {
        assert_eq!(search_address("tomatoes & basil"), "https://duckduckgo.com/?q=tomatoes+%26+basil");
        assert_eq!(map_address("Port of Spain", true, None), "https://www.google.com/maps/dir/?api=1&destination=Port+of+Spain");
        assert_eq!(map_address("Central Park", false, None), "https://www.google.com/maps/search/?api=1&query=Central+Park");
    }
}
