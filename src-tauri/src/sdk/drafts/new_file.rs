//! New documents a keeper writes: the same draft as an edit (the person sees the words, changes
//! them, and saves them themselves), for a file that does not exist yet. Save creates the file
//! and never writes over one (`place::write_new`); where it may go is `place::creatable`.

use super::{place, Draft, Drafts};
use crate::kernel::slug::short_hash;
use crate::kernel::{time, DeskError, Result};

impl Drafts {
    /// A draft of a new file `name` in `folder` holding `text` (checked like any draft's text).
    /// Asked again for the same place, it carries on with that draft.
    pub fn create(&self, folder: &str, name: &str, text: &str, why: Option<&str>) -> Result<Draft> {
        let target = place::creatable(folder, name)?;
        place::fits(text)?;
        let path = target.display().to_string();
        let now = time::now_iso();
        let draft = Draft {
            id: short_hash(&path, 16),
            path,
            original: String::new(),
            original_hash: String::new(),
            text: text.to_string(),
            why: why.map(str::trim).filter(|w| !w.is_empty()).map(|w| w.chars().take(super::MAX_WHY).collect()),
            opened: now.clone(),
            updated: now,
            new: true,
        };
        self.store(&draft)?;
        Ok(draft)
    }

    /// Saves a new file's draft: refused, with the draft kept, when its folder is no longer one
    /// the keeper may write in or a file by that name appeared meanwhile.
    pub(super) fn save_new(&self, draft: Draft) -> Result<Draft> {
        let real = std::path::Path::new(&draft.path);
        let (folder, name) = (real.parent().map(|p| p.display().to_string()).unwrap_or_default(), draft.name());
        let target = place::creatable(&folder, &name).map_err(|e| if real.exists() { DeskError::Invalid(format!("A file called {name} appeared there, so I didn't save over it.")) } else { e })?;
        place::write_new(&target, &draft.text)?;
        let _ = std::fs::remove_file(self.file(&draft.id));
        Ok(draft)
    }
}

#[cfg(test)]
mod tests {
    use super::super::Drafts;

    fn sandbox(tag: &str) -> (std::path::PathBuf, Drafts) {
        let home = std::env::temp_dir().join(format!("keeper-newdoc-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join("docs")).unwrap();
        std::fs::create_dir_all(home.join("drafts")).unwrap();
        let drafts = Drafts::in_folder(home.join("drafts"));
        (home, drafts)
    }

    #[test]
    fn a_new_document_is_a_draft_until_saved_and_never_overwrites() {
        let (home, drafts) = sandbox("save");
        let folder = home.join("docs").display().to_string();
        let d = drafts.create(&folder, "Party plan", "# Party\n- snacks\n", Some("a plan")).unwrap();
        assert!(d.new && d.name() == "Party plan.md", "no kind given means .md: {}", d.name());
        assert!(!home.join("docs/Party plan.md").exists(), "nothing is written before Save");
        assert!(matches!(d.panel(), crate::stage::Panel::Draft { ref title, .. } if title == "New: Party plan.md"));
        drafts.save(&d.id).unwrap();
        assert_eq!(std::fs::read_to_string(home.join("docs/Party plan.md")).unwrap(), "# Party\n- snacks\n");
        // A second document by the same name is refused before and at Save.
        assert!(drafts.create(&folder, "Party plan.md", "other", None).is_err());
        let again = drafts.create(&folder, "Notes.txt", "one", None).unwrap();
        std::fs::write(home.join("docs/Notes.txt"), "someone else's").unwrap();
        assert!(drafts.save(&again.id).is_err(), "a file that appeared meanwhile is never written over");
        assert_eq!(std::fs::read_to_string(home.join("docs/Notes.txt")).unwrap(), "someone else's");
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn only_plain_names_and_plain_text_kinds() {
        let (home, drafts) = sandbox("names");
        let folder = home.join("docs").display().to_string();
        for bad in ["", ".hidden.md", "a/b.md", "run.sh", "report.docx"] {
            assert!(drafts.create(&folder, bad, "x", None).is_err(), "{bad:?}");
        }
        assert!(drafts.create("/System/Library", "x.md", "x", None).is_err(), "never a system folder");
        let _ = std::fs::remove_dir_all(&home);
    }
}
