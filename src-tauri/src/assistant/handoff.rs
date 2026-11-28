//! When a turn moves to another mode, and when it only borrows one (`source::find`).
//!
//! The mind asks for a switch with `switchMode`. A real switch moves the chat and is announced
//! ("Switching to Tutor mode for this."). A quick question that a plain-talk mode would answer
//! in a line (the capital of Japan, a running tip) is answered by that mode quietly: no
//! announcement and the chat stays where it was, unless the answer turns out to be real work
//! (it shows panels or runs a skill), which is then announced as a switch after all (FIX-0034).

use std::sync::Mutex;

use crate::brain::{Progress, Thought};
use crate::keepers::kit::roles::{Role, Tools};

/// How every switch announcement starts (the mind's own and `find`'s).
const SWITCH_LINE: &str = "Switching to ";

/// An answer longer than this is more than a quick line.
const QUICK_REPLY_CHARS: usize = 400;

/// May this turn borrow `target` quietly? Only a short conversational question, and only a
/// mode that talks (no web research, no acting on the computer) and is not the Tutor: a lesson
/// request always moves the chat to the Tutor (the founder relies on that switch).
pub(super) fn borrows_quietly(said: &str, target: &Role) -> bool {
    target.id != "tutor" && matches!(target.tools, Tools::None | Tools::Look) && super::source::conversational(said)
}

/// Did the borrowed answer turn into real work for that mode (panels, a skill, a long answer)?
/// Then the chat moves there after all.
pub(super) fn is_real_work(thought: &Thought) -> bool {
    let has_panels = thought.panels.as_array().is_some_and(|p| !p.is_empty()) || !thought.core_panels.is_empty();
    has_panels || !thought.actions.is_empty() || thought.reply.chars().count() > QUICK_REPLY_CHARS
}

/// The words shown and spoken when the turn really switches.
pub(super) fn announcement(title: &str) -> String {
    format!("{SWITCH_LINE}{title} mode for this. ")
}

/// A Decorator over a turn's progress for the FIRST answer of a turn: everything passes through
/// except the words of a reply that opens with "Switching to …". Those are held back, because
/// whether the turn really switches (and so whether to say it) is decided after the answer;
/// `find` says the line itself when it does. Call `release` when the answer did not switch.
pub(super) struct HoldSwitchLine<'a> {
    pass: &'a (dyn Fn(Progress) + Sync),
    words: Mutex<Held>,
}

#[derive(Default)]
struct Held {
    text: String,
    /// None: too few words yet to tell. Some(true): a switch line (dropped). Some(false): passing.
    switch: Option<bool>,
}

impl<'a> HoldSwitchLine<'a> {
    pub fn new(pass: &'a (dyn Fn(Progress) + Sync)) -> Self {
        HoldSwitchLine { pass, words: Mutex::new(Held::default()) }
    }

    /// Take one piece of progress (use as the answer's progress callback).
    pub fn feed(&self, p: Progress) {
        match p {
            Progress::ReplyText(words) => {
                if let Some(out) = self.words.lock().map(|mut held| held.take(words)).unwrap_or(None) {
                    (self.pass)(Progress::ReplyText(out));
                }
            }
            Progress::Reply(text) if text.trim_start().starts_with(SWITCH_LINE) => {}
            other => (self.pass)(other),
        }
    }

    /// The answer ended without a switch: show any words still held (a reply shorter than the
    /// start of a switch line).
    pub fn release(&self) {
        let rest = self.words.lock().map(|mut held| if held.switch == Some(true) { String::new() } else { std::mem::take(&mut held.text) }).unwrap_or_default();
        if !rest.is_empty() {
            (self.pass)(Progress::ReplyText(rest));
        }
    }
}

impl Held {
    /// New words in; the words to pass on now, if any.
    fn take(&mut self, words: String) -> Option<String> {
        match self.switch {
            Some(true) => None,
            Some(false) => Some(words),
            None => {
                self.text.push_str(&words);
                let start = self.text.trim_start();
                if start.len() < SWITCH_LINE.len() && SWITCH_LINE.starts_with(start) {
                    return None;
                }
                let switch = start.starts_with(SWITCH_LINE);
                self.switch = Some(switch);
                let text = std::mem::take(&mut self.text);
                (!switch).then_some(text)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keepers::kit::roles;

    #[test]
    fn quick_questions_borrow_quietly_and_lessons_switch() {
        // The bench (2026-11-27), in System Administrator mode.
        assert!(borrows_quietly("What's the capital of Japan?", &roles::get("assistant")));
        assert!(borrows_quietly("I want to run a marathon this spring, any tips?", &roles::get("companion")));
        assert!(!borrows_quietly("Teach me fractions", &roles::get("tutor")), "a lesson moves to the Tutor");
        assert!(!borrows_quietly("Can you help with my homework?", &roles::get("tutor")), "the Tutor is never borrowed");
        assert!(!borrows_quietly("Who won the match last night?", &roles::get("researcher")), "research with sources switches");
        assert!(!borrows_quietly("Tidy my downloads", &roles::get("system")), "acting on the computer switches");
    }

    #[test]
    fn panels_or_skills_make_it_real_work() {
        let line = Thought { reply: "The capital of Japan is Tokyo.".into(), ..Thought::default() };
        assert!(!is_real_work(&line));
        assert!(is_real_work(&Thought { panels: serde_json::json!([{"kind": "text"}]), ..line.clone() }));
        assert!(is_real_work(&Thought { reply: "word ".repeat(100), ..line }));
    }

    #[test]
    fn a_switch_line_is_held_and_other_words_pass() {
        let seen = Mutex::new(String::new());
        let pass = |p: Progress| if let Progress::ReplyText(w) = p { seen.lock().unwrap().push_str(&w) };
        let hold = HoldSwitchLine::new(&pass);
        for w in ["Swi", "tching to Assistant", " mode for this."] {
            hold.feed(Progress::ReplyText(w.into()));
        }
        hold.release();
        assert_eq!(*seen.lock().unwrap(), "", "the switch line is not typed");

        let hold = HoldSwitchLine::new(&pass);
        for w in ["The capital", " of Japan is Tokyo."] {
            hold.feed(Progress::ReplyText(w.into()));
        }
        assert_eq!(*seen.lock().unwrap(), "The capital of Japan is Tokyo.");

        seen.lock().unwrap().clear();
        let hold = HoldSwitchLine::new(&pass);
        hold.feed(Progress::ReplyText("Sw".into()));
        hold.release();
        assert_eq!(*seen.lock().unwrap(), "Sw", "a short reply still shows");
    }
}
