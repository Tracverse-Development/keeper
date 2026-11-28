//! Finding one real YouTube video for what the person asked to watch. The only outside call is
//! the search they asked for: `https://www.youtube.com/results?search_query=…` over HTTPS, no
//! cookies kept, no account, a few seconds at most. The results page carries its data as JSON
//! (`var ytInitialData = {…};`); [`parse_results`] reads the videos out of it (pure, tested on a
//! saved, trimmed page in `testdata/`), and [`best`] picks one plus two alternatives.

use std::time::Duration;

use crate::kernel::{DeskError, Result};

/// Where a search is asked.
const SEARCH: &str = "https://www.youtube.com/results";
/// The longest search sent.
const MAX_QUERY: usize = 100;
/// How long the search may take before the keeper says it could not reach YouTube.
const TIMEOUT: Duration = Duration::from_secs(6);
/// A "short" video runs at most this long (when the person asked for a short one).
const SHORT_SECONDS: u32 = 6 * 60;
/// Videos read from one results page (the first few are the ones worth offering).
const MAX_RESULTS: usize = 12;
/// A plain desktop browser's name: the results page is the same for every visitor that sends it.
const BROWSER: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/// What a result is: an ordinary video, a live stream (or one yet to start), or a Short.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Video,
    Live,
    Short,
}

/// One video on a results page.
#[derive(Debug, Clone, PartialEq)]
pub struct Found {
    /// YouTube's id for it (`Gu_u8HymQPw`).
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    /// As YouTube writes it ("4:08", "1:02:03"); None for a live stream.
    pub length: Option<String>,
    pub kind: Kind,
}

impl Found {
    /// Its watch address (the window turns it into the privacy-enhanced player).
    pub fn watch_url(&self) -> String {
        format!("https://www.youtube.com/watch?v={}", self.id)
    }

    /// How long it runs, in seconds (None when the page gave no length).
    pub fn seconds(&self) -> Option<u32> {
        let parts: Vec<u32> = self.length.as_deref()?.split(':').map(|p| p.trim().parse().ok()).collect::<Option<_>>()?;
        (!parts.is_empty() && parts.len() <= 3).then(|| parts.iter().fold(0, |total, p| total * 60 + p))
    }
}

/// The person's words as a search: "show me a short video on how to tie a tie" becomes "how to
/// tie a tie". The asking ("show me a video about") is dropped, punctuation that is not part of
/// a word goes, spaces collapse, at most [`MAX_QUERY`] characters. None when nothing is left.
pub fn clean_query(raw: &str) -> Option<String> {
    let lead = regex::Regex::new(r"(?i)^\s*(please\s+)?((can|could|would)\s+you\s+)?((show|play|find|get|pull\s+up|put\s+on)(\s+me)?\s+)?((a|an|the|some)\s+)?((short|quick|brief|little|good|youtube)\s+)*(videos?|clips?|films?)\s+((on|about|of|showing|explaining|for|that\s+shows)\s+)?").ok()?;
    let asked = lead.replace(raw.trim(), "");
    let kept: String = asked.chars().map(|c| if c.is_alphanumeric() || " '-&+".contains(c) { c } else { ' ' }).collect();
    let words: Vec<&str> = kept.split_whitespace().filter(|w| !w.starts_with('-')).collect();
    let mut query = String::new();
    for word in words {
        if query.chars().count() + word.chars().count() + 1 > MAX_QUERY {
            break;
        }
        if !query.is_empty() {
            query.push(' ');
        }
        query.push_str(word);
    }
    (!query.is_empty()).then_some(query)
}

/// The results page address for a cleaned query.
pub fn search_url(query: &str) -> String {
    tauri::Url::parse_with_params(SEARCH, &[("search_query", query)]).map(|u| u.to_string()).unwrap_or_else(|_| SEARCH.to_string())
}

/// The text of a YouTube text object (`{"simpleText": …}` or `{"runs": [{"text": …}]}`).
fn text_of(v: &serde_json::Value) -> Option<String> {
    let text = match v.get("simpleText").and_then(|t| t.as_str()) {
        Some(s) => s.to_string(),
        None => v.get("runs")?.as_array()?.iter().filter_map(|r| r.get("text")?.as_str()).collect(),
    };
    let text = text.trim().to_string();
    (!text.is_empty()).then_some(text)
}

