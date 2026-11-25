//! The 0.6 memory paths against the REAL DKG node (LES-001): a scene cached under its question
//! comes back for the same question in other words; quiz answers make a streak; a pin is read
//! back; practice reaches recall. Ignored by default; `cargo test live_ -- --ignored`.
//! Writes only to the `umoja-desk-livetest` graph.

use super::panel_events::PanelEvent;
use super::*;
use crate::dkg::{node, DkgClient};

async fn live_memory() -> Memory {
    let home = dirs::home_dir().unwrap().join(".dkg");
    let client = DkgClient::new(&node::locate(&home).expect("a DKG node in ~/.dkg"));
    client.ensure_graph("umoja-desk-livetest", "Keeper live test").await.expect("graph");
    Memory::new(client, "umoja-desk-livetest")
}

#[tokio::test]
#[ignore]
async fn live_scene_cache_round_trip() {
    let memory = live_memory().await;
    let question = format!("Explain the number {} visually", crate::kernel::time::now_iso());
    assert!(memory.cached_scene(&question).await.unwrap().is_none());
    let panels = crate::stage::read(&serde_json::json!([{"kind": "text", "title": "Cached", "body": "from the graph"}]));
    memory.cache_scene(&question, "Here it is.", &panels).await;
    let started = std::time::Instant::now();
    let back = memory.cached_scene(&format!("  {}?", question.to_uppercase())).await.unwrap().expect("cached scene");
    println!("cache hit in {} ms", started.elapsed().as_millis());
    assert_eq!(back.reply, "Here it is.");
    assert!(matches!(&back.panels[0], crate::stage::Panel::Text { title, .. } if title == "Cached"));
}

#[tokio::test]
#[ignore]
async fn live_streaks_pins_and_practice() {
    let memory = live_memory().await;
    memory.write(&PanelEvent::new("quiz", "quiz", "What is 2 + 2?", "no")).await;
    for q in ["What is 3 + 3?", "What is 4 + 4?", "What is 5 + 5?"] {
        tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
        memory.write(&PanelEvent::new("quiz", "quiz", q, "yes")).await;
    }
    assert_eq!(memory.streak().await, 3, "three right after a wrong one");
    let pin = crate::kernel::slug::short_hash(&crate::kernel::time::now_iso(), 16);
    memory.write(&PanelEvent::new("pin", "facts", "pin", &pin)).await;
    assert!(memory.pinned().await.contains(&pin));
    let practice = memory.practice().await;
    println!("practice: {:?}", practice.iter().map(|f| &f.text).collect::<Vec<_>>());
    assert!(practice.iter().any(|f| f.text.contains("What is 5 + 5?") && f.text.contains("right")));
}

// FIX-0005: a record written twice is "already in memory", never queued to retry forever.
#[tokio::test]
#[ignore]
async fn live_same_record_twice_is_not_queued() {
    let memory = live_memory().await;
    let fact = Fact::new(&format!("Test fact {}", crate::kernel::time::now_iso()), "test", &crate::kernel::time::now_iso());
    let first = memory.write(&fact).await;
    let again = memory.write(&fact).await;
    println!("first: {} / again: {}", first.status, again.status);
    assert!(!first.queued && !again.queued, "nothing waits in the outbox");
}

#[tokio::test]
#[ignore]
async fn live_pin_and_unpin_a_scene() {
    use super::pinned_scenes::{pin_id, PinnedScene};
    let memory = live_memory().await;
    let title = format!("Pinned {}", crate::kernel::time::now_iso());
    let panels = crate::stage::read(&serde_json::json!([{"kind": "text", "title": "Times table", "body": "7 x 8 = 56"}]));
    let pin = PinnedScene { id: pin_id(&title, &panels), title: title.clone(), panels, at: crate::kernel::time::now_iso() };
    memory.write(&pin).await;
    assert!(memory.pinned_scenes().await.unwrap().iter().any(|p| p.id == pin.id && p.title == title));
    tokio::time::sleep(std::time::Duration::from_millis(1100)).await;
    memory.unpin_scene(&pin.id).await;
    assert!(!memory.pinned_scenes().await.unwrap().iter().any(|p| p.id == pin.id), "unpinned");
}

/// Speed baseline: what one turn's memory work costs on the real node.
#[tokio::test]
#[ignore]
async fn live_bench_memory() {
    let memory = live_memory().await;
    let t = std::time::Instant::now();
    let r = memory.recall("what is my sister's name").await.unwrap();
    let recall = t.elapsed();
    let t = std::time::Instant::now();
    let _ = memory.recall("what is my sister's name").await.unwrap();
    let hot_recall = t.elapsed();
    let marker = format!("Your bench cousin is {}", crate::kernel::time::now_iso());
    memory.write(&Fact::new(&marker, "person", &crate::kernel::time::now_iso())).await;
    let again = memory.recall("bench cousin").await.unwrap();
    assert!(again.facts.iter().any(|f| f.text == marker), "a new fact is recalled at once");
    println!("BENCH cold recall {recall:?}; hot recall {hot_recall:?}");
    let t = std::time::Instant::now();
    for i in 0..5 {
        memory.write(&Fact::new(&format!("bench fact {i} {}", crate::kernel::time::now_iso()), "general", &crate::kernel::time::now_iso())).await;
    }
    let write5 = t.elapsed();
    println!("BENCH recall {:?} ({} facts, {} turns); 5 writes {:?} ({:?} each)", recall, r.facts.len(), r.recent.len(), write5, write5 / 5);
}
