//! Does this message ask for work ON the computer? Decided by words, with no model, so a keeper
//! that may act (a System Administrator with acting allowed) answers conversation, questions and
//! lessons at chat speed (quick model, warm spare, scene cache) and pays for tools and an
//! approval plan only when the person asks for computer work. Measured 2026-11-25 on the admin
//! bench: "hello" took 6.2 s to first words through the plan step against 0.7 s as chat.
//!
//! A miss is not final: a chat turn's engine may answer `"needsComputer": true`, and the turn
//! is run again as computer work (`source::find`). So the word list errs toward chat; the
//! engine is the safety net, not the other way round.

/// Verbs that only ever mean computer work.
const STRONG: [&str; 8] = ["install", "uninstall", "unzip", "zip", "compress", "rename", "trash", "duplicate"];

/// Verbs that change things, on the computer or not ("save money", "run a marathon"): computer
/// work only when they name something on the computer or something of the person's ("my").
const VERBS: [&str; 15] = ["move", "delete", "copy", "tidy", "organise", "organize", "run", "edit", "save", "sort", "clean", "backup", "archive", "convert", "create"];

/// Things on the computer a request is about.
const THINGS: [&str; 33] = [
    "file", "files", "folder", "folders", "document", "documents", "pdf", "pdfs", "desktop", "downloads", "directory", "disk",
    "screenshot", "screenshots", "terminal", "script", "app", "apps", "spreadsheet",
    // The machine and its connections (founder 2026-11-26: "show me my home network" was taken
    // for chat, then escalated: three engine calls for one look).
    "network", "wifi", "router", "internet", "battery", "storage", "computer", "mac", "laptop", "devices", "cpu", "processor", "ram", "bluetooth",
];

/// Words that ask to see or open something.
const LOOKING: [&str; 8] = ["open", "show", "find", "list", "look", "check", "search", "where"];

/// True when the words ask for something done or looked up on this computer: a strong verb; a
/// changing verb with a computer thing or "my"; or a computer thing with a looking word or "my".
/// "Which app is best for notes?" and "this is a chat to delete" stay conversation.
pub fn wants_computer(said: &str) -> bool {
    let lower = said.to_lowercase();
    if lower.contains("~/") || lower.contains("/users/") {
        return true;
    }
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let has = |list: &[&str]| words.iter().any(|w| list.contains(w));
    // The person's own: "my"/"our"; with a computer thing named, "I" too ("how much storage do
    // I have"), but never with a verb alone ("I want to run a marathon").
    let mine = words.iter().any(|w| matches!(*w, "my" | "our" | "mine"));
    let owner = mine || words.contains(&"i");
    has(&STRONG) || (has(&VERBS) && (has(&THINGS) || mine)) || (has(&THINGS) && (has(&LOOKING) || owner))
}

/// Questions that only ask what IS (no change): these words, or a question word, with no verb
/// that changes anything. "Open" is not here: opening an app changes what is on screen.
const ASKING: [&str; 12] = ["show", "find", "list", "look", "check", "search", "where", "what", "whats", "which", "how", "is"];

/// True for computer work that only looks: it goes straight to a read-only look (one engine call,
/// under the read-only guard and the look hook) instead of a plan and then a look.
pub fn only_looks(said: &str) -> bool {
    if !wants_computer(said) {
        return false;
    }
    let lower = said.to_lowercase();
    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    let has = |list: &[&str]| words.iter().any(|w| list.contains(w));
    !has(&STRONG) && !has(&VERBS) && !words.contains(&"open") && has(&ASKING)
}

#[cfg(test)]
mod tests {
    use super::{only_looks, wants_computer};

    #[test]
    fn looking_questions_skip_the_plan_and_changes_never_do() {
        for said in ["How much storage do I have left?", "Show me my home network.", "Which devices are on my network?", "How is my computer doing?", "What's in my Downloads?", "find the PDF Maya sent", "How much storage is left on my mac?", "check my battery"] {
            assert!(only_looks(said), "{said}");
        }
        for said in ["Move my tax PDFs into a folder", "Delete the screenshots on my desktop", "Open the budget spreadsheet", "install ffmpeg", "clean up my files", "Explain how home networks work", "hello"] {
            assert!(!only_looks(said), "{said}");
        }
    }

    #[test]
    fn conversation_and_lessons_are_not_computer_work() {
        for said in ["hello", "Hi! How are you today?", "What's the capital of Japan?", "My dog is called Rex.", "Explain how a rainbow forms, visually.", "Tell me a joke", "What is my dog called?", "Remind me to call Maya at 5", "hello there, this is a chat to delete", "Which app is best for taking notes?", "I want to run a marathon", "How do I save money on groceries?"] {
            assert!(!wants_computer(said), "{said}");
        }
    }

    #[test]
    fn computer_work_is_recognised() {
        for said in ["Move my tax PDFs into a folder", "rename the screenshots on my desktop", "What's in my Downloads?", "Tidy up my desktop", "Delete ~/tmp/old.txt", "install ffmpeg", "Open the budget spreadsheet", "Create a folder called keeper-bench-act inside /tmp", "clean up my files", "find the PDF Maya sent"] {
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
