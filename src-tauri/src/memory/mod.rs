//! Memory: the Facade over the DKG for everything the assistant remembers and recalls.
//!
//! Remembering = writing a Knowledge Asset into the person's Context Graph (Working Memory,
//! private to this node). Recalling = bounded SPARQL over that graph. There is no other store:
//! the assistant knows what the graph says, and every answer can show the queries behind it.

pub mod catalog;
pub mod outbox;
pub mod panel_events;
pub mod queries;
pub mod rank;
pub mod records;
pub mod scene_cache;
#[cfg(test)]
mod live_test;
#[cfg(test)]
mod live_panels_test;

use std::time::Instant;

use serde::Serialize;

use crate::dkg::{DkgClient, Layer, Row};
use crate::kernel::{time, Result};
pub use records::{ActionRecord, Chat, Fact, Record, Reminder, Retraction, Turn};

/// What one query asked and found, for the window's "what I looked up" trail.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryTrace {
    pub label: String,
    pub sparql: String,
    pub rows: usize,
    pub ms: u128,
    pub layer: &'static str,
}

/// What one write produced on the DKG.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteReceipt {
    pub name: String,
    pub ual: String,
    pub status: String,
    /// The node was not reachable; the write waits in the outbox.
    pub queued: bool,
}

/// What recall hands the brain for one turn.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Recall {
    pub facts: Vec<Fact>,
    pub recent: Vec<Turn>,
    pub traces: Vec<QueryTrace>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Counts {
    pub facts: u64,
    pub turns: u64,
    pub actions: u64,
    pub reminders: u64,
    pub waiting: usize,
}

#[derive(Clone)]
pub struct Memory {
    client: DkgClient,
    graph: String,
}

const LAYER: Layer = Layer::Working;
const LAYER_NAME: &str = "working-memory";

impl Memory {
    pub fn new(client: DkgClient, graph: &str) -> Memory {
        Memory { client, graph: graph.to_string() }
    }

    pub fn graph(&self) -> &str {
        &self.graph
    }

    pub fn client(&self) -> &DkgClient {
        &self.client
    }

    /// Write one record. A node that is down never loses the record: it waits in the outbox.
    pub async fn write(&self, record: &impl Record) -> WriteReceipt {
        let name = record.asset_name();
        let quads = record.quads();
        match self.client.write_asset(&self.graph, &name, &quads).await {
            Ok(w) => {
                if outbox::waiting() > 0 {
                    outbox::flush(&self.client).await;
                }
                WriteReceipt { name, ual: w.ka_ual, status: w.status, queued: false }
            }
            // Already kept (an identical record written before): done, never queued to retry.
            Err(crate::kernel::DeskError::Exists(_)) => WriteReceipt { name, ual: String::new(), status: "already in memory".into(), queued: false },
            Err(_) => {
                outbox::hold(&self.graph, &name, &quads);
                WriteReceipt { name, ual: String::new(), status: "waiting for the node".into(), queued: true }
            }
        }
    }

    async fn run(&self, q: &queries::Query) -> Result<(Vec<Row>, QueryTrace)> {
        let sparql = q.sparql();
        let started = Instant::now();
        let rows = self.client.query(&self.graph, &sparql, LAYER).await?;
        let trace = QueryTrace { label: q.label.into(), sparql, rows: rows.len(), ms: started.elapsed().as_millis(), layer: LAYER_NAME };
        Ok((rows, trace))
    }

    /// Remembered facts, newest first, without the ones the person asked to forget.
    pub async fn facts(&self) -> Result<(Vec<Fact>, QueryTrace)> {
        let (rows, trace) = self.run(&queries::FACTS).await?;
        let (retracted, _) = self.run(&queries::RETRACTIONS).await?;
        let gone: std::collections::HashSet<String> = retracted.iter().map(|r| get(r, "fact")).collect();
        let facts = rows
            .iter()
            .filter(|r| !gone.contains(&get(r, "f")))
            .map(|r| {
                let iri = get(r, "f");
                Fact { id: iri.rsplit(':').next().unwrap_or_default().to_string(), text: get(r, "text"), category: get(r, "category"), at: get(r, "at") }
            })
            .collect::<Vec<_>>();
        let trace = QueryTrace { rows: facts.len(), ..trace };
        Ok((facts, trace))
    }

    /// The last few exchanges (context for a turn).
    pub async fn recent_turns(&self) -> Result<(Vec<Turn>, QueryTrace)> {
        self.turns(&queries::RECENT_TURNS).await
    }

    /// The conversation history (the window's Conversations tab).
    pub async fn history(&self) -> Result<(Vec<Turn>, QueryTrace)> {
        self.turns(&queries::HISTORY).await
    }

    async fn turns(&self, q: &queries::Query) -> Result<(Vec<Turn>, QueryTrace)> {
        let (rows, trace) = self.run(q).await?;
        let turns = rows
            .iter()
            .map(|r| Turn { id: get(r, "t").rsplit(':').next().unwrap_or_default().into(), said: get(r, "said"), replied: get(r, "replied"), mind: get(r, "mind"), at: get(r, "at"), chat: String::new(), panels: vec![] })
            .collect();
        Ok((turns, trace))
    }

