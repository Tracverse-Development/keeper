//! Finding the person's things, instantly (instant-only abilities: only these words run them,
//! in every mode, with no mind):
//!
//! - `find-files`   "find my NZCC deck", "where did I save my resume": Spotlight, shown as files
//! - `show-folder`  "where is my Downloads folder", "what's in my Desktop": a live folder view
//! - `open-folder`  "open my documents": the folder opened in the file manager, and its view
//!
//! A folder view shows the newest entries first (at most 30, hidden files left out).

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

use super::super::super::{input, instant, Ability, Access, Done, Instant, ALL};
use crate::kernel::{DeskError, Result};

pub const ABILITIES: &[Ability] = &[
    // First: "where is my Downloads" is the folder, not a Spotlight search for "Downloads".
    Ability {
        id: "show-folder",
        how: "\"where is my Downloads folder\", \"what's in my Desktop\": a known folder as a live folder view, newest first",
        access: Access::Look,
        platforms: ALL, modes: &[], instant: Instant::Only(show_words),
        run: |input, _| Box::pin(async move { Ok(view(&folder(input)?, false)) }),
    },
    Ability {
        id: "find-files",
        how: "\"find my NZCC deck\", \"where did I save my resume\": files by name (Spotlight), shown as a files panel",
        access: Access::Look,
        platforms: ALL, modes: &[], instant: Instant::Only(find_words),
        run: |input, _| Box::pin(find(input)),
    },
    Ability {
        id: "open-folder",
        how: "\"open my documents\": a known folder opened in the file manager, and shown as a folder view",
        access: Access::Open,
        platforms: ALL, modes: &[], instant: Instant::Only(open_words),
        run: |input, _| Box::pin(async move { open(input) }),
    },
];

/// Folders shown by name; "photos" and "videos" are the Pictures and Movies folders.
const SHOW_ASKS: &str = r"(?i)^(?:please\s+)?(?:where(?:'s| is)|show(?: me)?|what(?:'s| is) in)\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|photos|music|movies|videos|home)(?:\s+folder)?\s*[?.]?$";
/// "find MY …": "find the area of a circle" is maths, for the mind.
const FIND_ASKS: &str = r"(?i)^(?:please\s+)?(?:find|locate|where(?:'s| is| are| did i (?:put|save)))\s+my\s+(.{2,80}?)\s*\??$";
const OPEN_ASKS: &str = r"(?i)^(?:please\s+)?open\s+(?:my\s+|the\s+)?(downloads|documents|desktop|pictures|music|movies|home)(?:\s+folder)?\s*\.?$";

/// How many entries a folder view shows.
const SHOWN: usize = 30;
/// How many Spotlight matches are shown.
const FOUND: usize = 8;

fn show_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::pattern(&R, SHOW_ASKS).captures(said).map(|c| json!({ "folder": c[1].to_lowercase() }))
}

fn find_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    let c = instant::pattern(&R, FIND_ASKS).captures(said)?;
    let name = c[1].trim_end_matches(" file").trim_end_matches(" files");
    // "find my movies" is the person's videos (the video pack's find-movies), never files named "movies".
    if super::super::video::is_movies_word(name) {
        return None;
    }
    Some(json!({ "name": name }))
}

fn open_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::pattern(&R, OPEN_ASKS).captures(said).map(|c| json!({ "folder": c[1].to_lowercase() }))
}

/// The person's well-known folder for a word ("downloads", "desktop"…).
pub fn known(word: &str) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let name = match word.to_lowercase().as_str() {
        "home" => return Some(home),
        "downloads" => "Downloads",
        "documents" => "Documents",
        "desktop" => "Desktop",
        "pictures" | "photos" => "Pictures",
        "music" => "Music",
        "movies" | "videos" => "Movies",
        _ => return None,
    };
    Some(home.join(name))
}

fn folder(input: &serde_json::Value) -> Result<PathBuf> {
    let word = input::text(input, "folder")?;
    known(word).ok_or_else(|| DeskError::Invalid(format!("I don't know a folder called {word}.")))
}

