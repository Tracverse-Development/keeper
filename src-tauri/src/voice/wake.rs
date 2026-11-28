//! The wake word, as a small State machine over final transcripts (always-listening mode):
//! "Hey Kofi, what's on today?" → keeper Kofi, command "what's on today?"; "Kofi" alone → Kofi
//! waits for the next sentence; "Hey Keeper" → the active keeper; anything else → ignored
//! (never sent anywhere, never stored).
//!
//! A conversation, not a command line: once a keeper has answered out loud, `follow` keeps the
//! conversation open for `FOLLOW_WINDOW`, so the next sentence goes to it without its name ("Hey
//! Kofi, what's on today?" … "And tomorrow?"). Naming another keeper still switches; the window
//! closes when it runs out or a sentence is taken from it, and reopens after the next answer.

use std::time::{Duration, Instant};

/// How long after a keeper finishes speaking the next sentence still goes to it without its name.
pub const FOLLOW_WINDOW: Duration = Duration::from_secs(8);

#[derive(Debug, Default)]
pub struct Wake {
    /// The keeper (index into the names) that heard its name and waits for the next sentence.
    awaiting: Option<usize>,
    /// The keeper still in conversation, until when (`follow`).
    following: Option<(usize, Instant)>,
}

#[derive(Debug, PartialEq)]
pub enum Heard {
    /// Not for any keeper.
    Ignore,
    /// A keeper's name alone: the next sentence is its command.
    Woken(usize),
    /// A command for the keeper at this index.
    Command(usize, String),
}

impl Wake {
    /// Keeps the conversation with keeper `index` open until `until` (it has just answered).
    pub fn follow(&mut self, index: usize, until: Instant) {
        self.following = Some((index, until));
    }

    /// The keeper still in conversation at `now`, if any.
    pub fn following(&self, now: Instant) -> Option<usize> {
        self.following.filter(|(_, until)| now < *until).map(|(i, _)| i)
    }

    /// `names[i]` is keeper i's name; `active` is the index "Hey Keeper" means; `now` decides
    /// whether a conversation window is still open.
    pub fn hear(&mut self, transcript: &str, names: &[String], active: usize, now: Instant) -> Heard {
        let text = transcript.trim();
        if let Some(i) = self.awaiting.take() {
            return if text.is_empty() { Heard::Ignore } else { Heard::Command(i, text.to_string()) };
        }
        let follow = self.following(now);
        self.following = None;
        let named = self.named(text, names, active);
        match (named, follow) {
            (Heard::Ignore, Some(i)) if text.chars().filter(|c| c.is_alphanumeric()).count() > 2 => Heard::Command(i, text.to_string()),
            (heard, _) => heard,
        }
    }

    /// The keeper `text` names, and what it asks (or that it only named it).
    fn named(&mut self, text: &str, names: &[String], active: usize) -> Heard {
        let lower = text.to_lowercase();
        // Each keeper's own name first, then the product name (and how recognisers spell it) for the active keeper.
        let mut spellings: Vec<(usize, String)> = names.iter().enumerate().map(|(i, n)| (i, n.to_lowercase())).filter(|(_, n)| !n.is_empty()).collect();
        spellings.extend(["keeper", "keep her", "kiper"].map(|s| (active, s.to_string())));
        let Some((index, pos, len)) = spellings.iter().find_map(|(i, s)| lower.find(s.as_str()).map(|p| (*i, p, s.len()))) else {
            return Heard::Ignore;
        };
        let rest = text[(pos + len).min(text.len())..].trim_start_matches([',', '.', '!', '?', ' ']).trim();
        if rest.is_empty() {
            self.awaiting = Some(index);
            Heard::Woken(index)
        } else {
            Heard::Command(index, rest.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_named_keeper_wakes() {
        let names = vec!["Trini Boy".to_string(), "Pup".to_string()];
        let mut w = Wake::default();
        let now = Instant::now();
        assert_eq!(w.hear("so I was saying to her", &names, 0, now), Heard::Ignore);
        assert_eq!(w.hear("Hey Pup, remind me to walk at 6 pm", &names, 0, now), Heard::Command(1, "remind me to walk at 6 pm".into()));
        assert_eq!(w.hear("hey keeper what time is it", &names, 1, now), Heard::Command(1, "what time is it".into()));
        assert_eq!(w.hear("Trini Boy", &names, 1, now), Heard::Woken(0));
        assert_eq!(w.hear("open my Downloads folder", &names, 1, now), Heard::Command(0, "open my Downloads folder".into()));
    }

    #[test]
    fn after_an_answer_the_next_sentence_needs_no_name() {
        let names = vec!["Kofi".to_string(), "Pup".to_string()];
        let mut w = Wake::default();
        let now = Instant::now();
        assert_eq!(w.hear("Hey Kofi what's on today", &names, 0, now), Heard::Command(0, "what's on today".into()));
        w.follow(0, now + FOLLOW_WINDOW);
        assert_eq!(w.following(now + Duration::from_secs(3)), Some(0));
        assert_eq!(w.hear("and tomorrow?", &names, 0, now + Duration::from_secs(3)), Heard::Command(0, "and tomorrow?".into()));
        assert_eq!(w.hear("and the day after", &names, 0, now + Duration::from_secs(4)), Heard::Ignore, "one sentence per answer: the window reopens after the next answer");
    }

    #[test]
    fn the_window_closes_in_time_and_never_takes_noise_or_another_keepers_name() {
        let names = vec!["Kofi".to_string(), "Pup".to_string()];
        let mut w = Wake::default();
        let now = Instant::now();
        w.follow(0, now + FOLLOW_WINDOW);
        assert_eq!(w.hear("thanks", &names, 0, now + FOLLOW_WINDOW + Duration::from_millis(1)), Heard::Ignore, "too late");
        w.follow(0, now + FOLLOW_WINDOW);
        assert_eq!(w.hear("uh", &names, 0, now), Heard::Ignore, "a grunt is not a sentence");
        w.follow(0, now + FOLLOW_WINDOW);
        assert_eq!(w.hear("Pup, sit", &names, 0, now), Heard::Command(1, "sit".into()), "naming another keeper switches");
    }
}
