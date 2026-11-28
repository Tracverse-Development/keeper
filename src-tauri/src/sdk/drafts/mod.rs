//! Drafts: a keeper edits a COPY of a text file, the person sees the change beside the old text,
//! and only the person's Save writes the real file.
//!
//! A [`Draft`] holds the file's real path, its text when the draft opened (and that text's hash,
//! so a file changed underneath is noticed), the proposed text and why. Drafts live in Keeper's
//! own folder (`kernel::paths::drafts_home`, one owner-only JSON file per draft, named by a hash
//! of the path: one draft per file, so a second edit updates the same draft). Nothing here ever
//! writes the person's file except [`Drafts::save`], and it refuses when the file changed since
//! the draft opened. A draft untouched for `KEEP_DAYS` is thrown away (its text is a copy of the
//! person's file: it is not kept longer than the edit needs).
//!
//! Pattern: Repository (the store) + Memento (the original text kept to compare against).
//!
//! ```ignore
//! let drafts = Drafts::here();
//! let d = drafts.open("~/notes.txt", Some("the whole new text"), Some("fixed 3 spellings"))?;
//! let view = d.view();            // the before/after lines the panel draws
//! drafts.save(&d.id)?;            // writes the file, unless it changed underneath
//! ```

pub mod commands;
pub mod diff;
pub mod place;

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::kernel::slug::short_hash;
use crate::kernel::{time, DeskError, Result};

/// Days an untouched draft is kept.
pub const KEEP_DAYS: i64 = 7;
/// The longest "why" kept with a draft.
const MAX_WHY: usize = 200;

/// A copy of one text file being edited.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    /// 16 hex characters, from the file's real path.
    pub id: String,
    /// The file's real path (links resolved).
    pub path: String,
    /// The file's text when the draft opened, and its hash.
    pub original: String,
    pub original_hash: String,
    /// The proposed text (the original until an edit arrives).
    pub text: String,
    /// What the edit does, in a few words ("fixed 7 spellings").
    #[serde(default)]
    pub why: Option<String>,
    pub opened: String,
    pub updated: String,
}

/// What the draft panel draws: the file, the change line by line, and the proposed text.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftView {
    pub draft: String,
    pub name: String,
    /// The folder, written with `~` for the home folder.
    pub folder: String,
    pub path: String,
    pub why: Option<String>,
    pub text: String,
    pub lines: Vec<diff::Line>,
    pub added: usize,
    pub removed: usize,
    /// The proposed text differs from the file.
    pub changed: bool,
}

/// The file's name, its folder as a person reads it (`~/Documents`), from a real path.
pub fn name_and_folder(path: &str) -> (String, String) {
    let p = Path::new(path);
    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let folder = p.parent().map(|f| f.display().to_string()).unwrap_or_default();
    let home = dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default();
    let folder = match folder.strip_prefix(&home) {
        Some(rest) if !home.is_empty() => format!("~{rest}"),
        _ => folder,
    };
    (name, folder)
}

fn hash(text: &str) -> String {
    short_hash(text, 64)
}

