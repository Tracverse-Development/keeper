//! The words of a turn's reply: the mind's own, then what its abilities did, each said once.

use crate::memory::Fact;
use crate::sdk::Outcome;

/// The mind's words, then what the abilities did (an ability's own sentence is the truth about it).
/// The mind writes its reply BEFORE the abilities run, so (FIX-0033):
/// - an ability that answered a question (`Done::answer`) replaces the reply: the mind could only guess;
/// - a sentence of the reply that says again what a successful ability's sentence says (most of
///   its words are in it) is dropped, so it is said once, in the ability's words.
pub(super) fn compose_reply(said: &str, outcomes: &[Outcome], forgotten: &[Fact], asked_to_forget: bool) -> String {
    let done: Vec<&str> = outcomes.iter().filter(|o| o.succeeded).map(|o| o.summary.as_str()).collect();
    let mut parts: Vec<String> = Vec::new();
    if !outcomes.iter().any(|o| o.succeeded && o.answers) {
        parts.extend(sentences(said).into_iter().filter(|s| !done.iter().any(|d| repeats(s, d))).map(str::to_string));
    }
    for o in outcomes {
        if !parts.iter().any(|p| p.contains(&o.summary)) {
            parts.push(o.summary.clone());
        }
    }
    if asked_to_forget && said.trim().is_empty() {
        parts.push(if forgotten.is_empty() {
            "I couldn't find that in your memory graph.".into()
        } else {
            format!("Done. I've retracted {} from your memory graph.", forgotten.iter().map(|f| format!("\"{}\"", f.text)).collect::<Vec<_>>().join(", "))
        });
    }
    if parts.is_empty() {
        "Okay.".into()
    } else {
        parts.join(" ")
    }
}

/// The reply's sentences (split after . ! or ? followed by a space), trimmed, none empty.
fn sentences(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if matches!(b, b'.' | b'!' | b'?') && bytes.get(i + 1).is_none_or(|n| n.is_ascii_whitespace()) {
            out.push(text[start..=i].trim());
            start = i + 1;
        }
    }
    out.push(text[start..].trim());
    out.into_iter().filter(|s| !s.is_empty()).collect()
}

/// Words too common to show what a sentence is about.
const COMMON: &[&str] = &["the", "and", "you", "your", "will", "for", "now", "this", "that", "with", "have", "has", "are", "was", "can", "all", "just", "it's", "i'll", "i've", "i'm", "okay", "sure", "done"];

/// The words that say what a sentence is about: lower case, three letters or more, not common,
/// a plural's "s" dropped (so "reminders" meets "reminder").
fn topic_words(text: &str) -> Vec<String> {
    text.split(|c: char| !(c.is_alphanumeric() || c == '\''))
        .map(|w| w.trim_matches('\'').to_lowercase())
        .filter(|w| w.chars().count() >= 3 && !COMMON.contains(&w.as_str()))
        .map(|w| if w.len() > 3 && w.ends_with('s') && !w.ends_with("ss") { w[..w.len() - 1].to_string() } else { w })
        .collect()
}

/// Does `sentence` say again what `summary` says? At least two of its topic words, and at least
/// half of them, are in the summary. A sentence with no topic words ("Sure.") never repeats.
fn repeats(sentence: &str, summary: &str) -> bool {
    let theirs = topic_words(summary);
    let mine = topic_words(sentence);
    let shared = mine.iter().filter(|w| theirs.contains(w)).count();
    shared >= 2 && shared * 2 >= mine.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outcome(summary: &str, answers: bool) -> Outcome {
        Outcome { skill: "x".into(), input: "{}".into(), summary: summary.into(), succeeded: true, effect: None, panels: Vec::new(), answers }
    }

    #[test]
    fn skill_outcomes_are_always_told() {
        let o = outcome("Opened Notes.", false);
        assert_eq!(compose_reply("", &[o.clone()], &[], false), "Opened Notes.");
        assert_eq!(compose_reply("Sure.", &[o], &[], false), "Sure. Opened Notes.");
        assert_eq!(compose_reply("", &[], &[], true), "I couldn't find that in your memory graph.");
    }

    #[test]
    fn what_an_ability_already_says_is_said_once() {
        // FIX-0033: the bench's reminder was said twice, once in the mind's words, once in the ability's.
        let remind = outcome("I'll remind you to call the dentist tomorrow at 9:00 AM. It's in your memory graph.", false);
        assert_eq!(compose_reply("I will remind you tomorrow, Saturday at 9am, to call the dentist.", &[remind.clone()], &[], false), remind.summary);
        // The reply's other sentences stay.
        assert_eq!(compose_reply("Good luck at the dentist! I will remind you tomorrow, Saturday at 9am, to call the dentist.", &[remind.clone()], &[], false), format!("Good luck at the dentist! {}", remind.summary));
        assert_eq!(compose_reply("Opened Notes for you.", &[outcome("Opened Notes.", false)], &[], false), "Opened Notes.");
        // A sentence about something else is not a repeat.
        assert_eq!(compose_reply("Your sister Maya called earlier.", &[remind.clone()], &[], false), format!("Your sister Maya called earlier. {}", remind.summary));
        // A failed ability does not replace what the mind said.
        let failed = Outcome { succeeded: false, ..outcome("I need to know when: in some minutes, or a time like 5:30 pm.", false) };
        assert_eq!(compose_reply("I will remind you to call the dentist.", &[failed], &[], false), "I will remind you to call the dentist. I need to know when: in some minutes, or a time like 5:30 pm.");
    }

    #[test]
    fn an_answer_replaces_the_minds_guess() {
        // FIX-0033: "I'll check your upcoming reminders now. The dentist reminder is one I need to confirm." contradicted the list that followed.
        let list = outcome("You have 1 reminder coming up: call the dentist, tomorrow at 9:00 AM.", true);
        assert_eq!(compose_reply("I'll check your upcoming reminders now. The dentist reminder from this chat is one I need to confirm.", &[list.clone()], &[], false), list.summary);
        assert_eq!(sentences("One. Two? 9:00 AM! Three"), ["One.", "Two?", "9:00 AM!", "Three"]);
    }
}