/// One `videoRenderer` as a [`Found`] (None without an id or a title).
fn found(v: &serde_json::Value) -> Option<Found> {
    let id = v.get("videoId")?.as_str()?;
    if id.len() < 6 || id.len() > 20 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return None;
    }
    let title = text_of(v.get("title")?)?;
    let channel = v.get("ownerText").or_else(|| v.get("longBylineText")).and_then(text_of);
    let length = v.get("lengthText").and_then(text_of);
    let path = v.pointer("/navigationEndpoint/commandMetadata/webCommandMetadata/url").and_then(|u| u.as_str()).unwrap_or_default();
    let live_badge = v.get("badges").and_then(|b| b.as_array()).is_some_and(|b| b.iter().any(|b| b.pointer("/metadataBadgeRenderer/style").and_then(|s| s.as_str()).is_some_and(|s| s.contains("LIVE"))));
    let kind = if path.starts_with("/shorts/") {
        Kind::Short
    } else if live_badge || length.is_none() || v.get("upcomingEventData").is_some() {
        Kind::Live
    } else {
        Kind::Video
    };
    Some(Found { id: id.to_string(), title, channel, length, kind })
}

/// Every `videoRenderer` in the page data, in page order.
fn collect(v: &serde_json::Value, out: &mut Vec<Found>) {
    if out.len() >= MAX_RESULTS {
        return;
    }
    match v {
        serde_json::Value::Object(map) => {
            for (key, value) in map {
                if key == "videoRenderer" {
                    if let Some(f) = found(value).filter(|f| !out.iter().any(|o| o.id == f.id)) {
                        out.push(f);
                    }
                } else {
                    collect(value, out);
                }
            }
        }
        serde_json::Value::Array(items) => items.iter().for_each(|i| collect(i, out)),
        _ => {}
    }
}

/// The videos on a results page, in page order (at most [`MAX_RESULTS`]); empty when the page
/// carries no readable data (YouTube changed its page, or answered with something else).
pub fn parse_results(html: &str) -> Vec<Found> {
    const MARK: &str = "var ytInitialData = ";
    let Some(start) = html.find(MARK) else { return Vec::new() };
    // Read exactly one JSON value from the marker: whatever follows it (`;</script>`) is ignored.
    let mut values = serde_json::Deserializer::from_str(&html[start + MARK.len()..]).into_iter::<serde_json::Value>();
    let Some(Ok(data)) = values.next() else { return Vec::new() };
    let mut out = Vec::new();
    collect(&data, &mut out);
    out
}

/// The video to play first and up to two others: ordinary videos before live streams and Shorts
/// (those only when nothing else came back); for a short one, videos under six minutes first.
/// Otherwise YouTube's own order (its best match first).
pub fn best(found: Vec<Found>, short: bool) -> Vec<Found> {
    let has_video = found.iter().any(|f| f.kind == Kind::Video);
    let mut pool: Vec<Found> = found.into_iter().filter(|f| !has_video || f.kind == Kind::Video).collect();
    if short {
        // A stable sort: within each group YouTube's order stays.
        pool.sort_by_key(|f| f.seconds().map_or(true, |s| s > SHORT_SECONDS));
    }
    pool.truncate(3);
    pool
}

