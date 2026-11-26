//! Memory: the Facade over the DKG for everything the assistant remembers and recalls.
//!
//! Remembering = writing a Knowledge Asset into the person's Context Graph (Working Memory,
//! private to this node). Recalling = bounded SPARQL over that graph. There is no other store:
//! the assistant knows what the graph says, and every answer can show the queries behind it.

pub mod catalog;
pub mod hot;
pub mod later;
pub mod outbox;
pub mod relocate;
pub mod panel_events;
pub mod pinned_scenes;
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
    /// The last exchanges of THIS chat (its own train of thought), newest first.
    pub recent: Vec<Turn>,
    /// One line per other recent chat ("“Foreman looks blank” at 7:35 PM"): known, not mixed in.
    pub elsewhere: Vec<String>,
    pub traces: Vec<QueryTrace>,
}

/// Exchanges of this chat that a turn sees.
const THREAD_TURNS: usize = 6;
/// Other chats named in the "elsewhere" line.
const ELSEWHERE: usize = 3;

/// Split recent turns (newest first, every chat) into this chat's own and a line per other chat.
pub fn thread(recent: &[Turn], chat: &str) -> (Vec<Turn>, Vec<String>) {
    let own: Vec<Turn> = recent.iter().filter(|t| !chat.is_empty() && t.chat == chat).take(THREAD_TURNS).cloned().collect();
    let mut seen = std::collections::HashSet::new();
    let elsewhere = recent
        .iter()
        .filter(|t| t.chat != chat && seen.insert(t.chat.clone()))
        .take(ELSEWHERE)
        .map(|t| {
            let said: String = t.said.chars().take(80).collect();
            let when = time::parse_iso(&t.at).map(|d| d.with_timezone(&chrono::Local).format(" at %-I:%M %p").to_string()).unwrap_or_default();
            format!("\u{201c}{said}\u{201d}{when}")
        })
        .collect();
    (own, elsewhere)
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
    /// The keeper's place: its sub-graph of the home context graph (or a whole graph, before the move).
    place: crate::dkg::Place,
    /// Hot-memory key for this place ("graph/sub").
    graph: String,
    /// The memory's old place, kept as a backup after the move: erasure removes it there too.
    legacy: Option<crate::dkg::Place>,
}

const LAYER: Layer = Layer::Working;
const LAYER_NAME: &str = "working-memory";

impl Memory {
    /// Memory over a whole graph (tests on scratch graphs).
    #[cfg(test)]
    pub fn new(client: DkgClient, graph: &str) -> Memory {
        Memory::at(client, crate::dkg::Place::from(graph))
    }

    /// Memory kept in one place (a sub-graph of the home graph).
    pub fn at(client: DkgClient, place: crate::dkg::Place) -> Memory {
        let graph = place.key();
        Memory { client, place, graph, legacy: None }
    }

    /// Also erase from the memory's old place (its backup from before the move).
    pub fn with_legacy(mut self, legacy: Option<crate::dkg::Place>) -> Memory {
        self.legacy = legacy.filter(|l| *l != self.place);
        self
    }

    /// Discard one asset here and from the backup of the old place. The backup may not have it
    /// (written after the move): only the current place's answer counts.
    async fn discard_everywhere(&self, name: &str) -> Result<()> {
        self.client.discard(&self.place, name).await?;
        if let Some(old) = &self.legacy {
            let _ = self.client.discard(old, name).await;
        }
        Ok(())
    }

    /// The hot-memory key of this place ("graph/sub"; the graph id alone before the move).
    pub fn graph(&self) -> &str {
        &self.graph
    }


    pub fn client(&self) -> &DkgClient {
        &self.client
    }

    /// Write one record. A node that is down never loses the record: it waits in the outbox.
    pub async fn write(&self, record: &impl Record) -> WriteReceipt {
        // Hot memory first: the next recall sees this record even before the node has it.
        if let Some(change) = record.hot() {
            hot::apply(&self.graph, change);
        }
        self.write_quads(record.asset_name(), &record.quads()).await
    }

    /// Write without waiting: hot memory changes now (recall, streaks and panels see it at once)
    /// and the asset goes to the node in the background. For panel actions, where the person is
    /// watching and the node's answer changes nothing on screen.
    pub fn write_soon(&self, record: &impl Record) {
        if let Some(change) = record.hot() {
            hot::apply(&self.graph, change);
        }
        let (memory, name, quads) = (self.clone(), record.asset_name(), record.quads());
        tauri::async_runtime::spawn(async move {
            memory.write_quads(name, &quads).await;
        });
    }

    /// Send one asset to the node (used by `write` and by `later`, which applied hot memory itself).
    pub async fn write_quads(&self, name: String, quads: &[crate::dkg::Quad]) -> WriteReceipt {
        match self.client.write_asset(&self.place, &name, quads).await {
            Ok(w) => {
                if outbox::waiting() > 0 {
                    outbox::flush(&self.client).await;
                }
                WriteReceipt { name, ual: w.ka_ual, status: w.status, queued: false }
            }
            // Already kept (an identical record written before): done, never queued to retry.
            Err(crate::kernel::DeskError::Exists(_)) => WriteReceipt { name, ual: String::new(), status: "already in memory".into(), queued: false },
            Err(_) => {
                outbox::hold(&self.place, &name, quads);
                WriteReceipt { name, ual: String::new(), status: "waiting for the node".into(), queued: true }
            }
        }
    }