/// A draft id is exactly what `open` makes: 16 lowercase hex characters (never a path).
pub fn valid_id(id: &str) -> bool {
    id.len() == 16 && id.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

impl Draft {
    /// The file's name.
    pub fn name(&self) -> String {
        name_and_folder(&self.path).0
    }

    /// The before/after view of this draft.
    pub fn view(&self) -> DraftView {
        let lines = diff::view(&self.original, &self.text);
        let (added, removed) = diff::counts(&lines);
        let (name, folder) = name_and_folder(&self.path);
        DraftView { draft: self.id.clone(), name, folder, path: self.path.clone(), why: self.why.clone(), text: self.text.clone(), lines, added, removed, changed: self.text != self.original }
    }

    /// The Stage panel that shows this draft (its text is loaded by the window, never carried in
    /// the panel, so the person's file is not copied into the chat's record).
    pub fn panel(&self) -> crate::stage::Panel {
        let (name, folder) = name_and_folder(&self.path);
        let title = if self.text == self.original { name.clone() } else { format!("Changes to {name}") };
        crate::stage::Panel::Draft { id: format!("draft-{}", self.id), title, draft: self.id.clone(), name, folder, why: self.why.clone() }
    }
}

/// The drafts kept in one folder.
pub struct Drafts {
    folder: PathBuf,
}

impl Drafts {
    /// The drafts in Keeper's own folder.
    pub fn here() -> Drafts {
        Drafts { folder: crate::kernel::paths::drafts_home() }
    }

    /// The drafts in `folder` (tests use a folder of their own).
    pub fn in_folder(folder: impl Into<PathBuf>) -> Drafts {
        Drafts { folder: folder.into() }
    }

    fn file(&self, id: &str) -> PathBuf {
        self.folder.join(format!("{id}.json"))
    }

    fn store(&self, d: &Draft) -> Result<()> {
        crate::kernel::paths::write_private(&self.file(&d.id), serde_json::to_string(d)?.as_bytes())?;
        Ok(())
    }

    /// The draft `id`, or the plain sentence that it is gone (saved, thrown away or expired).
    pub fn get(&self, id: &str) -> Result<Draft> {
        let gone = || DeskError::Invalid("That draft is gone: it was saved or thrown away.".into());
        if !valid_id(id) {
            return Err(gone());
        }
        let raw = std::fs::read_to_string(self.file(id)).map_err(|_| gone())?;
        serde_json::from_str(&raw).map_err(|_| gone())
    }

    /// Opens the draft of the file at `path` (or carries on with the one already open), puts
    /// `text` in as the proposal when given, and keeps it. A draft whose file changed since it
    /// opened starts again from the file as it is now. Never writes the file itself.
    pub fn open(&self, path: &str, text: Option<&str>, why: Option<&str>) -> Result<Draft> {
        let real = place::editable(path)?;
        let current = place::read_text(&real)?;
        let real_path = real.display().to_string();
        let id = short_hash(&real_path, 16);
        let now = time::now_iso();
        let mut draft = match self.get(&id) {
            Ok(d) if d.original_hash == hash(&current) => d,
            _ => Draft { id, path: real_path, original_hash: hash(&current), text: current.clone(), original: current, why: None, opened: now.clone(), updated: now.clone() },
        };
        if let Some(t) = text {
            place::fits(t)?;
            draft.text = place::like_original(&draft.original, t);
        }
        if let Some(w) = why.map(str::trim).filter(|w| !w.is_empty()) {
            draft.why = Some(w.chars().take(MAX_WHY).collect());
        }
        draft.updated = now;
        self.sweep();
        self.store(&draft)?;
        Ok(draft)
    }

    /// The person changed the proposed text themselves (in the panel).
    pub fn edit(&self, id: &str, text: &str) -> Result<Draft> {
        let mut draft = self.get(id)?;
        place::fits(text)?;
        draft.text = place::like_original(&draft.original, text);
        draft.updated = time::now_iso();
        self.store(&draft)?;
        Ok(draft)
    }

    /// Writes the proposed text to the file, then forgets the draft. Refused, with the draft
    /// kept, when the file is no longer editable, now resolves elsewhere (a link swapped in), or
    /// changed since the draft opened.
    pub fn save(&self, id: &str) -> Result<Draft> {
        let draft = self.get(id)?;
        let name = draft.name();
        let real = place::editable(&draft.path)?;
        if real.display().to_string() != draft.path {
            return Err(DeskError::Invalid(format!("{name} isn't where it was when I opened it, so I didn't save.")));
        }
        let now = place::read_text(&real)?;
        if hash(&now) != draft.original_hash {
            return Err(DeskError::Invalid(format!("{name} changed since I opened it, so I didn't save over it. Ask me again and I'll start from the new version.")));
        }
        place::write_atomically(&real, &draft.text)?;
        let _ = std::fs::remove_file(self.file(id));
        Ok(draft)
    }

    /// Throws the draft away; the file is untouched.
    pub fn discard(&self, id: &str) -> Result<()> {
        self.get(id)?;
        std::fs::remove_file(self.file(id))?;
        Ok(())
    }

    /// Every open draft (oldest drafts are thrown away first).
    pub fn all(&self) -> Vec<Draft> {
        self.sweep();
        let Ok(entries) = std::fs::read_dir(&self.folder) else { return Vec::new() };
        entries.flatten().filter_map(|e| std::fs::read_to_string(e.path()).ok()).filter_map(|raw| serde_json::from_str(&raw).ok()).collect()
    }

    /// The most recently updated open draft of a file called `name` (as the talk box writes it:
    /// "About notes.txt: …").
    pub fn named(&self, name: &str) -> Option<Draft> {
        self.all().into_iter().filter(|d| d.name().eq_ignore_ascii_case(name)).max_by(|a, b| a.updated.cmp(&b.updated))
    }

    /// Throws away drafts untouched for `KEEP_DAYS`.
    fn sweep(&self) {
        let Ok(entries) = std::fs::read_dir(&self.folder) else { return };
        let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(KEEP_DAYS as u64 * 86_400);
        for e in entries.flatten() {
            if e.metadata().and_then(|m| m.modified()).is_ok_and(|t| t < cutoff) {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A bench of its own under /tmp: the file to edit and the drafts folder.
    fn bench(name: &str, body: &str) -> (Drafts, PathBuf) {
        let dir = PathBuf::from(format!("/tmp/keeper-drafts-test-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("notes.txt");
        std::fs::write(&file, body).unwrap();
        (Drafts::in_folder(dir.join("drafts")), file)
    }

    #[test]
    fn a_draft_never_touches_the_file_until_it_is_saved() {
        let (drafts, file) = bench("save", "I recieve teh letter.\n");
        let d = drafts.open(&file.to_string_lossy(), Some("I receive the letter."), Some("fixed 2 spellings")).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "I recieve teh letter.\n", "still the old text");
        assert_eq!(d.text, "I receive the letter.\n", "the line break the file had is kept");
        let view = d.view();
        assert_eq!((view.added, view.removed, view.changed, view.name.as_str()), (1, 1, true, "notes.txt"));
        assert!(matches!(d.panel(), crate::stage::Panel::Draft { ref title, .. } if title == "Changes to notes.txt"));
        // A second edit updates the same draft.
        let again = drafts.open(&file.to_string_lossy(), Some("I receive the letter!"), None).unwrap();
        assert_eq!((again.id.as_str(), again.why.as_deref()), (d.id.as_str(), Some("fixed 2 spellings")));
        drafts.save(&d.id).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "I receive the letter!\n");
        assert!(drafts.get(&d.id).is_err(), "a saved draft is gone");
    }

    #[test]
    fn a_save_is_refused_when_the_file_changed_underneath() {
        let (drafts, file) = bench("changed", "one\n");
        let d = drafts.open(&file.to_string_lossy(), Some("two"), None).unwrap();
        std::fs::write(&file, "someone else wrote this\n").unwrap();
        let refused = drafts.save(&d.id).unwrap_err().to_string();
        assert!(refused.contains("changed since I opened it"), "{refused}");
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "someone else wrote this\n", "their words are kept");
        assert!(drafts.get(&d.id).is_ok(), "the draft is kept too");
        // Opening it again starts from the file as it is now.
        let fresh = drafts.open(&file.to_string_lossy(), None, None).unwrap();
        assert_eq!((fresh.original.as_str(), fresh.text.as_str()), ("someone else wrote this\n", "someone else wrote this\n"));
    }

    #[test]
    fn throwing_away_and_editing_by_hand() {
        let (drafts, file) = bench("discard", "a\nb\n");
        let d = drafts.open(&file.to_string_lossy(), Some("a\nB\n"), None).unwrap();
        let edited = drafts.edit(&d.id, "a\nB, by hand").unwrap();
        assert_eq!(edited.text, "a\nB, by hand\n");
        assert_eq!(drafts.named("NOTES.txt").map(|n| n.id), Some(d.id.clone()), "found by the file's name");
        drafts.discard(&d.id).unwrap();
        assert!(drafts.get(&d.id).is_err() && drafts.named("notes.txt").is_none());
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "a\nb\n");
    }

    #[test]
    fn the_draft_panel_reads_the_windows_shape() {
        let raw = serde_json::json!({"kind": "draft", "id": "draft-0123456789abcdef", "title": "Changes to notes.txt", "draft": "0123456789abcdef", "name": "notes.txt", "folder": "/tmp/keeper-bench", "why": "fixed 7 spellings"});
        let panel: crate::stage::Panel = serde_json::from_value(raw.clone()).unwrap();
        assert!(matches!(&panel, crate::stage::Panel::Draft { why: Some(w), .. } if w == "fixed 7 spellings"));
        assert_eq!(serde_json::to_value(&panel).unwrap(), raw, "the same shape both ways");
        let view = serde_json::to_value(Draft { id: "0123456789abcdef".into(), path: "/tmp/a.txt".into(), original: "teh\n".into(), original_hash: String::new(), text: "the\n".into(), why: None, opened: String::new(), updated: String::new() }.view()).unwrap();
        assert_eq!(view["lines"][0]["parts"][0], serde_json::json!({"text": "teh", "changed": true}));
        assert_eq!((view["added"].as_u64(), view["changed"].as_bool()), (Some(1), Some(true)));
    }

    #[test]
    fn ids_are_never_paths_and_too_much_text_is_refused() {
        let (drafts, file) = bench("limits", "small\n");
        for bad in ["../../etc/passwd", "ABCDEF0123456789", "", "0123"] {
            assert!(drafts.get(bad).is_err(), "{bad}");
        }
        let huge = "x".repeat(place::MAX_BYTES + 1);
        assert!(drafts.open(&file.to_string_lossy(), Some(&huge), None).is_err());
        let d = drafts.open(&file.to_string_lossy(), None, None).unwrap();
        assert!(drafts.edit(&d.id, &huge).is_err());
        assert!(drafts.open("/etc/hosts", Some("pwned"), None).is_err(), "a system file");
    }
}
