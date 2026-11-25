//! The wake word, as a small State machine over final transcripts (always-listening mode):
//! "Hey Keeper, what's on today?" → command "what's on today?"; "Keeper" alone → wait for the
//! next sentence; anything else → ignored (never sent anywhere, never stored).

#[derive(Debug, Default)]
pub struct Wake {
    awaiting: bool,
}

#[derive(Debug, PartialEq)]
pub enum Heard {
    /// Not for the assistant.
    Ignore,
    /// The wake word alone: the next sentence is the command.
    Woken,
    /// A command to act on.
    Command(String),
}

impl Wake {
    pub fn hear(&mut self, transcript: &str, name: &str) -> Heard {
        let text = transcript.trim();
        if self.awaiting {
            self.awaiting = false;
            return if text.is_empty() { Heard::Ignore } else { Heard::Command(text.to_string()) };
        }
        let lower = text.to_lowercase();
        let name = name.to_lowercase();
        // Speech recognisers spell an unfamiliar name a few ways.
        let spellings = [name.clone(), "keeper".into(), "keep her".into(), "kiper".into()];
        let Some((pos, len)) = spellings.iter().filter(|s| !s.is_empty()).find_map(|s| lower.find(s.as_str()).map(|p| (p, s.len()))) else {
            return Heard::Ignore;
        };
        let rest = text[(pos + len).min(text.len())..].trim_start_matches([',', '.', '!', '?', ' ']).trim();
        if rest.is_empty() {
            self.awaiting = true;
            Heard::Woken
        } else {
            Heard::Command(rest.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wake_word_then_command() {
        let mut w = Wake::default();
        assert_eq!(w.hear("so I was saying to her", "Umoja"), Heard::Ignore);
        assert_eq!(w.hear("Hey Umoja, what time is it?", "Umoja"), Heard::Command("what time is it?".into()));
        assert_eq!(w.hear("Umoja", "Umoja"), Heard::Woken);
        assert_eq!(w.hear("remind me to pray at 6 pm", "Umoja"), Heard::Command("remind me to pray at 6 pm".into()));
        assert_eq!(w.hear("open Notes", "Umoja"), Heard::Ignore);
    }
}
