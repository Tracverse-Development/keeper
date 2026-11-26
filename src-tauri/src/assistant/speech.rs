//! Speaking a reply before it is finished: the first whole sentence of the live text is spoken
//! as soon as it is written (about half a second sooner for a short reply, a second or two for a
//! long one), and the window queues the rest after it (`usePanelActions`, `unsaid`).

/// Shortest first sentence worth speaking alone ("Okay." waits for more).
const MIN_CHARS: usize = 20;
/// Abbreviations whose full stop does not end a sentence.
const ABBREVIATIONS: [&str; 8] = ["dr.", "mr.", "mrs.", "ms.", "st.", "e.g.", "i.e.", "vs."];

/// The first complete sentence of `text` (its end mark followed by a space), if there is one
/// long enough.
pub fn first_sentence(text: &str) -> Option<String> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    for (i, &(at, c)) in chars.iter().enumerate() {
        if !matches!(c, '.' | '!' | '?') || !chars.get(i + 1).is_some_and(|(_, n)| n.is_whitespace()) {
            continue;
        }
        let sentence = text[..at + c.len_utf8()].trim();
        let last_word = sentence.rsplit(char::is_whitespace).next().unwrap_or("").to_lowercase();
        let decimal = chars.get(i.wrapping_sub(1)).is_some_and(|(_, p)| p.is_ascii_digit()) && chars.get(i + 2).is_some_and(|(_, n)| n.is_ascii_digit());
        if sentence.chars().count() >= MIN_CHARS && !ABBREVIATIONS.contains(&last_word.as_str()) && !decimal {
            return Some(sentence.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::first_sentence;

    #[test]
    fn the_first_whole_sentence_only() {
        assert_eq!(first_sentence("The capital of Japan is Tokyo. It is").as_deref(), Some("The capital of Japan is Tokyo."));
        assert_eq!(first_sentence("The capital of Japan is Tokyo."), None, "not finished until a space follows");
        assert_eq!(first_sentence("Okay. Your dog is called Rex. And"), Some("Okay. Your dog is called Rex.".into()), "too short alone, so it waits");
        assert_eq!(first_sentence("Ask Dr. Smith about the clot today? Then"), Some("Ask Dr. Smith about the clot today?".into()));
        assert_eq!(first_sentence("Is it really working well now! Yes"), Some("Is it really working well now!".into()));
    }
}
