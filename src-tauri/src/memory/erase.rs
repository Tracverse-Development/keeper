//! Forgetting, for real: a fact's or a chat's Knowledge Assets are discarded from Working Memory
//! (their words leave the node), here and from the backup of the memory's old place after the
//! one-graph move (docs/design/keeper-memory-graph.md). The one erase path: spoken "forget", the
//! Forget button and the memory screen all come here.

use super::records::{self, Fact, Retraction};
use super::{hot, overlaps, rank, Memory, WriteReceipt};
use crate::kernel::{time, Result};

impl Memory {
    /// Discard one asset here and from the backup of the old place. The backup may not have it
    /// (written after the move): only the current place's answer counts.
    async fn discard_everywhere(&self, name: &str) -> Result<()> {
        self.client.discard(&self.place, name).await?;
        if let Some(old) = &self.legacy {
            let _ = self.client.discard(old, name).await;
        }
        Ok(())
    }

    /// Retract the remembered facts that best match `what`; returns what was forgotten.
    pub async fn forget(&self, what: &str) -> Result<Vec<Fact>> {
        let (facts, _) = self.facts().await?;
        // The fact's own words (a mind naming the fact a new one replaces): that fact and no other.
        if let Some(exact) = facts.iter().find(|f| records::normalise(&f.text) == records::normalise(what)).cloned() {
            self.erase_fact(&exact.id).await;
            return Ok(vec![exact]);
        }
        let matches: Vec<Fact> = rank::relevant(&facts, what, 3).into_iter().filter(|f| rank::relevant(std::slice::from_ref(f), what, 1).len() == 1 && overlaps(&f.text, what)).collect();
        for f in &matches {
            self.erase_fact(&f.id).await;
        }
        Ok(matches)
    }

    /// A fact just learned replaces the older ones in its SLOT (`meaning::slot`: where the person
    /// lives, their job, their number, a favourite): each is erased like any forgotten fact, and
    /// returned so the person is told what was replaced. A fact with no slot replaces nothing,
    /// and when memory cannot be read nothing is erased.
    pub async fn replace_stale(&self, new: &Fact) -> Vec<Fact> {
        let Some(slot) = super::meaning::slot(&new.text) else { return vec![] };
        let Ok((facts, _)) = self.facts().await else { return vec![] };
        let stale = stale_in(&facts, new, &slot);
        for old in &stale {
            self.erase_fact(&old.id).await;
        }
        stale
    }

    /// Delete a chat for real: every turn in it and the chat itself are discarded from Working
    /// Memory (the person's words leave the node). Returns how many turns were erased. Stops at
    /// the first asset the node refuses, so a half-deleted chat is reported, never hidden.
    pub async fn erase_chat(&self, chat_id: &str) -> Result<usize> {
        let turns = self.chat_turns(chat_id).await?;
        for t in &turns {
            self.discard_everywhere(&format!("desk-turn-{}", t.id)).await?;
        }
        self.discard_everywhere(&format!("desk-chat-{chat_id}")).await?;
        hot::apply(&self.graph, hot::HotChange::DropChat(chat_id.to_string()));
        Ok(turns.len())
    }

    /// Stop recalling a fact at once (hot memory); `erase_fact` then removes it from the node.
    pub fn forget_now(&self, fact_id: &str) {
        hot::apply(&self.graph, hot::HotChange::Retract(fact_id.to_string()));
    }

    /// Forget a fact for real: its Knowledge Asset is discarded from Working Memory, so its words
    /// leave the node (DESK-ERASE-001). When the node cannot discard it (offline, or the fact is
    /// still waiting in the outbox) a retraction is written instead, and recall stops using it.
    /// The one erase path: spoken "forget", the Forget button and the memory screen all use it.
    pub async fn erase_fact(&self, fact_id: &str) -> WriteReceipt {
        let name = records::fact_asset_name(fact_id);
        match self.discard_everywhere(&name).await {
            Ok(()) => {
                hot::apply(&self.graph, hot::HotChange::Retract(fact_id.to_string()));
                WriteReceipt { name, ual: String::new(), status: "erased".into(), queued: false }
            }
            Err(_) => self.write(&Retraction { fact_id: fact_id.to_string(), at: time::now_iso() }).await,
        }
    }
}