    async fn run(&self, q: &queries::Query) -> Result<(Vec<Row>, QueryTrace)> {
        let sparql = q.sparql();
        let started = Instant::now();
        let rows = self.client.query(&self.place, &sparql, LAYER).await?;
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
                Fact { id: iri.rsplit(':').next().unwrap_or_default().to_string(), text: get(r, "text"), category: get(r, "category"), at: get(r, "at"), mode: get(r, "mode") }
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
            .map(|r| Turn { id: get(r, "t").rsplit(':').next().unwrap_or_default().into(), said: get(r, "said"), replied: get(r, "replied"), mind: get(r, "mind"), at: get(r, "at"), chat: get(r, "c").rsplit(':').next().unwrap_or_default().into(), panels: vec![], mode: String::new() })
            .collect();
        Ok((turns, trace))
    }

    /// Ask one catalog question (validated parameters; see `catalog`).
    pub async fn ask(&self, id: &str, args: &std::collections::HashMap<String, String>) -> Result<(Vec<Row>, QueryTrace)> {
        let q = catalog::find(id).ok_or_else(|| crate::kernel::DeskError::Invalid(format!("There is no question called {id}.")))?;
        let sparql = catalog::build(q, args)?;
        let started = Instant::now();
        let rows = self.client.query(&self.place, &sparql, LAYER).await?;
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
                mode: get(r, "mode"),
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
    /// `mode`: the mode this turn is in; work facts of other modes are left out (their desks).
    pub async fn recall(&self, said: &str, chat: &str, mode: &str) -> Result<Recall> {
        let started = Instant::now();
        let snap = match hot::get(&self.graph) {
            Some(snap) => snap,
            None => {
                let snap = self.load_hot().await?;
                hot::load(&self.graph, snap.clone());
                snap
            }
        };
        let mut facts: Vec<Fact> = snap.facts.into_iter().filter(|f| f.belongs_in(mode)).collect();
        // Pinned facts always come along, as if they were identity.
        for f in facts.iter_mut().filter(|f| snap.pinned.contains(&f.id)) {
            f.category = "identity".into();
        }
        let mut ranked = rank::relevant(&facts, said, 14);
        // What the person practised lately shapes the next lesson.
        ranked.extend(snap.practice.into_iter().take(6));
        let trace = QueryTrace { label: "hot memory (kept in step with your DKG graph)".into(), sparql: String::new(), rows: ranked.len() + snap.recent.len(), ms: started.elapsed().as_millis(), layer: LAYER_NAME };
        let (recent, elsewhere) = thread(&snap.recent, chat);
        Ok(Recall { facts: ranked, recent, elsewhere, traces: vec![trace] })
    }

    /// What recall needs, read from the DKG (fills hot memory).
    async fn load_hot(&self) -> Result<hot::Snapshot> {
        let ((facts, _), (recent, _), pinned, practice, scene_keys, streak) = tokio::try_join!(self.facts(), self.recent_turns(), async { Ok(self.pinned().await) }, async { Ok(self.practice().await) }, async { Ok(self.scene_keys().await) }, async { Ok(self.streak_from_dkg().await) })?;
        Ok(hot::Snapshot { facts, pinned, recent, practice, scene_keys, streak })
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

fn get(row: &Row, key: &str) -> String {
    row.get(key).cloned().unwrap_or_default()
}

/// At least one meaningful word in common (forget never retracts an unrelated fact).
fn overlaps(fact: &str, what: &str) -> bool {
    let fact = fact.to_lowercase();
    what.to_lowercase().split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4).any(|w| fact.contains(w))
}

#[cfg(test)]
mod thread_tests {
    use super::*;

    fn t(said: &str, chat: &str, at: &str) -> Turn {
        Turn { id: said.into(), said: said.into(), replied: "ok".into(), mind: String::new(), at: at.into(), chat: chat.into(), panels: vec![], mode: String::new() }
    }

    #[test]
    fn a_chat_sees_its_own_thread_and_only_names_the_others() {
        let recent = vec![
            t("what did I ask you here?", "a", "2026-11-25T22:00:00Z"),
            t("Foreman looks blank", "b", "2026-11-25T21:59:00Z"),
            t("Hey how are you?", "a", "2026-11-25T19:35:00Z"),
            t("teach me math", "c", "2026-11-25T11:32:00Z"),
            t("more math", "c", "2026-11-25T11:33:00Z"),
        ];
        let (own, elsewhere) = thread(&recent, "a");
        assert_eq!(own.iter().map(|x| x.said.as_str()).collect::<Vec<_>>(), ["what did I ask you here?", "Hey how are you?"]);
        assert_eq!(elsewhere.len(), 2, "one line per other chat: {elsewhere:?}");
        assert!(elsewhere[0].contains("Foreman looks blank"));
        let (own, _) = thread(&recent, "");
        assert!(own.is_empty(), "a new chat starts with no thread");
    }
}
