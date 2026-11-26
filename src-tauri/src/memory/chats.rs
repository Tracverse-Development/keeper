//! A keeper's chats beyond listing them: rename one, pin one to the top, and search across
//! every conversation for the words the person remembers. Commands: `chat_change`,
//! `chats_search`.

use serde::Serialize;
use tauri::State;

use super::records::{Chat, Record, Turn};
use super::Memory;
use crate::kernel::{DeskError, Result};
use crate::state::AppState;

const MAX_TITLE: usize = 60;
/// How many chats a search answers with.
const MOST_FOUND: usize = 20;
const SNIPPET: usize = 120;
/// How many of the latest exchanges a search reads.
const SEARCHED: usize = 400;
const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX prov: <http://www.w3.org/ns/prov#> ";

/// A chat's title as kept: single spaces, no control characters, a sane length; None when empty.
pub fn clean_title(title: &str) -> Option<String> {
    let t: String = title.split_whitespace().collect::<Vec<_>>().join(" ").chars().filter(|c| !c.is_control()).take(MAX_TITLE).collect();
    (!t.is_empty()).then_some(t)
}

/// One chat a search found, with the line that matched.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Found {
    pub chat: String,
    pub title: String,
    /// The matching words in their sentence (what the person said, or the keeper answered).
    pub snippet: String,
    pub at: String,
}

/// The words of a search (two characters or more, lower case).
fn search_words(query: &str) -> Vec<String> {
    query.to_lowercase().split_whitespace().filter(|w| w.chars().count() >= 2).map(str::to_string).collect()
}

/// The part of `text` around the first of `words`, clipped to a line.
fn snippet(text: &str, words: &[String]) -> String {
    let lower = text.to_lowercase();
    let at = words.iter().filter_map(|w| lower.find(w.as_str())).min().unwrap_or(0);
    // Step back to a character boundary of the original text (lower-casing can change byte lengths).
    let mut start = at.min(text.len()).saturating_sub(40);
    while start > 0 && !text.is_char_boundary(start) {
        start -= 1;
    }
    let cut: String = text[start..].chars().take(SNIPPET).collect();
    let cut = cut.split_whitespace().collect::<Vec<_>>().join(" ");
    format!("{}{cut}{}", if start > 0 { "…" } else { "" }, if text[start..].chars().count() > SNIPPET { "…" } else { "" })
}

/// The chats whose turns hold EVERY word of the search (in what was said or answered), newest
/// match first, one line per chat. Pure: the turns and chats are passed in.
pub fn find(turns: &[Turn], chats: &[Chat], query: &str) -> Vec<Found> {
    let words = search_words(query);
    if words.is_empty() {
        return vec![];
    }
    let mut out: Vec<Found> = Vec::new();
    for t in turns {
        let both = format!("{} {}", t.said, t.replied).to_lowercase();
        if t.chat.is_empty() || !words.iter().all(|w| both.contains(w.as_str())) || out.iter().any(|f| f.chat == t.chat) {
            continue;
        }
        let Some(chat) = chats.iter().find(|c| c.id == t.chat) else { continue };
        let source = if words.iter().any(|w| t.said.to_lowercase().contains(w.as_str())) { &t.said } else { &t.replied };
        out.push(Found { chat: chat.id.clone(), title: chat.title.clone(), snippet: snippet(source, &words), at: t.at.clone() });
        if out.len() >= MOST_FOUND {
            break;
        }
    }
    out
}

impl Memory {
    /// Rename a chat and/or pin it (left out = unchanged). The chat's record is replaced under
    /// its own name; if the node cannot take the new one right away it waits in the outbox, so
    /// a chat is never lost by renaming it.
    pub async fn change_chat(&self, id: &str, title: Option<&str>, pinned: Option<bool>) -> Result<Chat> {
        let chat = self.chats().await?.into_iter().find(|c| c.id == id).ok_or_else(|| DeskError::Invalid("That chat does not exist.".into()))?;
        let title = match title {
            Some(t) => clean_title(t).ok_or_else(|| DeskError::Invalid("A chat needs a name.".into()))?,
            None => chat.title.clone(),
        };
        let changed = Chat { title, pinned: pinned.unwrap_or(chat.pinned), ..chat };
        self.client().discard(self.place(), &changed.asset_name()).await?;
        self.write(&changed).await;
        Ok(changed)
    }

    /// Search this keeper's conversations (its latest four hundred exchanges) for `query`.
    /// One bounded read naming its class, each exchange with the chat it belongs to.
    pub async fn search_chats(&self, query: &str) -> Result<Vec<Found>> {
        if search_words(query).is_empty() {
            return Ok(vec![]);
        }
        let sparql = format!("{PREFIXES}SELECT ?said ?replied ?at ?chat WHERE {{ ?t a desk:Turn ; desk:said ?said ; desk:replied ?replied ; prov:generatedAtTime ?at ; desk:inChat ?chat }} ORDER BY DESC(?at) LIMIT {SEARCHED}");
        let rows = self.client().query(self.place(), &sparql, crate::dkg::Layer::Working).await?;
        let cell = |r: &crate::dkg::Row, k: &str| r.get(k).cloned().unwrap_or_default();
        let turns: Vec<Turn> = rows.iter().map(|r| Turn::new(&cell(r, "said"), &cell(r, "replied"), "", &cell(r, "at"), cell(r, "chat").rsplit(':').next().unwrap_or_default())).collect();
        Ok(find(&turns, &self.chats().await?, query))
    }
}

