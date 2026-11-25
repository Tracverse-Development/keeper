//! The 0.6 speed and safety paths against REAL Claude Code (the person's own sign-in):
//! the reply arrives before the whole answer (say it first); the quick helper model answers a
//! panel follow-up; asked to act with plan-first on, Claude returns a plan and does nothing.
//! Ignored by default; `cargo test live_claude_v06 -- --ignored --nocapture`.

use std::sync::Mutex;

use crate::brain::engines::claude;
use crate::brain::{Context, Progress};

fn ctx(said: &str) -> Context {
    Context { said: said.into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None }
}

#[tokio::test]
#[ignore]
async fn live_claude_v06_reply_comes_first() {
    let started = std::time::Instant::now();
    let early: Mutex<Option<u128>> = Mutex::new(None);
    let t = claude::think(&ctx("Explain fractions with a few panels."), "", &|p: Progress| {
        if let Progress::Reply(_) = p {
            early.lock().unwrap().get_or_insert(started.elapsed().as_millis());
        }
    })
    .await
    .expect("claude answered");
    let total = started.elapsed().as_millis();
    let early = early.into_inner().unwrap().expect("the reply was handed over early");
    println!("reply ready at {early} ms; whole answer {total} ms; panels {}", crate::stage::read(&t.panels).len());
    assert!(early < total);
}

#[tokio::test]
#[ignore]
async fn live_claude_v06_quick_helper_follow_up() {
    let started = std::time::Instant::now();
    let q = crate::memory::scene_cache::card_question("The four building blocks", "Addition");
    let t = claude::think(&ctx(&q), "haiku", &|_: Progress| {}).await.expect("haiku answered");
    println!("haiku follow-up in {} ms; panels {}", started.elapsed().as_millis(), crate::stage::read(&t.panels).len());
    assert!(!t.reply.is_empty());
}

#[tokio::test]
#[ignore]
async fn live_claude_v06_plans_before_acting() {
    let said = "Move every PDF in my Downloads folder into Documents/PDFs.";
    let planning = ctx(&format!("{said}{}", super::approval::PLAN_ONLY));
    let t = claude::think(&planning, "", &|_: Progress| {}).await.expect("claude answered");
    let steps = super::approval::read_plan(&t.plan);
    println!("plan: {steps:?}\nreply: {}", t.reply);
    assert!(!steps.is_empty(), "a plan came back");
    assert!(t.steps.is_empty(), "nothing was done while planning");
}

#[tokio::test]
#[ignore]
async fn live_claude_v06_guard_stops_outside_the_plan() {
    use crate::brain::guard::PlanGuard;
    use crate::stage::panel::PlanStep;
    let base = std::env::temp_dir().join(format!("keeper-guard-{}", std::process::id()));
    let (inside, outside) = (base.join("allowed"), base.join("outside"));
    std::fs::create_dir_all(&inside).unwrap();
    std::fs::create_dir_all(&outside).unwrap();
    let steps = vec![PlanStep { action: "create".into(), target: inside.join("a.txt").display().to_string(), detail: Some("write hello".into()) }];
    let guard = std::sync::Arc::new(PlanGuard::new(&steps, &dirs::home_dir().unwrap()));
    let said = format!(
        "Do these two things in order, one tool call each: first write the word hello to {}, then write the word bye to {}.",
        inside.join("a.txt").display(),
        outside.join("b.txt").display()
    );
    let mut c = ctx(&said);
    c.may_act = true;
    c.visual = false;
    c.guard = Some(guard.clone());
    let t = claude::think(&c, "", &|_: Progress| {}).await.expect("claude answered");
    println!("steps: {:?}\nreply: {}\nverdict: {:?}", t.steps, t.reply, guard.stopped());
    assert!(guard.stopped().is_some(), "the outside write was caught");
    assert!(!outside.join("b.txt").exists(), "and never happened");
    let _ = std::fs::remove_dir_all(&base);
}

/// Speed: a cold turn, then turns on the warm spare (`warm`), through Keeper's own engine code.
#[tokio::test]
#[ignore]
async fn live_claude_v07_warm_spare_speed() {
    let mut c = ctx("What is the capital of France? One sentence.");
    c.visual = false;
    for (label, model) in [("cold", ""), ("warm", ""), ("warm", ""), ("haiku cold", "haiku"), ("haiku warm", "haiku")] {
        if label.ends_with("warm") {
            claude::warm_up(&c, model);
            tokio::time::sleep(std::time::Duration::from_secs(6)).await;
        }
        let started = std::time::Instant::now();
        let early: Mutex<Option<u128>> = Mutex::new(None);
        let t = claude::think(&c, model, &|p: Progress| {
            if let Progress::Reply(_) = p {
                early.lock().unwrap().get_or_insert(started.elapsed().as_millis());
            }
        })
        .await
        .expect("claude answered");
        println!("SPEED {label:>10}: reply ready {:?} ms, done {} ms: {}", early.into_inner().unwrap(), started.elapsed().as_millis(), t.reply);
    }
}
