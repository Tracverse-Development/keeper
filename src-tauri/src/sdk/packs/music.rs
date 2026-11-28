//! The person's music, by asking: play, pause, the next or the last song, and what is playing
//! (Apple Music on a Mac). Four fixed commands to the music app; nothing else is sent to it.
//!
//!   music  "pause the music", "play my music", "next song", "go back a song", "what's playing"

use std::sync::OnceLock;

use regex::Regex;
use serde_json::{json, Value};

use super::super::{input, Ability, Access, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};
use crate::platform::{self, MusicDo};

pub const ABILITIES: &[Ability] = &[Ability {
    id: "music",
    how: "{\"do\": \"pause\"} controls the person's music app: play, pause, next, previous, or now (what is playing)",
    access: Access::Change,
    platforms: MAC, modes: &["assistant"], instant: Instant::Also(music_words),
    run: |input, _| Box::pin(music(input)),
}];

const ASKS: &[(&str, &str)] = &[
    (r"(?i)^(?:please\s+)?(?:pause|stop)\s+(?:the\s+|my\s+)?(?:music|song)\s*[.!]?$", "pause"),
    (r"(?i)^(?:please\s+)?(?:play|resume|start)\s+(?:the\s+|my\s+|some\s+)?music(?:\s+again)?\s*[.!]?$|^(?:please\s+)?resume\s+(?:the\s+)?song\s*[.!]?$", "play"),
    (r"(?i)^(?:please\s+)?(?:next\s+(?:song|track)|skip\s+(?:this\s+|the\s+)?(?:song|track)|play\s+the\s+next\s+(?:song|track))\s*[.!]?$", "next"),
    (r"(?i)^(?:please\s+)?(?:previous\s+(?:song|track)|go\s+back\s+a\s+(?:song|track)|play\s+the\s+(?:last|previous)\s+(?:song|track)(?:\s+again)?)\s*[.!]?$", "previous"),
    (r"(?i)^(?:what(?:'s|\s+is)\s+(?:playing|this\s+song)|what\s+song\s+is\s+(?:this|playing))\s*[?.]?$", "now"),
];

fn music_words(said: &str) -> Option<Value> {
    static R: OnceLock<Vec<Regex>> = OnceLock::new();
    let patterns = R.get_or_init(|| ASKS.iter().map(|(p, _)| Regex::new(p).expect("music pattern")).collect());
    let said = said.trim();
    patterns.iter().zip(ASKS).find(|(r, _)| r.is_match(said)).map(|(_, (_, what))| json!({ "do": what }))
}

async fn music(input: &Value) -> Result<Done> {
    let what = match input::text(input, "do")? {
        "play" => MusicDo::Play,
        "pause" => MusicDo::Pause,
        "next" => MusicDo::Next,
        "previous" => MusicDo::Previous,
        "now" => {
            return Ok(Done::said(match platform::music_now().await {
                Some(song) => format!("That's {song}."),
                None => "Nothing is playing in Music right now.".to_string(),
            }))
        }
        _ => return Err(DeskError::Invalid("I can play, pause, skip or go back a song.".into())),
    };
    platform::music(what).await?;
    let now = if matches!(what, MusicDo::Pause) { None } else { platform::music_now().await };
    Ok(Done::said(match (what, now) {
        (MusicDo::Pause, _) => "Paused.".to_string(),
        (_, Some(song)) => format!("Playing {song}."),
        (MusicDo::Play, None) => "Music is playing.".to_string(),
        (_, None) => "Done.".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn music_by_its_everyday_words() {
        for (said, what) in [("pause the music", "pause"), ("Stop the music.", "pause"), ("play my music", "play"), ("resume the music", "play"), ("next song", "next"), ("skip this song", "next"), ("go back a song", "previous"), ("what's playing?", "now"), ("what song is this", "now")] {
            assert_eq!(music_words(said), Some(json!({ "do": what })), "{said}");
        }
        for not_music in ["play Holiday clip", "pause", "stop", "next", "play a video about bees"] {
            assert_eq!(music_words(not_music), None, "{not_music}");
        }
    }
}
