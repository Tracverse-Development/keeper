//! The instant runner: which ability a person's words ask for, in which mode.

use super::asked;
use crate::keepers::kit::roles;

fn id(said: &str, mode: &str) -> Option<&'static str> {
    asked(said, &roles::get(mode)).map(|(ability, _)| ability.id)
}

#[test]
fn a_mode_without_the_ability_leaves_its_words_to_the_mind() {
    assert_eq!(id("what's my battery?", "assistant"), Some("battery"));
    assert_eq!(id("what's my battery?", "tutor"), None);
    assert_eq!(asked("What's on tomorrow?", &roles::get("assistant")).unwrap().1["day"], "tomorrow");
}
