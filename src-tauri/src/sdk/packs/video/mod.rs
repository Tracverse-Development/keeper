//! Videos inside Keeper: one real YouTube video for what the person wants to watch
//! (`find-video`, through `youtube`), and videos or songs on this computer (`play-file`,
//! `find-movies`, through `local`). Every one shows a `media` panel that plays in place, and
//! nothing plays until the person presses Play. "Show me a video on how to tie a tie" finds one
//! with no mind (`words`).

pub mod local;
mod words;
pub mod youtube;

use super::super::{input, Ability, Access, Cx, Done, Instant, ALL};
use crate::kernel::{DeskError, Result};
use crate::stage::panel::MediaChoice;
use crate::stage::Panel;

pub const ABILITIES: &[Ability] = &[
    Ability {
        id: "find-video",
        how: "{\"query\": \"how to tie a tie four in hand\", \"short\": true} finds ONE real YouTube video and shows it playing in place (with two others to swap to); use it whenever the person wants to watch or see a video, never a search link or a made-up address",
        access: Access::Look,
        platforms: ALL, modes: &["assistant", "researcher", "tutor", "companion"], instant: Instant::Also(words::video_words),
        run: |input, cx| Box::pin(find_video(input, cx)),
    },
    Ability {
        id: "play-file",
        how: "{\"path\": \"~/Movies/Holiday.mp4\"} plays a video or audio file from the person's Movies, Downloads, Desktop, Documents or Music folder inside Keeper",
        access: Access::Look,
        platforms: ALL, modes: &["assistant"], instant: Instant::No,
        run: |input, cx| Box::pin(local::play_file(input, cx)),
    },
    Ability {
        id: "find-movies",
        how: "{\"name\": \"holiday\"} lists the videos on this computer (name optional), newest first, ready to play inside Keeper",
        access: Access::Look,
        platforms: ALL, modes: &["assistant"], instant: Instant::Also(movies_words),
        run: |input, cx| Box::pin(local::find_movies(input, cx)),
    },
];

/// The panel that plays a found video, with the others as choices.
pub fn video_panel(best: &youtube::Found, others: &[youtube::Found]) -> Option<Panel> {
    let choices = others.iter().map(|f| MediaChoice { title: f.title.clone(), url: f.watch_url(), path: None, channel: f.channel.clone(), length: f.length.clone() }).collect();
    crate::stage::checked(Panel::Media {
        id: format!("video-{}", best.id),
        title: best.title.clone(),
        url: best.watch_url(),
        caption: None,
        path: None,
        channel: best.channel.clone(),
        length: best.length.clone(),
        choices,
    })
}

/// When no video could be read from the page: the search itself, to open in the browser.
fn search_panel(query: &str) -> Option<Panel> {
    crate::stage::checked(Panel::Web { id: "video-search".into(), title: format!("YouTube: {query}"), url: youtube::search_url(query), summary: Some("I couldn't pick out one video, so here is the search.".into()) })
}

async fn find_video(input: &serde_json::Value, _cx: &Cx<'_>) -> Result<Done> {
    let query = youtube::clean_query(input::text(input, "query")?).ok_or_else(|| DeskError::Invalid("Tell me what the video should be about.".into()))?;
    let short = input.get("short").and_then(|s| s.as_bool()).unwrap_or(false);
    let picked = youtube::best(youtube::search(&query).await?, short);
    let Some((best, others)) = picked.split_first() else {
        let done = Done::said(format!("I couldn't pick out one video for {query}, so here is the YouTube search."));
        return Ok(match search_panel(&query) {
            Some(panel) => done.showing(panel),
            None => done,
        });
    };
    let panel = video_panel(best, others).ok_or_else(|| DeskError::Invalid("I found a video but can't show it.".into()))?;
    let by = best.channel.as_deref().map(|c| format!(" from {c}")).unwrap_or_default();
    let runs = best.length.as_deref().map(|l| format!(", {l} long")).unwrap_or_default();
    Ok(Done::said(format!("Here's \"{}\"{by}{runs}. Press Play when you're ready.", best.title)).showing(panel))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_found_video_becomes_a_panel_with_its_alternatives() {
        let picked = youtube::best(youtube::parse_results(include_str!("testdata/youtube-search-tie.html")), true);
        let Some(Panel::Media { id, title, url, channel, length, choices, path, .. }) = video_panel(&picked[0], &picked[1..]) else { panic!("a media panel") };
        assert_eq!(id, "video-Gu_u8HymQPw");
        assert_eq!(title, "How to Tie a Four-In-Hand Knot | Men's Fashion");
        assert_eq!(url, "https://www.youtube.com/watch?v=Gu_u8HymQPw");
        assert_eq!((channel.as_deref(), length.as_deref()), (Some("Howcast"), Some("1:24")));
        assert!(path.is_none());
        assert_eq!(choices.len(), 2);
        assert_eq!(choices[0].url, "https://www.youtube.com/watch?v=GkjAuVW7eds");
    }

    #[test]
    fn nothing_readable_falls_back_to_the_search_page() {
        let Some(Panel::Web { url, .. }) = search_panel("how volcanoes erupt") else { panic!("a web panel") };
        assert_eq!(url, "https://www.youtube.com/results?search_query=how+volcanoes+erupt");
    }

    /// The real search, from this Mac (search words only): `cargo test live_youtube -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_youtube_search_finds_a_video() {
        for (q, short) in [("how to tie a tie four in hand", false), ("how volcanoes erupt", true)] {
            let found = youtube::best(youtube::search(q).await.unwrap(), short);
            println!("{q}: {:?}", found.iter().map(|f| (&f.title, &f.channel, &f.length)).collect::<Vec<_>>());
            assert!(!found.is_empty(), "{q} found nothing");
        }
    }
}

/// "Find my movies", "show me my videos", "play my films": the person's own videos, newest first.
const MOVIES_ASKS: &str = r"(?i)^(?:please\s+)?(?:find|show(?: me)?|list|play|where are)\s+my\s+(?:home\s+)?(?:movies|videos|films)\s*[?.!]?$";

fn movies_words(said: &str) -> Option<serde_json::Value> {
    static R: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    crate::sdk::instant::whole(&R, MOVIES_ASKS, said)
}

/// The words that mean the person's videos, not a file by that name ("find my movies").
pub fn is_movies_word(name: &str) -> bool {
    matches!(name.trim().to_lowercase().as_str(), "movies" | "videos" | "films" | "home movies" | "home videos")
}
