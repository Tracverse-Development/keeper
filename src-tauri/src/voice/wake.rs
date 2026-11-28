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

    /// The keeper `text` names, and what it asks (or that it only named it). Names are matched by
    /// how they SOUND, as a speech recogniser writes them: "Trini Boi" is heard as "Trini boy",
    /// "Trinny Boy" or "triniboy" (`sounds_like`).
    fn named(&mut self, text: &str, names: &[String], active: usize) -> Heard {
        // Each keeper's own name first, then the product name for the active keeper.
        let mut spellings: Vec<(usize, String)> = names.iter().enumerate().map(|(i, n)| (i, n.clone())).filter(|(_, n)| !n.trim().is_empty()).collect();
        spellings.extend(["keeper", "keep her"].map(|s| (active, s.to_string())));
        let Some((index, end)) = spellings.iter().find_map(|(i, name)| find_name(text, name).map(|end| (*i, end))) else {
            return Heard::Ignore;
        };
        let rest = text[end.min(text.len())..].trim_start_matches([',', '.', '!', '?', ' ']).trim();
        if rest.is_empty() {
            self.awaiting = Some(index);
            Heard::Woken(index)
        } else {
            Heard::Command(index, rest.to_string())
        }
    }
}

/// The words of `text` with where each ends (byte offset), letters and digits only.
fn words_of(text: &str) -> Vec<(String, usize)> {
    let mut out = Vec::new();
    let mut word = String::new();
    for (at, c) in text.char_indices() {
        if c.is_alphanumeric() || c == '\'' {
            if c != '\'' {
                word.extend(c.to_lowercase());
            }
        } else if !word.is_empty() {
            out.push((std::mem::take(&mut word), at));
        }
    }
    if !word.is_empty() {
        out.push((word, text.len()));
    }
    out
}

/// A word as it sounds: "boi" and "boy" alike, "trinny" and "trini" alike, "keeper" and "kiper".
fn sound(word: &str) -> String {
    let mut w = word.to_lowercase().replace("ph", "f").replace("ck", "k").replace("ee", "i").replace("ea", "i").replace("oy", "oi").replace('y', "i").replace('c', "k").replace('z', "s");
    if w.len() > 3 && w.ends_with('e') {
        w.pop();
    }
    let mut out = String::new();
    for c in w.chars() {
        if out.chars().last() != Some(c) {
            out.push(c);
        }
    }
    out
}

fn edits(a: &str, b: &str) -> usize {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut prev = row[0];
        row[0] = i;
        for j in 1..=b.len() {
            let here = row[j];
            row[j] = (row[j] + 1).min(row[j - 1] + 1).min(prev + usize::from(a[i - 1] != b[j - 1]));
            prev = here;
        }
    }
    row[b.len()]
}

/// Do these sound like the same word or name? Alike, or one sound off in a longer one.
pub fn sounds_like(heard: &str, name: &str) -> bool {
    let (a, b) = (sound(heard), sound(name));
    !a.is_empty() && (a == b || (b.len() >= 5 && edits(&a, &b) <= 1) || (b.len() >= 9 && edits(&a, &b) <= 2))
}

/// Where the name ends in `text` (byte offset), when its words are heard there in a row (written
/// as one word or several: "Trini Boi" as "triniboy" or "trini boy").
pub fn find_name(text: &str, name: &str) -> Option<usize> {
    let heard = words_of(text);
    let wanted: String = words_of(name).into_iter().map(|(w, _)| w).collect::<Vec<_>>().concat();
    if wanted.is_empty() {
        return None;
    }
    let parts = words_of(name).len();
    (0..heard.len()).find_map(|start| {
        (1..=(parts + 1)).filter(|n| start + n <= heard.len()).find_map(|n| {
            let joined: String = heard[start..start + n].iter().map(|(w, _)| w.as_str()).collect();
            sounds_like(&joined, &wanted).then(|| heard[start + n - 1].1)
        })
    })
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

    #[test]
    fn a_name_is_heard_as_a_recogniser_writes_it() {
        let names = vec!["Trini Boi".to_string(), "Pup".to_string()];
        let now = Instant::now();
        for said in ["Trini boy, what time is it", "trinny boy what time is it", "Triniboy what time is it", "Hey Trini Boi what time is it"] {
            let mut w = Wake::default();
            assert_eq!(w.hear(said, &names, 0, now), Heard::Command(0, "what time is it".into()), "{said}");
        }
        let mut w = Wake::default();
        assert_eq!(w.hear("Trini boy", &names, 0, now), Heard::Woken(0));
        for not_it in ["it's a tiny toy", "trinidad is lovely", "the boy went home", "pumpkin pie"] {
            assert_eq!(Wake::default().hear(not_it, &names, 0, now), Heard::Ignore, "{not_it}");
        }
        assert_eq!(Wake::default().hear("pup, sit", &names, 0, now), Heard::Command(1, "sit".into()));
    }
}
