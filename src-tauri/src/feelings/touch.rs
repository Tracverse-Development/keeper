//! What a keeper says when it is touched, composed from its mood and its soul with no model:
//! the line used at once, before (or without) the helper model's own lines
//! (`assistant::touch`). Pure and tested.

use crate::keepers::kit::souls::Soul;

/// A tap on the character (asking for its attention) or a stroke over it (affection).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Touch {
    Poke,
    Pat,
}

impl Touch {
    pub fn read(kind: &str) -> Option<Touch> {
        match kind {
            "poke" => Some(Touch::Poke),
            "pat" => Some(Touch::Pat),
            _ => None,
        }
    }
}

/// This many taps in a row gets a line about the tapping itself.
pub const STREAK: u32 = 3;

/// Lines for a mood word (`Pad::label`); `None` = the keeper has no mood in this mode.
fn mood_lines(touch: Touch, mood: Option<&str>) -> &'static [&'static str] {
    match (touch, mood) {
        (Touch::Poke, Some("cheerful")) => &["Hey {you}! Good timing, I'm in a great mood.", "There you are! What's next?", "Hello hello. What are we doing?"],
        (Touch::Poke, Some("playful")) => &["Boop received. Your move, {you}.", "Ooh, a tap! What are we getting into?", "Tag. You're it."],
        (Touch::Poke, Some("relaxed")) => &["Easy day over here. What's up, {you}?", "No rush. I'm right here.", "Mm? Go ahead."],
        (Touch::Poke, Some("content")) => &["All good over here. What do you need?", "Quietly happy. Go on, {you}.", "I'm here."],
        (Touch::Poke, Some("restless")) => &["Good, something to do! What is it?", "I've got energy to spare. Put me to work.", "Yes! What are we doing, {you}?"],
        (Touch::Poke, Some("a little unsettled")) => &["Oh! I was lost in thought. I'm with you now.", "One second. Okay, go ahead, {you}.", "I'm here. Bit scattered, but here."],
        (Touch::Poke, Some("thoughtful")) => &["Hm? I was thinking something over. Go on.", "I'm here, {you}. Mind was somewhere else for a moment.", "Yes? I'm listening."],
        (Touch::Poke, Some("tired")) => &["Mm. I'm awake, just slower right now.", "Still here, {you}. A bit sleepy, but here.", "I'm up. What is it?"],
        (Touch::Poke, _) => &["I'm here, {you}.", "Yes? Go ahead.", "Listening."],
        (Touch::Pat, Some("cheerful" | "playful")) => &["Ha! That's the best part of my day.", "More of that, please, {you}.", "Okay, now I'm properly happy."],
        (Touch::Pat, Some("tired")) => &["That helps. Thank you, {you}.", "Mm. That's nice. Sleepy, but happy.", "Thank you. I needed that."],
        (Touch::Pat, Some("restless" | "a little unsettled" | "thoughtful")) => &["Oh. Thank you, that settles me.", "That helps more than you'd think, {you}.", "Thanks. I feel steadier."],
        (Touch::Pat, _) => &["That's nice. Thank you, {you}.", "Mm. I like that.", "Thank you. That was kind."],
    }
}

/// Lines about being tapped again and again: a joking soul counts, a formal one just attends.
fn streak_lines(soul: &Soul) -> &'static [&'static str] {
    if soul.humor >= 6 {
        &["That's tap number {n}. I'm keeping count.", "Okay, okay, you have my full attention!", "{n} taps. Is this a secret code, {you}?"]
    } else {
        &["I'm here. Tell me what you need.", "You have my attention, {you}."]
    }
}

/// One line for a touch. `mood` = the keeper's mood word when it has one in this mode; `taps` =
/// taps in a row (1 = the first); `pick` chooses among the candidates (the caller passes a
/// counter or a random number); `last` is never said twice in a row.
pub fn composed(touch: Touch, mood: Option<&str>, soul: &Soul, keeper_name: &str, you: &str, taps: u32, pick: usize, last: &str) -> String {
    let mut lines: Vec<&str> = if touch == Touch::Poke && taps >= STREAK { streak_lines(soul).to_vec() } else { mood_lines(touch, mood).to_vec() };
    // The soul's own lines belong to its calm self: with no mood, or a calm one, they join in.
    if taps < STREAK && matches!(mood, None | Some("calm")) {
        lines.extend(if touch == Touch::Poke { &soul.poke_lines } else { &soul.pat_lines }.iter().map(String::as_str));
    }
    let filled: Vec<String> = lines.iter().map(|l| fill(l, keeper_name, you, taps)).filter(|l| l != last).collect();
    match filled.len() {
        0 => fill(lines.first().copied().unwrap_or("I'm here."), keeper_name, you, taps),
        n => filled[pick % n].clone(),
    }
}

/// A line with the names and the tap count written in; with no known name, "{you}" and the
/// comma that addressed it are dropped ("Go on, {you}." → "Go on.").
pub fn fill(line: &str, keeper_name: &str, you: &str, taps: u32) -> String {
    let line = if you.is_empty() { line.replace(", {you}", "").replace(" {you}", "").replace("{you}", "") } else { line.replace("{you}", you) };
    line.replace("{name}", keeper_name).replace("{n}", &taps.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn soul(humor: u8) -> Soul {
        Soul { humor, poke_lines: vec!["Wha' happenin', {you}?".into()], pat_lines: vec![], ..crate::keepers::kit::souls::builtin().remove(0) }
    }

    const MOODS: [Option<&str>; 10] = [None, Some("calm"), Some("cheerful"), Some("playful"), Some("relaxed"), Some("content"), Some("restless"), Some("a little unsettled"), Some("thoughtful"), Some("tired")];

    #[test]
    fn every_mood_has_its_own_words_and_no_placeholder_leaks() {
        for touch in [Touch::Poke, Touch::Pat] {
            for mood in MOODS {
                for pick in 0..6 {
                    for you in ["Ada", ""] {
                        let line = composed(touch, mood, &soul(5), "Kofi", you, 1, pick, "");
                        assert!(!line.contains('{') && !line.contains(" ,") && !line.trim().is_empty(), "{line}");
                    }
                }
            }
        }
        assert_ne!(composed(Touch::Poke, Some("tired"), &soul(5), "K", "Ada", 1, 0, ""), composed(Touch::Poke, Some("cheerful"), &soul(5), "K", "Ada", 1, 0, ""));
    }

    #[test]
    fn the_same_line_is_never_said_twice_in_a_row() {
        let mut last = String::new();
        for pick in 0..30 {
            let line = composed(Touch::Poke, Some("playful"), &soul(5), "K", "Ada", 1, pick, &last);
            assert_ne!(line, last);
            last = line;
        }
    }

    #[test]
    fn a_calm_keeper_uses_its_souls_own_lines_and_a_streak_is_noticed() {
        let lines: Vec<String> = (0..8).map(|pick| composed(Touch::Poke, None, &soul(5), "K", "Ada", 1, pick, "")).collect();
        assert!(lines.contains(&"Wha' happenin', Ada?".to_string()));
        assert!(composed(Touch::Poke, Some("playful"), &soul(8), "K", "Ada", 4, 0, "").contains('4'), "a joking soul counts the taps");
        assert!(!composed(Touch::Poke, Some("playful"), &soul(2), "K", "Ada", 4, 0, "").contains('4'), "a serious soul just attends");
    }
}
