//! "What's my battery?", "what Wi-Fi am I on?", "how much space do I have?": answered at once by
//! the computer pack's own abilities. The instant answer only NAMES the ability; the turn runs it
//! like any request (the mode's skill rules apply, the action is recorded), so there is one
//! implementation of each reading.

use std::sync::OnceLock;

use regex::Regex;

use crate::brain::Thought;
use crate::sdk::ActionRequest;

/// (phrasings, the ability that answers them). Whole phrasings only, so anything else about the
/// battery or the network goes to the keeper's brain.
const ASKS: &[(&str, &str)] = &[
    (r"(?i)^(?:please\s+)?(?:what(?:'s| is) my battery(?: level| at)?|how much battery (?:do i have|is left|have i got)(?: left)?|battery(?: level| status)?|is my (?:mac|laptop|computer) charging|how(?:'s| is) my battery)\s*[?.!]?$", "battery"),
    (r"(?i)^(?:please\s+)?(?:what wi-?fi am i on|which wi-?fi (?:am i on|is this)|what(?:'s| is) my wi-?fi(?: signal| network)?|how(?:'s| is) my wi-?fi(?: signal)?|wi-?fi (?:signal|status))\s*[?.!]?$", "wifi"),
    (r"(?i)^(?:please\s+)?(?:how much (?:free )?(?:disk |storage )?space (?:do i have|is left|have i got)(?: left)?(?: on (?:my|this) (?:mac|computer|disk|drive))?|(?:free )?disk space|how full is (?:my|this) (?:disk|drive|mac|computer))\s*[?.!]?$", "disk-space"),
];

/// The ability a whole phrasing asks for, if it is one of [`ASKS`].
pub fn asked(said: &str) -> Option<&'static str> {
    static COMPILED: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    let compiled = COMPILED.get_or_init(|| ASKS.iter().map(|(pattern, id)| (Regex::new(pattern).expect("computer phrasing compiles"), *id)).collect());
    compiled.iter().find(|(r, _)| r.is_match(said.trim())).map(|(_, id)| *id)
}

/// The instant answer: the ability to run, when this system offers it and the keeper's mode may
/// use it (otherwise the brain answers in that mode's own way).
pub fn answer(mode: &str, said: &str) -> Option<Thought> {
    let id = asked(said)?;
    let usable = crate::sdk::registry::find(id).is_some() && crate::keepers::kit::roles::get(mode).allows(id);
    usable.then(|| Thought { actions: vec![ActionRequest { skill: id.into(), input: serde_json::json!({}) }], ..Thought::default() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_phrasings_name_their_ability() {
        for (said, id) in [("What's my battery?", "battery"), ("how much battery do I have left", "battery"), ("is my laptop charging?", "battery"), ("What Wi-Fi am I on?", "wifi"), ("how's my wifi signal", "wifi"), ("How much space do I have?", "disk-space"), ("how much free disk space is left on my mac?", "disk-space"), ("how full is my drive", "disk-space")] {
            assert_eq!(asked(said), Some(id), "{said}");
        }
        for brain in ["why does my battery drain so fast?", "what is wifi", "how much space is in a cubic metre", "battery acid on the floor"] {
            assert_eq!(asked(brain), None, "{brain} goes to the brain");
        }
    }

    #[test]
    fn a_mode_without_the_ability_leaves_it_to_the_brain() {
        let thought = answer("assistant", "what's my battery?").unwrap();
        assert_eq!(thought.actions[0].skill, "battery");
        assert!(answer("tutor", "what's my battery?").is_none());
    }
}
