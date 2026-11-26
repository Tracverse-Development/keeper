//! Styles: HOW a keeper shows its answer, chosen per keeper (changeable any time): Balanced (the
//! default), Explainer (more panels, deeper), Brief (one dense panel), Chat (words only). WHAT job
//! it is doing is its mode (`keepers::kit::roles`; docs/design/keeper-modes.md). A style adds its
//! rules after the Stage rules in the engine's fixed instructions, so a warm spare is kept per
//! style (`engines::warm` keys on the instructions).

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Style {
    pub id: &'static str,
    pub name: &'static str,
    pub blurb: &'static str,
    /// Added to the engine's instructions ("" for Balanced: the Stage rules as they are).
    #[serde(skip)]
    pub rules: &'static str,
    /// Short chat turns may use the quick helper model in this mode.
    pub quick: bool,
    /// Shows panels at all (Chat answers in words).
    pub visual: bool,
}

pub const DEFAULT: &str = "balanced";

pub const STYLES: &[Style] = &[
    Style { id: "balanced", name: "Balanced", blurb: "Words, with panels when they help.", rules: "", quick: true, visual: true },
    Style {
        id: "explainer",
        name: "Explainer",
        blurb: "Teaches deeply, step by step, with more panels.",
        rules: "STYLE: EXPLAINER. The person wants to understand deeply. Use 4 to 6 panels that build up in order: the big picture first, \
then the parts (cards or steps), a worked example, a diagram or table where it helps, and end with a quiz panel that checks the key idea. \
Use one everyday analogy. Explain the why, not only the what. The spoken reply stays short and introduces the panels.",
        quick: false,
        visual: true,
    },
    Style {
        id: "brief",
        name: "Brief",
        blurb: "The essentials only: one sentence and one panel.",
        rules: "STYLE: BRIEF. Be brief: one sentence spoken, and at most ONE dense panel (a table, a short text with bullets, or a chart) \
that holds only the essentials. No quizzes, no follow-up suggestions, no repetition.",
        quick: true,
        visual: true,
    },
    Style { id: "chat", name: "Chat", blurb: "Just conversation, no panels.", rules: "STYLE: CHAT. Talk naturally in words. No panels unless the person asks to see something.", quick: true, visual: false },
];

pub fn get(id: &str) -> &'static Style {
    STYLES.iter().find(|m| m.id == id).unwrap_or(&STYLES[0])
}

pub fn exists(id: &str) -> bool {
    STYLES.iter().any(|m| m.id == id)
}

#[cfg(test)]
mod tests {
    #[test]
    fn styles_are_complete_and_balanced_is_the_default() {
        assert_eq!(super::get("nonsense").id, "balanced");
        assert_eq!(super::get("").id, super::DEFAULT);
        assert!(super::STYLES.iter().any(|s| !s.visual), "Chat answers in words");
        assert_eq!(super::STYLES.iter().map(|s| s.id).collect::<Vec<_>>(), ["balanced", "explainer", "brief", "chat"]);
    }
}