async fn find(input: &serde_json::Value) -> Result<Done> {
    let query = input::text(input, "name")?;
    let hits = crate::pim::find_files(query, FOUND).await?;
    let Some(first) = hits.first() else { return Ok(Done::said(format!("I couldn't find anything called {query} on this computer."))) };
    let items: Vec<_> = hits.iter().map(|h| json!({ "action": "find", "path": h.path })).collect();
    let said = format!("Found {} match{}. The best one is {}.", hits.len(), if hits.len() == 1 { "" } else { "es" }, first.name);
    Ok(Done::said(said).showing_raw(json!([{ "kind": "files", "title": format!("Looking for {query}"), "items": items }])))
}

fn open(input: &serde_json::Value) -> Result<Done> {
    let path = folder(input)?;
    crate::platform::open_url(&path.display().to_string())?;
    Ok(view(&path, true))
}

/// A folder view of `path`: its newest entries, and a sentence saying where it is (`opened`: it
/// was just opened in the file manager).
fn view(path: &Path, opened: bool) -> Done {
    let mut entries: Vec<(std::time::SystemTime, String, bool)> = std::fs::read_dir(path)
        .map(|rd| {
            rd.flatten()
                .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .filter_map(|e| {
                    let meta = e.metadata().ok()?;
                    Some((meta.modified().unwrap_or(std::time::UNIX_EPOCH), e.file_name().to_string_lossy().to_string(), meta.is_dir()))
                })
                .collect()
        })
        .unwrap_or_default();
    entries.sort_by(|a, b| b.0.cmp(&a.0));
    let total = entries.len();
    let shown: Vec<_> = entries.iter().take(SHOWN).map(|(_, name, dir)| json!({ "name": name, "kind": if *dir { "folder" } else { "file" }, "change": "kept" })).collect();
    let display = path.display().to_string().replace(&dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default(), "~");
    let said = match (opened, total) {
        (true, _) => format!("Opened {display}. It holds {total} item{}.", if total == 1 { "" } else { "s" }),
        (false, 0) => format!("It's at {display}, and it's empty."),
        (false, n) => format!("It's at {display}. Here are the newest of its {n} item{}.", if n == 1 { "" } else { "s" }),
    };
    let panels = if shown.is_empty() { json!([]) } else { json!([{ "kind": "folder", "title": display, "path": display, "entries": shown }]) };
    Done::said(said).showing_raw(panels)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn well_known_folders_are_found_by_their_everyday_names() {
        assert!(known("Downloads").unwrap().ends_with("Downloads"));
        assert!(known("photos").unwrap().ends_with("Pictures"));
        assert!(known("taxes").is_none());
    }

    #[test]
    fn only_clear_phrasings_skip_the_mind() {
        assert_eq!(find_words("Where did I save my NZCC deck?").unwrap()["name"], "NZCC deck");
        assert_eq!(find_words("find my tax files").unwrap()["name"], "tax");
        assert!(find_words("find the area of a circle").is_none(), "maths goes to the mind");
        assert_eq!(show_words("where is my Downloads folder").unwrap()["folder"], "downloads");
        assert_eq!(open_words("Open the documents folder.").unwrap()["folder"], "documents");
        assert!(open_words("open my photos").is_none(), "only the folders the file manager opens by name");
    }

    #[test]
    fn a_folder_view_lists_the_newest_entries_and_says_where() {
        let dir = std::env::temp_dir().join(format!("keeper-folder-view-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("a.txt"), "x").unwrap();
        std::fs::write(dir.join(".hidden"), "x").unwrap();
        let done = view(&dir, false);
        assert!(done.summary.ends_with("Here are the newest of its 2 items."), "{}", done.summary);
        assert!(matches!(&done.panels[..], [crate::stage::Panel::Folder { entries, .. }] if entries.len() == 2), "hidden files are left out");
        std::fs::remove_dir_all(&dir).unwrap();
        assert!(view(&dir, false).summary.ends_with("and it's empty."));
    }
}
