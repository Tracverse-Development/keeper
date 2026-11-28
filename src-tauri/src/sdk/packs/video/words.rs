//! The whole phrasings that find a video with no mind (`find-video`'s `Instant::Also`):
//! "show me a video on how to tie a tie", "play a short video about volcanoes", "find a video
//! of a cat playing piano", "I want to watch a video about bees". Only "a video …" phrasings:
//! "show me how photosynthesis works" is a lesson, for the mind, and "find my videos" is the
//! person's own (`find-movies`).

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::super::instant;

const VIDEO: &str = r"(?i)^(?:please\s+)?(?:(?:can|could)\s+you\s+)?(?:show(?:\s+me)?|find(?:\s+me)?|play(?:\s+me)?|get\s+me|i\s+want\s+to\s+(?:watch|see)|let\s+me\s+(?:watch|see)|watch)\s+(?:a|an|some|one)\s+(short\s+|quick\s+)?(?:youtube\s+)?videos?\s+(?:on|about|of|for|showing|explaining)\s+(.{2,100}?)\s*[?.!]?$";

/// `{"query", "short"}` for "show me a (short) video on X".
pub fn video_words(said: &str) -> Option<Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, VIDEO).captures(said.trim())?;
    Some(json!({ "query": instant::clean(&c[2]), "short": c.get(1).is_some() }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::video_words;

    // FIX-0053: "show me a video on how to tie a tie" was opened as an app by the built-in mind.
    #[test]
    fn a_video_on_something_is_found() {
        assert_eq!(video_words("Show me a video on how to tie a tie"), Some(json!({ "query": "how to tie a tie", "short": false })));
        assert_eq!(video_words("play a short video about volcanoes."), Some(json!({ "query": "volcanoes", "short": true })));
        assert_eq!(video_words("find a video of a cat playing piano"), Some(json!({ "query": "a cat playing piano", "short": false })));
        assert_eq!(video_words("can you show me a quick video explaining fractions?"), Some(json!({ "query": "fractions", "short": true })));
        for mind in ["show me how photosynthesis works", "find my videos", "show me my videos", "make a video about my dog", "what is a video codec"] {
            assert_eq!(video_words(mind), None, "{mind}");
        }
    }
}
