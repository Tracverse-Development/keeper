//! The records Keeper keeps on the DKG, one Knowledge Asset each.
//! Every record knows its stable KA name and its quads (the `Record` trait), and every quad set
//! carries provenance: who wrote it (`prov:wasAttributedTo`), when, and what it came from.

use serde::Serialize;

use crate::dkg::ontology::{class, entity, pred, ASSISTANT, OWNER};
use crate::dkg::{AssetBuilder, Quad};
use crate::kernel::slug::short_hash;

/// A record that becomes one Knowledge Asset.
pub trait Record {
    /// A stable lowercase KA name: the same record always gets the same name.
    fn asset_name(&self) -> String;
    fn quads(&self) -> Vec<Quad>;
}

/// Normalised text for identity: case, spacing and final punctuation do not make a new fact.
pub fn normalise(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").trim_end_matches(['.', '!', '?']).to_lowercase()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fact {
    pub id: String,
    pub text: String,
    pub category: String,
    pub at: String,
}

impl Fact {
    pub fn new(text: &str, category: &str, at: &str) -> Fact {
        Fact { id: short_hash(&normalise(text), 16), text: text.trim().to_string(), category: category.to_string(), at: at.to_string() }
    }
    pub fn iri(&self) -> String {
        entity("fact", &self.id)
    }
}

impl Record for Fact {
    fn asset_name(&self) -> String {
        format!("desk-fact-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&self.iri())
            .a(class::FACT)
            .text(pred::TEXT, &self.text)
            .text(pred::CATEGORY, &self.category)
            .link(pred::ABOUT, OWNER)
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Turn {
    pub id: String,
    pub said: String,
    pub replied: String,
    pub mind: String,
    pub at: String,
}

impl Turn {
    pub fn new(said: &str, replied: &str, mind: &str, at: &str) -> Turn {
        Turn { id: short_hash(&format!("{at}\u{0}{said}"), 16), said: said.into(), replied: replied.into(), mind: mind.into(), at: at.into() }
    }
    pub fn iri(&self) -> String {
        entity("turn", &self.id)
    }
}

impl Record for Turn {
    fn asset_name(&self) -> String {
        format!("desk-turn-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&self.iri())
            .a(class::TURN)
            .a("schema:Conversation")
            .text(pred::SAID, &self.said)
            .text(pred::REPLIED, &self.replied)
            .text(pred::MIND, &self.mind)
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionRecord {
    pub id: String,
    pub skill: String,
    pub input: String,
    pub outcome: String,
    pub succeeded: bool,
    pub at: String,
    /// The turn that asked for it (provenance: `prov:wasDerivedFrom`).
    pub from_turn: String,
}

impl ActionRecord {
    pub fn new(skill: &str, input: &str, outcome: &str, succeeded: bool, at: &str, from_turn: &str) -> ActionRecord {
        ActionRecord {
            id: short_hash(&format!("{at}\u{0}{skill}\u{0}{input}"), 16),
            skill: skill.into(),
            input: input.into(),
            outcome: outcome.into(),
            succeeded,
            at: at.into(),
            from_turn: from_turn.into(),
        }
    }
}

impl Record for ActionRecord {
    fn asset_name(&self) -> String {
        format!("desk-action-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        let mut b = AssetBuilder::new(&entity("action", &self.id))
            .a(class::ACTION)
            .a("prov:Activity")
            .text(pred::SKILL, &self.skill)
            .text(pred::INPUT, &self.input)
            .text(pred::OUTCOME, &self.outcome)
            .text(pred::SUCCEEDED, if self.succeeded { "yes" } else { "no" })
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at);
        if !self.from_turn.is_empty() {
            b = b.link(pred::FROM, &entity("turn", &self.from_turn));
        }
        b.build()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub text: String,
    pub due_at: String,
    pub at: String,
}

impl Reminder {
    pub fn new(text: &str, due_at: &str, at: &str) -> Reminder {
        Reminder { id: short_hash(&format!("{due_at}\u{0}{}", normalise(text)), 16), text: text.into(), due_at: due_at.into(), at: at.into() }
    }
}

impl Record for Reminder {
    fn asset_name(&self) -> String {
        format!("desk-reminder-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("reminder", &self.id))
            .a(class::REMINDER)
            .text(pred::TEXT, &self.text)
            .time(pred::DUE_AT, &self.due_at)
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

/// "Forget that": DKG writes are additive, so forgetting is a new record that retracts the old
/// one, and every recall query leaves retracted facts out (see `queries::FACTS`).
#[derive(Debug, Clone, Serialize)]
pub struct Retraction {
    pub fact_id: String,
    pub at: String,
}

impl Record for Retraction {
    fn asset_name(&self) -> String {
        format!("desk-retraction-{}", self.fact_id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("retraction", &self.fact_id))
            .a(class::RETRACTION)
            .link(pred::RETRACTS, &entity("fact", &self.fact_id))
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_fact_said_twice_is_one_asset() {
        let a = Fact::new("I like sorrel.", "preference", "2026-11-25T10:00:00Z");
        let b = Fact::new("  i like   SORREL ", "preference", "2026-11-26T10:00:00Z");
        assert_eq!(a.asset_name(), b.asset_name());
    }

    #[test]
    fn an_action_links_back_to_its_turn() {
        let a = ActionRecord::new("open-app", "Notes", "Opened Notes", true, "2026-11-25T10:00:00Z", "abc");
        assert!(a.quads().iter().any(|q| q.predicate.ends_with("wasDerivedFrom") && q.object == "urn:umoja:desk:turn:abc"));
    }
}
