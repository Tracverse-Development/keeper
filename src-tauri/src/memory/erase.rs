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
        let matches: Vec<Fact> = rank::relevant(&facts, what, 3).into_iter().filter(|f| rank::relevant(std::slice::from_ref(f), what, 1).len() == 1 && overlaps(&f.text, what)).collect();
        for f in &matches {
            self.erase_fact(&f.id).await;
        }
        Ok(matches)
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