    /// Ask one catalog question (validated parameters; see `catalog`).
    pub async fn ask(&self, id: &str, args: &std::collections::HashMap<String, String>) -> Result<(Vec<Row>, QueryTrace)> {
        let q = catalog::find(id).ok_or_else(|| crate::kernel::DeskError::Invalid(format!("There is no question called {id}.")))?;
        let sparql = catalog::build(q, args)?;
        let started = Instant::now();
        let rows = self.client.query(&self.graph, &sparql, LAYER).await?;
        let trace = QueryTrace { label: q.title.into(), sparql, rows: rows.len(), ms: started.elapsed().as_millis(), layer: LAYER_NAME };
        Ok((rows, trace))
    }

    /// The keeper's chats, newest first.
    pub async fn chats(&self) -> Result<Vec<Chat>> {
        let (rows, _) = self.ask("chats", &Default::default()).await?;
        Ok(rows.iter().map(|r| Chat { id: get(r, "c").rsplit(':').next().unwrap_or_default().into(), title: get(r, "title"), at: get(r, "at") }).collect())
    }

    /// One chat's turns, oldest first.
    pub async fn chat_turns(&self, chat: &str) -> Result<Vec<Turn>> {
        let args = [("chat".to_string(), chat.to_string())].into_iter().collect();
        let (rows, _) = self.ask("chat-turns", &args).await?;
        Ok(rows
            .iter()
            .map(|r| Turn {
                id: get(r, "t").rsplit(':').next().unwrap_or_default().into(),
                said: get(r, "said"),
                replied: get(r, "replied"),
                mind: get(r, "mind"),
                at: get(r, "at"),
                chat: chat.to_string(),
                // Re-validated on the way out: stored panels are data like any other.
                panels: serde_json::from_str::<serde_json::Value>(&get(r, "panels")).map(|v| crate::stage::read(&v)).unwrap_or_default(),
            })
            .collect())
    }

    pub async fn actions(&self) -> Result<(Vec<ActionRecord>, QueryTrace)> {
        let (rows, trace) = self.run(&queries::RECENT_ACTIONS).await?;
        let actions = rows
            .iter()
            .map(|r| ActionRecord {
                id: get(r, "a").rsplit(':').next().unwrap_or_default().into(),
                skill: get(r, "skill"),
                input: get(r, "input"),
                outcome: get(r, "outcome"),
                succeeded: get(r, "succeeded") != "no",
                at: get(r, "at"),
                from_turn: String::new(),
            })
            .collect();
        Ok((actions, trace))
    }

    /// Reminders still ahead of now (the ones a restart must schedule again).
    pub async fn upcoming_reminders(&self) -> Result<Vec<Reminder>> {
        let (rows, _) = self.run(&queries::REMINDERS).await?;
        let now = time::now();
        Ok(rows
            .iter()
            .map(|r| Reminder { id: get(r, "r").rsplit(':').next().unwrap_or_default().into(), text: get(r, "text"), due_at: get(r, "due"), at: get(r, "at") })
            .filter(|r| time::parse_iso(&r.due_at).is_some_and(|due| due > now))
            .collect())
    }

    pub async fn counts(&self) -> Result<Counts> {
        let (rows, _) = self.run(&queries::COUNTS).await?;
        let mut c = Counts { waiting: outbox::waiting(), ..Counts::default() };
        let mut retractions = 0;
        for r in rows {
            let n = get(&r, "n").parse().unwrap_or(0);
            match get(&r, "type").rsplit('#').next().unwrap_or_default() {
                "Fact" => c.facts = n,
                "Turn" => c.turns = n,
                "Action" => c.actions = n,
                "Reminder" => c.reminders = n,
                "Retraction" => retractions = n,
                _ => {}
            }
        }
        // One retraction per fact (its KA name is the fact's id), so this is the live count.
        c.facts = c.facts.saturating_sub(retractions);
        Ok(c)
    }

    /// Everything a brain needs for one turn: the relevant facts and the last few exchanges.
    pub async fn recall(&self, said: &str) -> Result<Recall> {
        let (mut facts, facts_trace) = self.facts().await?;
        // Pinned facts always come along, as if they were identity.
        let pinned = self.pinned().await;
        for f in facts.iter_mut().filter(|f| pinned.contains(&f.id)) {
            f.category = "identity".into();
        }
        let (recent, turns_trace) = self.recent_turns().await?;
        let mut ranked = rank::relevant(&facts, said, 14);
        // What the person practised lately shapes the next lesson.
        ranked.extend(self.practice().await.into_iter().take(6));
        Ok(Recall { facts: ranked, recent, traces: vec![facts_trace, turns_trace] })
    }

    /// Retract the remembered facts that best match `what`; returns what was forgotten.
    pub async fn forget(&self, what: &str) -> Result<Vec<Fact>> {
        let (facts, _) = self.facts().await?;
        let matches: Vec<Fact> = rank::relevant(&facts, what, 3).into_iter().filter(|f| rank::relevant(std::slice::from_ref(f), what, 1).len() == 1 && overlaps(&f.text, what)).collect();
        for f in &matches {
            self.write(&Retraction { fact_id: f.id.clone(), at: time::now_iso() }).await;
        }
        Ok(matches)
    }
}

fn get(row: &Row, key: &str) -> String {
    row.get(key).cloned().unwrap_or_default()
}

/// At least one meaningful word in common (forget never retracts an unrelated fact).
fn overlaps(fact: &str, what: &str) -> bool {
    let fact = fact.to_lowercase();
    what.to_lowercase().split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4).any(|w| fact.contains(w))
}
