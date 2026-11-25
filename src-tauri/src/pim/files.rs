//! Files on this computer: Spotlight search by name then content (`find`), and what changed
//! lately in Desktop, Documents and Downloads (`recent`). Spotlight runs through the platform
//! seam with a 2 s limit; when it is unavailable, `recent` walks those folders (bounded) instead.
//! The person's words reach Spotlight only after `sanitise` and only inside a quoted string.

use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime};

use chrono::{DateTime, Utc};

use super::kind::kind_of;
use super::FileHit;
use crate::kernel::{time, DeskError, Result};
use crate::platform;

/// The longest query Spotlight is given.
pub const MAX_QUERY: usize = 200;
/// The most hits a caller may ask for.
pub const MAX_LIMIT: usize = 50;
/// How long one Spotlight query may take before we answer with what arrived.
const SPOTLIGHT_TIME: Duration = Duration::from_secs(2);
/// Paths read per Spotlight query (ranking needs a few more than the limit).
const SPOTLIGHT_MAX: usize = 300;
/// The fallback walk: how deep and how many entries at most.
const WALK_DEPTH: usize = 4;
const WALK_ENTRIES: usize = 5000;

/// The query as Spotlight may see it: control characters become spaces, the characters that
/// could end or widen the quoted string (`"`, `\`, `*`, `?`) are dropped, leading dashes are
/// removed, spaces collapsed, at most `MAX_QUERY` characters. None when nothing is left.
pub fn sanitise(query: &str) -> Option<String> {
    let kept: String = query.chars().filter(|c| !matches!(c, '"' | '\\' | '*' | '?')).map(|c| if c.is_control() { ' ' } else { c }).collect();
    let words: Vec<&str> = kept.split_whitespace().collect();
    let joined = words.join(" ");
    let trimmed = joined.trim_start_matches(|c: char| c == '-' || c.is_whitespace());
    let capped: String = trimmed.chars().take(MAX_QUERY).collect();
    let capped = capped.trim_end().to_string();
    (!capped.is_empty()).then_some(capped)
}

/// Spotlight: the name contains the query (case and diacritics ignored).
pub fn name_query(safe: &str) -> String {
    format!("kMDItemDisplayName == \"*{safe}*\"cd")
}

/// Spotlight: the text inside the file has the query's words.
pub fn content_query(safe: &str) -> String {
    format!("kMDItemTextContent == \"{safe}\"cdw")
}

/// Spotlight: content changed within the last `days` days.
pub fn recent_query(days: u32) -> String {
    format!("kMDItemFSContentChangeDate >= $time.today(-{days})")
}

/// Folders of tool output a person never means (build trees, caches, environments).
const JUNK_DIRS: &[&str] = &["Library", "node_modules", "target", "__pycache__", "DerivedData", "venv", "Pods", "dist"];
/// Machine files a person never means (compiler and interpreter output).
const JUNK_EXTENSIONS: &[&str] = &["o", "d", "pyc", "rlib", "rmeta", "class", "tmp", "lock"];

/// Paths a person never means: hidden, Library (caches, app data), node_modules and other tool
/// output (`JUNK_DIRS`, `JUNK_EXTENSIONS`), the insides of an app or package bundle.
pub fn excluded(path: &Path) -> bool {
    let ext = path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
    if JUNK_EXTENSIONS.contains(&ext.as_str()) {
        return true;
    }
    let names: Vec<String> = path.components().filter_map(|c| if let Component::Normal(n) = c { Some(n.to_string_lossy().into_owned()) } else { None }).collect();
    let last = names.len().saturating_sub(1);
    names.iter().enumerate().any(|(i, n)| {
        n.starts_with('.') || JUNK_DIRS.contains(&n.as_str()) || n.eq_ignore_ascii_case("caches") || (i < last && n.ends_with(".app"))
    })
}

/// A hit for an existing path (None when it vanished since Spotlight indexed it).
fn hit(path: &Path) -> Option<FileHit> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok().map(|t| time::iso(DateTime::<Utc>::from(t))).unwrap_or_default();
    Some(FileHit {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name()?.to_string_lossy().into_owned(),
        kind: kind_of(path, meta.is_dir()).to_string(),
        modified,
    })
}

/// How well a name matches: exact (0), starts with (1), contains (2), not at all (3).
pub fn name_rank(name: &str, safe: &str) -> u8 {
    let name = name.to_lowercase();
    let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(&name);
    let q = safe.to_lowercase();
    if stem == q || name == q {
        0
    } else if name.starts_with(&q) {
        1
    } else if name.contains(&q) {
        2
    } else {
        3
    }
}

