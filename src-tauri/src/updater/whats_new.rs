//! What's new: after an update, the changelog entries of every version newer than the one the
//! person last saw, shown once (`whats_new`, then `whats_new_seen`). The changelog is built into
//! the app from CHANGELOG.md, so what it shows is exactly what was released.

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::kernel::Result;
use crate::state::AppState;

const CHANGELOG: &str = include_str!("../../../CHANGELOG.md");
/// At most this many versions are shown at once (after a long gap, the newest ones).
const MOST: usize = 5;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub version: String,
    pub date: String,
    /// The entry's sections: ("Added", ["…", …]), in the file's order.
    pub sections: Vec<(String, Vec<String>)>,
}

/// A version as three numbers, for comparing ("0.11.2" → (0, 11, 2)).
fn number(v: &str) -> Option<(u32, u32, u32)> {
    let mut parts = v.trim().trim_start_matches('v').split('.').map(|p| p.parse::<u32>().ok());
    Some((parts.next()??, parts.next()??, parts.next()??))
}

/// Every entry of a changelog text, newest first.
pub fn entries(text: &str) -> Vec<Entry> {
    let mut out: Vec<Entry> = Vec::new();
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("## [") {
            let Some((version, date)) = rest.split_once("] - ") else { continue };
            out.push(Entry { version: version.trim().into(), date: date.trim().into(), sections: vec![] });
        } else if let (Some(entry), Some(title)) = (out.last_mut(), line.strip_prefix("### ")) {
            entry.sections.push((title.trim().into(), vec![]));
        } else if let (Some(entry), Some(item)) = (out.last_mut(), line.strip_prefix("- ")) {
            if let Some((_, items)) = entry.sections.last_mut() {
                items.push(item.trim().into());
            }
        } else if line.starts_with("  ") && !line.trim().is_empty() {
            // A bullet wrapped onto the next lines (indented) belongs to that bullet.
            if let Some(item) = out.last_mut().and_then(|e| e.sections.last_mut()).and_then(|(_, items)| items.last_mut()) {
                item.push(' ');
                item.push_str(line.trim());
            }
        }
    }
    out
}

/// The entries to show: newer than `seen` and not newer than `running`. Nothing seen yet means
/// the running version's own entry only (a new install is not shown its whole history).
pub fn unseen(all: &[Entry], seen: &str, running: &str) -> Vec<Entry> {
    let Some(now) = number(running) else { return vec![] };
    let since = number(seen);
    all.iter()
        .filter(|e| number(&e.version).is_some_and(|v| v <= now && since.map_or(v == now, |s| v > s)))
        .take(MOST)
        .cloned()
        .collect()
}

/// What changed since the person last looked (empty: nothing new).
#[tauri::command]
pub fn whats_new(app: AppHandle, state: State<'_, AppState>) -> Vec<Entry> {
    unseen(&entries(CHANGELOG), &state.settings().last_seen_version, &app.package_info().version.to_string())
}

/// The person has seen what is new in this version.
#[tauri::command]
pub fn whats_new_seen(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let running = app.package_info().version.to_string();
    state.update_settings(|s| s.last_seen_version = running)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_built_in_changelog_reads_and_holds_this_version() {
        let all = entries(CHANGELOG);
        assert!(all.len() >= 20);
        assert_eq!(all[0].version, env!("CARGO_PKG_VERSION"), "the app carries its own version's entry");
        assert!(all[0].sections.iter().any(|(_, items)| !items.is_empty()));
    }

    #[test]
    fn only_what_is_new_since_last_seen_is_shown() {
        let all = entries("## [0.11.2] - d\n### Fixed\n- a\n## [0.11.1] - d\n### Added\n- b\n## [0.10.0] - d\n### Added\n- c\n");
        let versions = |v: Vec<Entry>| v.into_iter().map(|e| e.version).collect::<Vec<_>>();
        assert_eq!(versions(unseen(&all, "0.10.0", "0.11.2")), vec!["0.11.2", "0.11.1"]);
        assert_eq!(versions(unseen(&all, "0.11.2", "0.11.2")), Vec::<String>::new(), "seen: nothing");
        assert_eq!(versions(unseen(&all, "", "0.11.2")), vec!["0.11.2"], "first time: this version only");
        assert_eq!(versions(unseen(&all, "0.10.0", "0.11.1")), vec!["0.11.1"], "never a version newer than the one running");
        assert_eq!(all[0].sections, vec![("Fixed".to_string(), vec!["a".to_string()])]);
    }

    // FIX-0041: a bullet wrapped onto a second line showed only its first line.
    #[test]
    fn a_wrapped_bullet_is_read_whole() {
        let all = entries("## [1.0.0] - d\n### Added\n- **Edit in Keeper.** Ask a keeper to change\n  a text file and save it.\n- Next.\n\n  \n");
        assert_eq!(all[0].sections[0].1, vec!["**Edit in Keeper.** Ask a keeper to change a text file and save it.".to_string(), "Next.".to_string()]);
    }
}
