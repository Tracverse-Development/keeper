//! Feelings: an optional, SIMULATED mood for a keeper (docs/design/keeper-feelings.md). A small,
//! deterministic engine kept outside the language model, after ALMA (Gebhard, AAMAS 2005):
//! personality (the soul) sets a baseline; a mood point in PAD space (pleasure, arousal,
//! dominance; Mehrabian) drifts back to it over hours; short emotions from an OCC table
//! (Ortony, Clore & Collins 1988) pull and push the mood. Every change records its cause, so the
//! person can see why the keeper feels as it does.
//!
//! Safety rules are hard constraints here, not hopes in a prompt (OpenAI/MIT 2025 affective-use
//! study, APA 2025 advisory, De Freitas et al. 2025 on manipulative goodbyes, EU AI Act Art. 5):
//! it is a labelled simulation; it never pressures, guilts or blames the person; it is never
//! below a floor of pleasure (a "quiet" day at worst, never anger at the person); it never changes
//! facts, refusals or safety advice; it is off in the work modes; a person in distress gets a
//! neutral, supportive keeper (`appraise` sets `distress`).

pub mod appraise;
pub mod engine;
pub mod pad;
pub mod store;
pub mod touch;


