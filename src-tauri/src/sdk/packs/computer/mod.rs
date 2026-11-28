//! This computer: what a keeper can look at (`look`: battery, Wi-Fi, disk space, open apps, the
//! time elsewhere, the person's Shortcuts), open (`open`: a folder or file in the Finder, a pane
//! of System Settings, a word in the Dictionary) and change when the person asks in words
//! (`change`: dark mode, volume, staying awake, the display, the lock, the clipboard, a
//! screenshot, a note, one of their Shortcuts). Every OS call is a `platform` function; these
//! packs check the input and say what happened. The whole phrasings that run each with no mind
//! sit beside it (`look_words`, `open_words`, `change_words`).

mod change_words;
mod cities;
mod look_words;
mod open_words;
pub mod change;
pub mod look;
pub mod open;

use crate::stage::Panel;

/// A two-column "what / now" table of readings, rows in the order given (the Stage's table
/// panel: the first column reads as a header).
fn readings(id: &str, title: &str, rows: &[(&str, String)]) -> Panel {
    let rows = rows.iter().map(|(what, value)| vec![serde_json::Value::from(*what), serde_json::Value::from(value.as_str())]).collect();
    Panel::Table { id: id.into(), title: title.into(), caption: None, columns: vec!["".into(), "Now".into()], rows, highlight: vec![] }
}

/// A one-column table of names (open apps, Shortcuts).
fn names(id: &str, title: &str, heading: &str, names: &[String]) -> Panel {
    let rows = names.iter().map(|n| vec![serde_json::Value::from(n.as_str())]).collect();
    Panel::Table { id: id.into(), title: title.into(), caption: None, columns: vec![heading.into()], rows, highlight: vec![] }
}

/// "a, b, c and 4 more": a list said aloud, never longer than `max` names.
fn some_of(items: &[String], max: usize) -> String {
    let shown = &items[..items.len().min(max)];
    let more = items.len() - shown.len();
    match (shown, more) {
        ([], _) => String::new(),
        ([one], 0) => one.clone(),
        (_, 0) => format!("{} and {}", shown[..shown.len() - 1].join(", "), shown[shown.len() - 1]),
        (_, n) => format!("{} and {n} more", shown.join(", ")),
    }
}

/// "1 app", "4 apps": a count with its noun (nouns that add an s).
fn counted(n: usize, noun: &str) -> String {
    format!("{n} {noun}{}", if n == 1 { "" } else { "s" })
}

/// 245 → "4 hours 5 minutes", 60 → "1 hour", 45 → "45 minutes".
fn duration_words(minutes: u32) -> String {
    match (minutes / 60, minutes % 60) {
        (0, m) => counted(m as usize, "minute"),
        (h, 0) => counted(h as usize, "hour"),
        (h, m) => format!("{} {}", counted(h as usize, "hour"), counted(m as usize, "minute")),
    }
}

/// "charging" → "Charging", "tokyo" → "Tokyo": the first letter raised, the rest as written.
fn sentence_case(words: &str) -> String {
    let mut chars = words.trim().chars();
    chars.next().map(|first| first.to_uppercase().collect::<String>() + chars.as_str()).unwrap_or_default()
}

/// "08:52" → "8:52 am" (the way the keeper says a time).
fn twelve_hour(clock: &str) -> String {
    let Some((h, m)) = clock.split_once(':') else { return clock.to_string() };
    let Ok(hour) = h.parse::<u32>() else { return clock.to_string() };
    let (shown, half) = match hour {
        0 => (12, "am"),
        1..=11 => (hour, "am"),
        12 => (12, "pm"),
        _ => (hour - 12, "pm"),
    };
    format!("{shown}:{m} {half}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_and_times_are_said_naturally() {
        let apps: Vec<String> = ["Finder", "Notes", "Safari", "Music"].iter().map(|s| s.to_string()).collect();
        assert_eq!(some_of(&apps[..1], 3), "Finder");
        assert_eq!(some_of(&apps[..3], 3), "Finder, Notes and Safari");
        assert_eq!(some_of(&apps, 2), "Finder, Notes and 2 more");
        assert_eq!((counted(1, "app"), counted(4, "app")), ("1 app".into(), "4 apps".into()));
        assert_eq!((duration_words(245), duration_words(60), duration_words(45), duration_words(1)), ("4 hours 5 minutes".into(), "1 hour".into(), "45 minutes".into(), "1 minute".into()));
        assert_eq!((sentence_case(" tokyo"), sentence_case("")), ("Tokyo".into(), String::new()));
        assert_eq!((twelve_hour("08:52"), twelve_hour("00:05"), twelve_hour("12:00"), twelve_hour("17:30")), ("8:52 am".into(), "12:05 am".into(), "12:00 pm".into(), "5:30 pm".into()));
    }
}
