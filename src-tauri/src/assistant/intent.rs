//! Does this message ask for work ON the computer? Decided by words, with no model, so a keeper
//! that may act (a System Administrator with acting allowed) answers conversation, questions and
//! lessons at chat speed (quick model, warm spare, scene cache) and pays for tools and an
//! approval plan only when the person asks for computer work. Measured 2026-11-25 on the admin
//! bench: "hello" took 6.2 s to first words through the plan step against 0.7 s as chat.
//!
//! A miss is not final: a chat turn's engine may answer `"needsComputer": true`, and the turn
//! is run again as computer work (`source::find`). So the word list errs toward chat; the
//! engine is the safety net, not the other way round.

/// Verbs that change or operate the computer.
const VERBS: [&str; 22] = [
    "move", "rename", "delete", "trash", "copy", "duplicate", "tidy", "organise", "organize", "unzip", "zip", "compress",
    "install", "uninstall", "run", "edit", "save", "sort", "clean", "backup", "archive", "convert",
];

/// Things on the computer a request is about.
const THINGS: [&str; 20] = [
    "file", "files", "folder", "folders", "document", "documents", "pdf", "pdfs", "desktop", "downloads", "directory", "disk",
    "screenshot", "screenshots", "terminal", "script", "app", "apps", "spreadsheet", "~/",
];

/// True when the words ask for something done or looked up on this computer.
pub fn wants_computer(said: &str) -> bool {
    let lower = said.to_lowercase();
    if lower.contains("~/") || lower.contains("/users/") {
        return true;
    }
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let has = |list: &[&str]| words.iter().any(|w| list.contains(w));
    has(&VERBS) || has(&THINGS)
}

#[cfg(test)]
mod tests {
    use super::wants_computer;

    #[test]
    fn conversation_and_lessons_are_not_computer_work() {
        for said in ["hello", "Hi! How are you today?", "What's the capital of Japan?", "My dog is called Rex.", "Explain how a rainbow forms, visually.", "Tell me a joke", "What is my dog called?", "Remind me to call Maya at 5"] {
            assert!(!wants_computer(said), "{said}");
        }
    }

    #[test]
    fn computer_work_is_recognised() {
        for said in ["Move my tax PDFs into a folder", "rename the screenshots on my desktop", "What's in my Downloads?", "Tidy up my desktop", "Delete ~/tmp/old.txt", "install ffmpeg", "Open the budget spreadsheet"] {
            assert!(wants_computer(said), "{said}");
        }
    }

    #[test]
    fn whole_words_only() {
        assert!(!wants_computer("I love running in the park"), "running is not run");
        assert!(!wants_computer("That was a moving film"));
        assert!(!wants_computer("happy birthday"), "app inside a word");
    }
}