/// Name hits first (best match, then newest), then content-only hits (newest), no duplicates.
pub fn rank(names: Vec<FileHit>, contents: Vec<FileHit>, safe: &str, limit: usize) -> Vec<FileHit> {
    let mut names = names;
    names.sort_by(|a, b| name_rank(&a.name, safe).cmp(&name_rank(&b.name, safe)).then_with(|| b.modified.cmp(&a.modified)));
    let mut contents = contents;
    contents.sort_by(|a, b| b.modified.cmp(&a.modified));
    let mut out: Vec<FileHit> = Vec::new();
    for h in names.into_iter().chain(contents) {
        if out.len() >= limit {
            break;
        }
        if !out.iter().any(|o| o.path == h.path) {
            out.push(h);
        }
    }
    out
}

fn home() -> Result<PathBuf> {
    dirs::home_dir().ok_or_else(|| DeskError::Io("I couldn't find your home folder.".into()))
}

async fn spotlight_hits(query: &str, only_in: &[PathBuf]) -> Result<Vec<FileHit>> {
    let paths = platform::spotlight(query, only_in, SPOTLIGHT_MAX, SPOTLIGHT_TIME).await?;
    Ok(paths.iter().filter(|p| !excluded(p)).filter_map(|p| hit(p)).collect())
}

pub async fn find(query: &str, limit: usize) -> Result<Vec<FileHit>> {
    let safe = sanitise(query).ok_or_else(|| DeskError::Invalid("Tell me what to look for.".into()))?;
    let limit = limit.clamp(1, MAX_LIMIT);
    let home = home()?;
    let name_scope = [home.clone(), PathBuf::from("/Applications")];
    let content_scope = [home];
    let (by_name, by_content) = (name_query(&safe), content_query(&safe));
    let (names, contents) = tokio::join!(spotlight_hits(&by_name, &name_scope), spotlight_hits(&by_content, &content_scope));
    // Either search may fail alone; both failing is an answer the person should hear.
    let (names, contents) = match (names, contents) {
        (Err(e), Err(_)) => return Err(e),
        (n, c) => (n.unwrap_or_default(), c.unwrap_or_default()),
    };
    Ok(rank(names, contents, &safe, limit))
}

pub async fn recent(days: u32, limit: usize) -> Result<Vec<FileHit>> {
    let days = days.clamp(1, 365);
    let limit = limit.clamp(1, MAX_LIMIT);
    let home = home()?;
    let folders: Vec<PathBuf> = ["Desktop", "Documents", "Downloads"].iter().map(|f| home.join(f)).filter(|p| p.is_dir()).collect();
    let mut hits = match spotlight_hits(&recent_query(days), &folders).await {
        Ok(h) if !h.is_empty() => h,
        // No index (or Spotlight off for these folders): walk them, bounded.
        _ => {
            let cutoff = SystemTime::now() - Duration::from_secs(u64::from(days) * 86_400);
            tokio::task::spawn_blocking(move || walk(&folders, cutoff)).await.unwrap_or_default()
        }
    };
    hits.retain(|h| h.kind != "folder");
    hits.sort_by(|a, b| b.modified.cmp(&a.modified));
    hits.truncate(limit);
    Ok(hits)
}

/// Files under `folders` changed since `cutoff`, at most `WALK_DEPTH` deep and `WALK_ENTRIES` seen.
fn walk(folders: &[PathBuf], cutoff: SystemTime) -> Vec<FileHit> {
    let mut out = Vec::new();
    let mut seen = 0usize;
    let mut stack: Vec<(PathBuf, usize)> = folders.iter().map(|f| (f.clone(), 0)).collect();
    while let Some((dir, depth)) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            seen += 1;
            if seen > WALK_ENTRIES {
                return out;
            }
            let path = entry.path();
            let Ok(meta) = entry.metadata() else { continue };
            if excluded(&path) {
                continue;
            }
            let bundle = kind_of(&path, true) != "folder";
            if meta.is_dir() && !bundle {
                if depth + 1 < WALK_DEPTH {
                    stack.push((path, depth + 1));
                }
                continue;
            }
            if meta.modified().map(|m| m >= cutoff).unwrap_or(false) {
                out.extend(hit(&path));
            }
        }
    }
    out
}

#[cfg(test)]
#[path = "files_tests.rs"]
mod tests;
