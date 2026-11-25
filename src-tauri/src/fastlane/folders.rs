//! Your own folders, answered instantly: "where is my Downloads folder", "what's in my Desktop",
//! "open my documents". A known folder is shown as a live folder view on the Stage (newest
//! first, at most 30 entries, hidden files left out); "open" also opens it in the file manager.

use std::path::PathBuf;

use serde_json::json;

use crate::brain::Thought;

const SHOWN: usize = 30;

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

/// A folder view of `path`: its newest entries, and a sentence saying where it is.
pub fn view(path: &PathBuf, opened: bool) -> Thought {
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
    let reply = match (opened, total) {
        (true, _) => format!("Opened {display}. It holds {total} item{}.", if total == 1 { "" } else { "s" }),
        (false, 0) => format!("It's at {display}, and it's empty."),
        (false, n) => format!("It's at {display}. Here are the newest of its {n} item{}.", if n == 1 { "" } else { "s" }),
    };
    let panels = if shown.is_empty() { json!([]) } else { json!([{ "kind": "folder", "title": display, "path": display, "entries": shown }]) };
    Thought { reply, panels, ..Thought::default() }
}

#[cfg(test)]
mod tests {
    #[test]
    fn well_known_folders_are_found_by_their_everyday_names() {
        assert!(super::known("Downloads").unwrap().ends_with("Downloads"));
        assert!(super::known("photos").unwrap().ends_with("Pictures"));
        assert!(super::known("taxes").is_none());
    }
}
