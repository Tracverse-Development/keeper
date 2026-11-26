//! Modes: HOW a keeper answers, chosen per keeper (and changeable any time): Balanced (the
//! default), Explainer (more panels, deeper), Brief (one dense panel), Research (searches the web
//! and cites real sources in a Sources panel), Tutor (teaches by asking), Chat (words only).
//! A mode adds its rules after the Stage rules in the engine's fixed instructions, so a warm
//! spare is kept per mode (`engines::warm` keys on the instructions).

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Mode {
    pub id: &'static str,
    pub name: &'static str,
    pub blurb: &'static str,
    /// Added to the engine's instructions ("" for Balanced: the Stage rules as they are).
    #[serde(skip)]
    pub rules: &'static str,
    /// Short chat turns may use the quick helper model in this mode.
    pub quick: bool,
    /// Searches the web (read only) and must cite sources.
    pub research: bool,
    /// Shows panels at all (Chat answers in words).
    pub visual: bool,
}

pub const DEFAULT: &str = "balanced";

pub const MODES: &[Mode] = &[
    Mode { id: "balanced", name: "Balanced", blurb: "Words, with panels when they help.", rules: "", quick: true, research: false, visual: true },
    Mode {
        id: "explainer",
        name: "Explainer",
        blurb: "Teaches deeply, step by step, with more panels.",
        rules: "MODE: EXPLAINER. The person wants to understand deeply. Use 4 to 6 panels that build up in order: the big picture first, \
then the parts (cards or steps), a worked example, a diagram or table where it helps, and end with a quiz panel that checks the key idea. \
Use one everyday analogy. Explain the why, not only the what. The spoken reply stays short and introduces the panels.",
        quick: false,
        research: false,
        visual: true,
    },
    Mode {
        id: "brief",
        name: "Brief",
        blurb: "The essentials only: one sentence and one panel.",
        rules: "MODE: BRIEF. Be brief: one sentence spoken, and at most ONE dense panel (a table, a short text with bullets, or a chart) \
that holds only the essentials. No quizzes, no follow-up suggestions, no repetition.",
        quick: true,
        research: false,
        visual: true,
    },
    Mode {
        id: "research",
        name: "Research",
        blurb: "Searches the web and cites real sources.",
        rules: "MODE: RESEARCH. Work like a careful researcher. Use WebSearch to find current, authoritative sources (official bodies, \
peer-reviewed or primary sources first) and WebFetch to read the ones you rely on. Every factual claim in your panels must come from a source \
you actually read; mark it with the source number in brackets, like [1]. Say plainly where sources disagree or evidence is weak, and give \
dates for anything that changes over time. ALWAYS end with a sources panel: {\"kind\":\"sources\",\"title\":\"Sources\",\"items\":[{\"title\",\"url\",\"note\"}]} \
listing each source you cited, in order, with its real URL and one line on what it supports. Never invent a source or a URL.",
        quick: false,
        research: true,
        visual: true,
    },
    Mode {
        id: "tutor",
        name: "Tutor",
        blurb: "Guides you to the answer with questions and practice.",
        rules: "MODE: TUTOR. Teach the way a good tutor does: do not hand over the full answer at once. Find out what the person already \
knows, give one small step or hint at a time, and ask a question back. Use a quiz or flashcards panel to practise, and praise effort. \
Give the full answer only when the person asks for it or has tried.",
        quick: false,
        research: false,
        visual: true,
    },
    Mode { id: "chat", name: "Chat", blurb: "Just conversation, no panels.", rules: "MODE: CHAT. Talk naturally in words. No panels unless the person asks to see something.", quick: true, research: false, visual: false },
];

pub fn get(id: &str) -> &'static Mode {
    MODES.iter().find(|m| m.id == id).unwrap_or(&MODES[0])
}

pub fn exists(id: &str) -> bool {
    MODES.iter().any(|m| m.id == id)
}

#[cfg(test)]
mod tests {
    #[test]
    fn modes_are_complete_and_balanced_is_the_default() {
        assert_eq!(super::get("nonsense").id, "balanced");
        assert_eq!(super::get("").id, super::DEFAULT);
        assert!(super::get("research").rules.contains("\"kind\":\"sources\""), "research asks for a sources panel");
        assert!(super::MODES.iter().filter(|m| m.research).all(|m| !m.quick), "research never goes to the quick model");
    }
}
