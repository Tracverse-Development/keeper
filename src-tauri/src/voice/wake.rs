//! The wake word, as a small State machine over final transcripts (always-listening mode):
//! "Hey Kofi, what's on today?" → keeper Kofi, command "what's on today?"; "Kofi" alone → Kofi
//! waits for the next sentence; "Hey Keeper" → the active keeper; anything else → ignored
//! (never sent anywhere, never stored).

#[derive(Debug, Default)]
pub struct Wake {
    /// The keeper (index into the names) that heard its name and waits for the next sentence.
    awaiting: Option<usize>,
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
    /// `names[i]` is keeper i's name; `active` is the index "Hey Keeper" means.
    pub fn hear(&mut self, transcript: &str, names: &[String], active: usize) -> Heard {
        let text = transcript.trim();
        if let Some(i) = self.awaiting.take() {
            return if text.is_empty() { Heard::Ignore } else { Heard::Command(i, text.to_string()) };
        }
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
        assert_eq!(w.hear("so I was saying to her", &names, 0), Heard::Ignore);
        assert_eq!(w.hear("Hey Pup, remind me to walk at 6 pm", &names, 0), Heard::Command(1, "remind me to walk at 6 pm".into()));
        assert_eq!(w.hear("hey keeper what time is it", &names, 1), Heard::Command(1, "what time is it".into()));
        assert_eq!(w.hear("Trini Boy", &names, 1), Heard::Woken(0));
        assert_eq!(w.hear("open my Downloads folder", &names, 1), Heard::Command(0, "open my Downloads folder".into()));
    }
}