/// Asks YouTube for `query` (already cleaned) and reads the results page.
pub async fn search(query: &str) -> Result<Vec<Found>> {
    let http = reqwest::Client::builder().timeout(TIMEOUT).user_agent(BROWSER).build().map_err(|_| DeskError::Io("I couldn't start a web search just now.".into()))?;
    let answer = http.get(search_url(query)).header(reqwest::header::ACCEPT_LANGUAGE, "en").send().await;
    let page = match answer {
        Ok(r) if r.status().is_success() => r.text().await.map_err(|_| DeskError::Io("YouTube stopped answering partway. Try again in a moment.".into()))?,
        Ok(_) => return Err(DeskError::Io("YouTube didn't answer the search just now. Try again in a moment.".into())),
        Err(e) if e.is_timeout() => return Err(DeskError::Io("YouTube took too long to answer. Try again in a moment.".into())),
        Err(_) => return Err(DeskError::Io("I couldn't reach YouTube. Is the internet connected?".into())),
    };
    Ok(parse_results(&page))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAGE: &str = include_str!("testdata/youtube-search-tie.html");

    #[test]
    fn a_results_page_yields_its_videos_in_order_with_kinds() {
        let found = parse_results(PAGE);
        let ids: Vec<&str> = found.iter().map(|f| f.id.as_str()).collect();
        assert_eq!(ids, ["rFZHOHl-L8A", "wMBSiulOvDI", "Gu_u8HymQPw", "GkjAuVW7eds", "-of_bYwrHGk", "SmAP_ikzifY", "-syZ_H6iec0"], "the Shorts shelf and the later script are not results");
        assert_eq!(found[0].kind, Kind::Live);
        assert_eq!(found[0].length, None);
        assert_eq!(found[1].kind, Kind::Short);
        let first = &found[2];
        assert_eq!(first.kind, Kind::Video);
        assert_eq!(first.title, "How to Tie a Four-In-Hand Knot | Men's Fashion");
        assert_eq!(first.channel.as_deref(), Some("Howcast"));
        assert_eq!(first.length.as_deref(), Some("1:24"));
        assert_eq!(first.watch_url(), "https://www.youtube.com/watch?v=Gu_u8HymQPw");
    }

    #[test]
    fn the_best_is_an_ordinary_video_and_short_prefers_short_ones() {
        let picked = best(parse_results(PAGE), false);
        assert_eq!(picked.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(), ["Gu_u8HymQPw", "GkjAuVW7eds", "-of_bYwrHGk"], "no live stream, no Short");
        let long = |id: &str, length: &str| Found { id: id.into(), title: id.into(), channel: None, length: Some(length.into()), kind: Kind::Video };
        let short = best(vec![long("aaaaaa", "12:00"), long("bbbbbb", "4:10"), long("cccccc", "1:02:00"), long("dddddd", "2:00")], true);
        assert_eq!(short.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(), ["bbbbbb", "dddddd", "aaaaaa"]);
        let only_live = vec![Found { kind: Kind::Live, length: None, ..long("eeeeee", "") }];
        assert_eq!(best(only_live, false).len(), 1, "a live stream when nothing else came back");
    }

    #[test]
    fn lengths_read_as_seconds() {
        let at = |length: &str| Found { id: "x".into(), title: "x".into(), channel: None, length: Some(length.into()), kind: Kind::Video }.seconds();
        assert_eq!(at("1:24"), Some(84));
        assert_eq!(at("1:02:03"), Some(3723));
        assert_eq!(at("LIVE"), None);
    }

    #[test]
    fn a_page_without_data_yields_nothing() {
        assert!(parse_results("<html>consent page</html>").is_empty());
        assert!(parse_results("var ytInitialData = {broken").is_empty());
        assert!(parse_results(r#"var ytInitialData = {"videoRenderer": {"videoId": "bad id!", "title": {"simpleText": "x"}}};"#).is_empty());
    }

    #[test]
    fn the_asking_is_dropped_from_the_search() {
        assert_eq!(clean_query("Show me a video on how to tie a tie").as_deref(), Some("how to tie a tie"));
        assert_eq!(clean_query("play a short video about how volcanoes erupt").as_deref(), Some("how volcanoes erupt"));
        assert_eq!(clean_query("how to tie a tie four in hand").as_deref(), Some("how to tie a tie four in hand"));
        assert_eq!(clean_query("a video of \"cats\" <script>").as_deref(), Some("cats script"));
        assert_eq!(clean_query("--flag volcano").as_deref(), Some("volcano"));
        assert_eq!(clean_query("  ?!  "), None);
        assert!(clean_query(&"word ".repeat(60)).unwrap().len() <= MAX_QUERY);
    }

    #[test]
    fn the_search_address_is_youtube_with_the_query_encoded() {
        assert_eq!(search_url("how to tie a tie & more"), "https://www.youtube.com/results?search_query=how+to+tie+a+tie+%26+more");
    }
}