fn chat_id(chat: &str) -> Result<()> {
    if chat.is_empty() || chat.len() > 32 || !chat.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(DeskError::Invalid("That isn't a chat id.".into()));
    }
    Ok(())
}

/// Rename and/or pin a chat (a field left out is unchanged).
#[tauri::command]
pub async fn chat_change(state: State<'_, AppState>, keeper: Option<String>, chat: String, title: Option<String>, pinned: Option<bool>) -> Result<Chat> {
    chat_id(&chat)?;
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.change_chat(&chat, title.as_deref(), pinned).await
}

/// Search a keeper's conversations.
#[tauri::command]
pub async fn chats_search(state: State<'_, AppState>, keeper: Option<String>, query: String) -> Result<Vec<Found>> {
    let query: String = query.chars().take(100).collect();
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)?.search_chats(&query).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(said: &str, replied: &str, chat: &str, at: &str) -> Turn {
        Turn::new(said, replied, "claude", at, chat)
    }

    fn chat(id: &str, title: &str) -> Chat {
        Chat { id: id.into(), title: title.into(), at: "2026-11-20T10:00:00Z".into(), pinned: false }
    }

    #[test]
    fn a_search_finds_chats_holding_every_word_once_each() {
        let turns = vec![
            turn("How do I cook rice for six?", "Use two cups of water per cup of rice.", "c1", "2026-11-26T10:00:00Z"),
            turn("And brown rice?", "Brown rice needs longer.", "c1", "2026-11-26T10:01:00Z"),
            turn("Plan my trip to Tobago", "Fly on Friday; the ferry is slower.", "c2", "2026-11-25T10:00:00Z"),
        ];
        let chats = vec![chat("c1", "Cooking rice"), chat("c2", "Tobago trip")];
        let found = find(&turns, &chats, "rice water");
        assert_eq!(found.len(), 1, "one line per chat");
        assert_eq!((found[0].chat.as_str(), found[0].title.as_str()), ("c1", "Cooking rice"));
        assert!(find(&turns, &chats, "FERRY")[0].snippet.contains("ferry"), "found in the keeper's answer, any letter case");
        assert!(find(&turns, &chats, "rice ferry").is_empty(), "every word must be in the same exchange");
        assert!(find(&turns, &chats, " a ").is_empty(), "nothing to search for");
    }

    #[test]
    fn a_long_exchange_is_shown_around_the_match_and_titles_are_cleaned() {
        let long = format!("{} the mango chow recipe {}", "words ".repeat(60), "more ".repeat(60));
        let s = snippet(&long, &["mango".into()]);
        assert!(s.contains("mango") && s.starts_with('…') && s.ends_with('…') && s.chars().count() <= SNIPPET + 2);
        assert_eq!(snippet("Ça va très bien, merci", &["merci".into()]), "Ça va très bien, merci", "accents do not break the cut");
        assert_eq!(clean_title("  Trip   to\nTobago  ").as_deref(), Some("Trip to Tobago"));
        assert_eq!(clean_title("   "), None);
        assert_eq!(clean_title(&"x".repeat(200)).unwrap().chars().count(), MAX_TITLE);
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::{node, DkgClient, Place};

    /// The real node, in a sub-graph: a chat is renamed and pinned without losing its turns,
    /// and a search finds it by words from the conversation.
    /// `cargo test --lib live_chats -- --ignored` (writes only to `umoja-desk-chattest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_chats_rename_pin_and_search() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = format!("umoja-desk-chattest-{}", chrono::Utc::now().timestamp_millis());
        client.ensure_graph(&graph, "chat test").await.unwrap();
        client.ensure_sub_graph(&graph, "keeper-t").await.unwrap();
        let memory = Memory::at(client, Place::new(&graph, Some("keeper-t")));
        let at = crate::kernel::time::now_iso();
        let chat = Chat::start("How do I cook rice for six?", &at);
        memory.write(&chat).await;
        memory.write(&Turn::new("How do I cook rice for six?", "Use two cups of water per cup of rice.", "claude", &at, &chat.id)).await;
        let changed = memory.change_chat(&chat.id, Some("  Cooking   rice "), Some(true)).await.unwrap();
        assert_eq!((changed.title.as_str(), changed.pinned), ("Cooking rice", true));
        let listed = memory.chats().await.unwrap();
        assert_eq!(listed.len(), 1, "renamed in place, not copied");
        assert_eq!((listed[0].title.as_str(), listed[0].pinned, listed[0].id.as_str()), ("Cooking rice", true, chat.id.as_str()));
        assert_eq!(memory.chat_turns(&chat.id).await.unwrap().len(), 1, "its turns still belong to it");
        let unpinned = memory.change_chat(&chat.id, None, Some(false)).await.unwrap();
        assert_eq!((unpinned.title.as_str(), unpinned.pinned), ("Cooking rice", false), "a field left out is unchanged");
        let found = memory.search_chats("water rice").await.unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].title, "Cooking rice");
        assert!(memory.change_chat("0000000000000000", Some("x"), None).await.is_err(), "no such chat");
    }
}
