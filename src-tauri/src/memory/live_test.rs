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
    let ctx = Context { said: said.clone(), assistant_name: "Keeper".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "now".into(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), style: String::new() };
    let thought = reflex::think(&ctx);
    assert_eq!(thought.remember.len(), 1, "the reflex mind learns the statement");

    let fact = Fact::new(&thought.remember[0].text, &thought.remember[0].category, &stamp);
    let receipt = memory.write(&fact).await;
    assert!(!receipt.queued, "the node took the write");
    assert!(receipt.ual.starts_with("did:dkg:"), "a UAL came back: {}", receipt.ual);

    let recall = memory.recall("what drink with ginger do I love?", "", "").await.expect("recall");
    assert!(recall.facts.iter().any(|f| f.id == fact.id), "the new fact is recalled");
    // Recall reads hot memory (loaded from the DKG once, kept in step with every write).
    assert!(recall.traces.iter().any(|t| t.label.starts_with("hot memory")), "{:?}", recall.traces);

    let turn = Turn::new(&said, "Got it.", "reflex", &stamp, "");
    assert!(!memory.write(&turn).await.queued);
    let (turns, _) = memory.recent_turns().await.expect("turns");
    assert!(turns.iter().any(|t| t.id == turn.id), "the turn is on the graph");

    let raw = format!("PREFIX schema: <http://schema.org/> SELECT ?s WHERE {{ ?s ?p ?o . FILTER(CONTAINS(STR(?o), \"{stamp}\")) ?s a ?t . FILTER(CONTAINS(STR(?t), \"Fact\")) }} LIMIT 5");
    let before = memory.client().query(memory.graph(), &raw, crate::dkg::Layer::Working).await.expect("raw query");
    assert!(!before.is_empty(), "the raw query finds the fact before it is forgotten");
    let forgotten = memory.forget(&format!("sorrel with ginger {stamp}")).await.expect("forget");
    assert!(forgotten.iter().any(|f| f.id == fact.id), "forget found the fact");
    let (facts, _) = memory.facts().await.expect("facts");
    assert!(!facts.iter().any(|f| f.id == fact.id), "a forgotten fact is never recalled again");
    // DESK-ERASE-001: forgetting erases. The fact's words are gone from the node itself, not
    // only hidden by a retraction (a raw query for its text finds nothing).
    let left = memory.client().query(memory.graph(), &raw, crate::dkg::Layer::Working).await.expect("raw query");
    assert!(left.is_empty(), "the fact's triples are erased from Working Memory: {left:?}");

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
        [("days", "30"), ("category", "preference"), ("chat", chat.id.as_str()), ("skill", "switch-engine"), ("mode", "researcher")].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    for q in catalog::QUESTIONS {
        let result = memory.ask(q.id, &args).await;
        assert!(result.is_ok(), "{} failed on the real node: {:?}", q.id, result.err());
        let (rows, trace) = result.unwrap();
        println!("{:<20} {:>3} rows {:>4} ms", q.id, rows.len(), trace.ms);
    }
}

#[tokio::test]
#[ignore]
async fn live_scenes_come_back_with_their_chat() {
    let memory = live_memory().await;
    let stamp = time::now_iso();
    let chat = Chat::start(&format!("Math {stamp}"), &stamp);
    assert!(!memory.write(&chat).await.queued);
    let panels = crate::stage::read(&serde_json::json!([
        {"kind": "table", "title": "Times \"table\" {x}", "columns": ["x", "1"], "rows": [["1", 1]], "highlight": [{"row": 0, "col": 1}]},
        {"kind": "steps", "title": "Solve 2x + 4 = 10", "steps": [{"label": "Subtract 4\nfrom both sides", "math": "2x = 6"}]}
    ]));
    let turn = Turn::new("teach me", "Here you go.", "claude", &stamp, &chat.id).with_panels(&panels);
    assert!(!memory.write(&turn).await.queued);
    let back = memory.chat_turns(&chat.id).await.unwrap();
    let t = back.iter().find(|t| t.id == turn.id).expect("the turn");
    assert_eq!(t.panels, panels, "the scene comes back exactly, quotes, braces and newlines included");
}