/// The facts `new` makes out of date: others in the same slot, in the same mode's memory.
fn stale_in(facts: &[Fact], new: &Fact, slot: &str) -> Vec<Fact> {
    facts.iter().filter(|f| f.id != new.id && f.mode == new.mode && super::meaning::slot(&f.text).as_deref() == Some(slot)).cloned().collect()
}

#[cfg(test)]
mod stale_tests {
    use super::*;

    fn fact(text: &str) -> Fact {
        Fact::new(text, "general", "2026-11-25T10:00:00Z")
    }

    #[test]
    fn a_new_address_replaces_the_old_one_and_nothing_else() {
        let facts = vec![fact("You live in Port of Spain"), fact("Your sister is Maya"), fact("Your favourite colour is green"), fact("Your phone number is 555-0100")];
        let moved = fact("You live in Boston");
        let slot = super::super::meaning::slot(&moved.text).unwrap();
        assert_eq!(stale_in(&facts, &moved, &slot).iter().map(|f| f.text.as_str()).collect::<Vec<_>>(), vec!["You live in Port of Spain"]);
        let colour = fact("Your favorite colour is blue");
        let slot = super::super::meaning::slot(&colour.text).unwrap();
        assert_eq!(stale_in(&facts, &colour, &slot).len(), 1, "one favourite colour at a time");
        // Saying the same fact again replaces nothing (it is the same record).
        let same = fact("You live in Port of Spain");
        assert!(stale_in(&facts, &same, "you live in").is_empty());
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::{node, DkgClient, Place};

    /// The real node, in a sub-graph: a new address replaces the old one, a fact named by its
    /// own words is forgotten alone, and a fact with topic words comes back with them.
    /// `cargo test --lib live_stale -- --ignored --nocapture` (writes only to `umoja-desk-staletest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_stale_facts_are_replaced_and_topics_survive_the_round_trip() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = format!("umoja-desk-staletest-{}", chrono::Utc::now().timestamp_millis());
        client.ensure_graph(&graph, "stale test").await.unwrap();
        client.ensure_sub_graph(&graph, "keeper-t").await.unwrap();
        let memory = Memory::at(client, Place::new(&graph, Some("keeper-t")));
        let at = "2026-11-01T10:00:00Z";
        for text in ["You live in Port of Spain", "Your parents live in Arima", "Your sister is Maya"] {
            memory.write(&Fact::new(text, "general", at)).await;
        }
        let moved = Fact::new("You live in Boston", "place", "2026-11-26T10:00:00Z").about(&["home".into(), "city".into(), "address".into()]);
        let replaced = memory.replace_stale(&moved).await;
        assert_eq!(replaced.iter().map(|f| f.text.as_str()).collect::<Vec<_>>(), vec!["You live in Port of Spain"]);
        memory.write(&moved).await;
        crate::memory::hot::clear();
        let (facts, _) = memory.facts().await.unwrap();
        let texts: Vec<&str> = facts.iter().map(|f| f.text.as_str()).collect();
        println!("{texts:?}");
        assert!(texts.contains(&"You live in Boston") && !texts.contains(&"You live in Port of Spain"), "the old address is gone from the node");
        assert!(texts.contains(&"Your parents live in Arima") && texts.contains(&"Your sister is Maya"), "nothing else was touched");
        assert_eq!(facts.iter().find(|f| f.text == "You live in Boston").unwrap().topics, vec!["home", "city", "address"], "topic words come back from the node");
        let gone = memory.forget("Your parents live in Arima").await.unwrap();
        assert_eq!(gone.len(), 1, "named by its own words: that fact alone");
        assert!(crate::memory::rank::relevant(&facts, "where is home these days?", 1)[0].text.contains("Boston"), "found by meaning");
    }
}
