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
    /// What writing this record changes in hot memory (`hot`), if anything recall reads.
    fn hot(&self) -> Option<super::hot::HotChange> {
        None
    }
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

/// The Knowledge Asset a fact is written as (one asset per fact, so it can be erased alone).
pub fn fact_asset_name(fact_id: &str) -> String {
    format!("desk-fact-{fact_id}")
}

impl Record for Fact {
    fn hot(&self) -> Option<super::hot::HotChange> {
        Some(super::hot::HotChange::Fact(self.clone()))
    }
    fn asset_name(&self) -> String {
        fact_asset_name(&self.id)
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
    /// The chat this turn belongs to ("" for turns from before chats existed).
    pub chat: String,
    /// The Stage panels this turn showed (its scene), validated.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub panels: Vec<crate::stage::Panel>,
}

impl Turn {
    pub fn new(said: &str, replied: &str, mind: &str, at: &str, chat: &str) -> Turn {
        Turn { id: short_hash(&format!("{at}\u{0}{said}"), 16), said: said.into(), replied: replied.into(), mind: mind.into(), at: at.into(), chat: chat.into(), panels: vec![] }
    }

    pub fn with_panels(mut self, panels: &[crate::stage::Panel]) -> Turn {
        self.panels = panels.to_vec();
        self
    }
    pub fn iri(&self) -> String {
        entity("turn", &self.id)
    }
}

impl Record for Turn {
    fn hot(&self) -> Option<super::hot::HotChange> {
        Some(super::hot::HotChange::Turn(self.clone()))
    }
    fn asset_name(&self) -> String {
        format!("desk-turn-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        let b = AssetBuilder::new(&self.iri())
            .a(class::TURN)
            .a("schema:Conversation")
            .text(pred::SAID, &self.said)
            .text(pred::REPLIED, &self.replied)
            .text(pred::MIND, &self.mind)
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at);
        let b = if self.chat.is_empty() { b } else { b.link(pred::IN_CHAT, &entity("chat", &self.chat)) };
        let b = if self.panels.is_empty() { b } else { b.text(pred::PANELS, &serde_json::to_string(&self.panels).unwrap_or_default()) };
        b.build()
    }
}

/// A conversation thread: its turns link to it (`desk:inChat`), so a chat is one query away.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub at: String,
}

impl Chat {
    /// A new chat named after its first message.
    pub fn start(first_message: &str, at: &str) -> Chat {
        let title: String = first_message.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(60).collect();
        Chat { id: short_hash(&format!("{at}\u{0}chat\u{0}{first_message}"), 16), title, at: at.into() }
    }
}

impl Record for Chat {
    fn asset_name(&self) -> String {
        format!("desk-chat-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("chat", &self.id))
            .a(class::CHAT)
            .a("schema:Conversation")
            .text(pred::NAME, &self.title)
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
    fn hot(&self) -> Option<super::hot::HotChange> {
        Some(super::hot::HotChange::Retract(self.fact_id.clone()))
    }
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
