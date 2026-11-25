//! The memory path against the REAL DKG node on this computer (LES-001, umoja-ark LES-011):
//! write → recall → forget → counts, through the same code the app runs. Ignored by default;
//! run with `cargo test live_ -- --ignored`. Writes only to the `umoja-desk-livetest` graph.

use super::*;
use crate::brain::{reflex, Context};
use crate::dkg::{node, DkgClient};

const GRAPH: &str = "umoja-desk-livetest";

async fn live_memory() -> Memory {
    let home = dirs::home_dir().unwrap().join(".dkg");
    let loc = node::locate(&home).expect("a DKG node in ~/.dkg");
    let client = DkgClient::new(&loc);
    client.ensure_graph(GRAPH, "Umoja Desk live test").await.expect("graph");
    Memory::new(client, GRAPH)
}

#[tokio::test]
#[ignore]
async fn live_remember_recall_forget() {
    let memory = live_memory().await;
    let stamp = time::now_iso();
    let said = format!("I love sorrel with ginger {stamp}");
    let ctx = Context { said: said.clone(), assistant_name: "Umoja".into(), facts: vec![], recent: vec![], now_local: "now".into(), may_act: false };
    let thought = reflex::think(&ctx);
    assert_eq!(thought.remember.len(), 1, "the reflex mind learns the statement");

    let fact = Fact::new(&thought.remember[0].text, &thought.remember[0].category, &stamp);
    let receipt = memory.write(&fact).await;
    assert!(!receipt.queued, "the node took the write");
    assert!(receipt.ual.starts_with("did:dkg:"), "a UAL came back: {}", receipt.ual);

    let recall = memory.recall("what drink with ginger do I love?").await.expect("recall");
    assert!(recall.facts.iter().any(|f| f.id == fact.id), "the new fact is recalled");
    assert_eq!(recall.traces.len(), 2);

    let turn = Turn::new(&said, "Got it.", "reflex", &stamp);
    assert!(!memory.write(&turn).await.queued);
    let (turns, _) = memory.recent_turns().await.expect("turns");
    assert!(turns.iter().any(|t| t.id == turn.id), "the turn is on the graph");

    let forgotten = memory.forget(&format!("sorrel with ginger {stamp}")).await.expect("forget");
    assert!(forgotten.iter().any(|f| f.id == fact.id), "forget found the fact");
    let (facts, _) = memory.facts().await.expect("facts");
    assert!(!facts.iter().any(|f| f.id == fact.id), "a retracted fact is never recalled again");

    let counts = memory.counts().await.expect("counts");
    assert!(counts.turns >= 1);
}

#[tokio::test]
#[ignore]
async fn live_reminders_reload() {
    let memory = live_memory().await;
    let due = time::iso(time::now() + chrono::Duration::hours(2));
    let reminder = Reminder::new(&format!("stretch {}", time::now_iso()), &due, &time::now_iso());
    assert!(!memory.write(&reminder).await.queued);
    let upcoming = memory.upcoming_reminders().await.expect("reminders");
    assert!(upcoming.iter().any(|r| r.id == reminder.id), "a future reminder reloads from the DKG");
}