#[tokio::test]
#[ignore]
async fn live_deleting_a_chat_erases_its_turns() {
    let memory = live_memory().await;
    // A marker no other test writes (a timestamp alone collides with tests in the same second).
    let mut bytes = [0u8; 8];
    let _ = getrandom::getrandom(&mut bytes);
    let stamp = format!("erase-{}", hex::encode(bytes));
    let at = time::now_iso();
    let chat = Chat::start(&format!("My doctor's notes {stamp}"), &at);
    assert!(!memory.write(&chat).await.queued);
    for said in ["My blood pressure is 140 over 90", "I take lisinopril"] {
        assert!(!memory.write(&Turn::new(&format!("{said} {stamp}"), "Noted.", "reflex", &at, &chat.id)).await.queued);
    }
    assert_eq!(memory.chat_turns(&chat.id).await.unwrap().len(), 2, "both turns are on the graph");

    assert_eq!(memory.erase_chat(&chat.id).await.expect("erase"), 2, "both turns erased");
    assert!(memory.chat_turns(&chat.id).await.unwrap().is_empty(), "no turn of the chat is left");
    assert!(!memory.chats().await.unwrap().iter().any(|c| c.id == chat.id), "the chat is no longer listed");
    let raw = format!("SELECT ?s WHERE {{ ?s ?p ?o . FILTER(CONTAINS(STR(?o), \"{stamp}\")) }} LIMIT 5");
    let left = memory.client().query(memory.graph(), &raw, crate::dkg::Layer::Working).await.expect("raw query");
    assert!(left.is_empty(), "the person's words are gone from the node: {left:?}");
}

#[tokio::test]
#[ignore]
async fn live_experience_grows_with_use() {
    let memory = live_memory().await;
    let before = crate::keepers::kit::levels::experience(&memory).await.expect("the node answers");
    let at = time::now_iso();
    assert!(!memory.write(&Turn::new("Teach me fractions", "Here you go.", "reflex", &at, "")).await.queued);
    let after = crate::keepers::kit::levels::experience(&memory).await.expect("the node answers");
    assert_eq!(after.done.turns, before.done.turns + 1, "the turn counts");
    assert_eq!(after.xp, before.xp + crate::keepers::kit::levels::XP_TURN, "10 XP for a turn");
    println!("live graph: level {} with {} XP ({:?})", after.level, after.xp, after.done);
}

#[tokio::test]
#[ignore]
async fn live_each_mode_recalls_its_own_work_facts() {
    let memory = live_memory().await;
    let stamp = time::now_iso();
    let work = Fact::new(&format!("The lighthouse lens is a Fresnel lens {stamp}"), "work", &stamp).learned_in("researcher");
    let personal = Fact::new(&format!("Your nephew is called Kemi {stamp}"), "person", &stamp).learned_in("researcher");
    assert!(!memory.write(&work).await.queued && !memory.write(&personal).await.queued);
    let in_research = memory.recall(&format!("lighthouse lens nephew Kemi {stamp}"), "", "researcher").await.unwrap();
    let in_admin = memory.recall(&format!("lighthouse lens nephew Kemi {stamp}"), "", "system").await.unwrap();
    assert!(in_research.facts.iter().any(|f| f.id == work.id) && in_research.facts.iter().any(|f| f.id == personal.id));
    assert!(!in_admin.facts.iter().any(|f| f.id == work.id), "another mode does not see the researcher's notes");
    assert!(in_admin.facts.iter().any(|f| f.id == personal.id), "every mode knows the person");
    let (rows, _) = memory.ask("facts-by-mode", &[("mode".to_string(), "researcher".to_string())].into_iter().collect()).await.unwrap();
    assert!(rows.iter().any(|r| r.get("text").is_some_and(|t| t.contains(&stamp))), "the researcher's notes can be asked for");
}
