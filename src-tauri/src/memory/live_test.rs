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
    client.ensure_graph(GRAPH, "Keeper live test").await.expect("graph");
    Memory::new(client, GRAPH)
}

#[tokio::test]
#[ignore]
async fn live_remember_recall_forget() {
    let memory = live_memory().await;
    let stamp = time::now_iso();
    let said = format!("I love sorrel with ginger {stamp}");
    let ctx = Context { said: said.clone(), assistant_name: "Keeper".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "now".into(), may_act: false };
    let thought = reflex::think(&ctx);
    assert_eq!(thought.remember.len(), 1, "the reflex mind learns the statement");

    let fact = Fact::new(&thought.remember[0].text, &thought.remember[0].category, &stamp);
    let receipt = memory.write(&fact).await;
    assert!(!receipt.queued, "the node took the write");
    assert!(receipt.ual.starts_with("did:dkg:"), "a UAL came back: {}", receipt.ual);

    let recall = memory.recall("what drink with ginger do I love?").await.expect("recall");
    assert!(recall.facts.iter().any(|f| f.id == fact.id), "the new fact is recalled");
    assert_eq!(recall.traces.len(), 2);

    let turn = Turn::new(&said, "Got it.", "reflex", &stamp, "");
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

#[tokio::test]
#[ignore]
async fn live_every_catalog_question_runs_and_chats_link() {
    let memory = live_memory().await;
    let stamp = time::now_iso();
    let chat = Chat::start(&format!("Plan the week {stamp}"), &stamp);
    assert!(!memory.write(&chat).await.queued);
    let turn = Turn::new("Plan the week", "Sure.", "reflex", &stamp, &chat.id);
    assert!(!memory.write(&turn).await.queued);
    assert!(memory.chats().await.unwrap().iter().any(|c| c.id == chat.id), "the chat is listed");
    let turns = memory.chat_turns(&chat.id).await.unwrap();
    assert!(turns.iter().any(|t| t.id == turn.id), "the turn is found through its chat");

    let args: std::collections::HashMap<String, String> =
        [("days", "30"), ("category", "preference"), ("chat", chat.id.as_str()), ("skill", "switch-engine")].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    for q in catalog::QUESTIONS {
        let result = memory.ask(q.id, &args).await;
        assert!(result.is_ok(), "{} failed on the real node: {:?}", q.id, result.err());
        let (rows, trace) = result.unwrap();
        println!("{:<20} {:>3} rows {:>4} ms", q.id, rows.len(), trace.ms);
    }
}
