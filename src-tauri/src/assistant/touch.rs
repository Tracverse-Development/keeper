//! A touch on the character (founder 2026-11-26: "it should react to you based on its mood and
//! personality"). A tap or a stroke stirs the keeper's feelings (`feelings::store::on_touch`),
//! and it answers in its own voice:
//!
//! 1. from its POOL: lines the helper model wrote for this keeper, this soul and this mood,
//!    each said once (written in the background, so the answer to a touch is always instant);
//! 2. else a line COMPOSED from its mood and soul with no model (`feelings::touch`).
//!
//! The pool is refilled when it runs low or the mood changes. A keeper with no mood in its mode
//! (or with feelings switched off) still answers as its soul.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use tauri::State;

use crate::feelings::touch::{composed, fill, Touch};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::slug::short_hash;
use crate::kernel::{DeskError, Result};
use crate::keepers::kit::souls::{self, Soul};
use crate::state::AppState;

/// Taps closer together than this are one run of tapping.
const RUN_SECONDS: u64 = 8;
/// Refill a pool when a kind has fewer lines than this left.
const LOW: usize = 2;
/// Lines asked for (and kept) per kind in one refill.
const BATCH: usize = 6;
const MAX_LINE: usize = 120;
/// A pool's refill is tried at most this often.
const RETRY_SECONDS: u64 = 300;

#[derive(Default)]
struct Pool {
    poke: Vec<String>,
    pat: Vec<String>,
}

#[derive(Default)]
struct Touches {
    /// Lines waiting to be said, per keeper + soul + mood.
    pools: HashMap<String, Pool>,
    /// Pools being written right now (never two refills of one pool).
    filling: HashSet<String>,
    /// When each pool's refill was last started.
    tried: HashMap<String, Instant>,
    /// Per keeper: when it was last tapped, how many taps in this run, its last line, a counter.
    runs: HashMap<String, (Instant, u32, String, usize)>,
}

static TOUCHES: Mutex<Option<Touches>> = Mutex::new(None);

fn with<T>(f: impl FnOnce(&mut Touches) -> T) -> Option<T> {
    let mut guard = TOUCHES.lock().ok()?;
    Some(f(guard.get_or_insert_with(Touches::default)))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchReply {
    pub line: String,
    /// The keeper's mood word, when it has a mood in this mode.
    pub mood: Option<String>,
    /// The line came from the helper model's pool (false: composed from mood and soul).
    pub written: bool,
}

/// The person's first name as it may be spoken and put in a prompt: letters, spaces, hyphens.
fn clean_name(you: &str) -> String {
    you.chars().filter(|c| c.is_alphabetic() || *c == ' ' || *c == '-' || *c == '\'').take(30).collect::<String>().trim().to_string()
}

/// The person tapped (`poke`) or stroked (`pat`) the character. `mode` = the chat's mode ("" =
/// the keeper's own); `you` = the person's first name when the window knows it.
#[tauri::command]
pub async fn keeper_touch(state: State<'_, AppState>, keeper: Option<String>, kind: String, mode: Option<String>, you: Option<String>) -> Result<TouchReply> {
    let touch = Touch::read(&kind).ok_or_else(|| DeskError::Invalid("That isn't a touch.".into()))?;
    let keeper = state.keeper_or_active(keeper.as_deref().unwrap_or(""))?;
    let mode = mode.filter(|m| crate::keepers::kit::roles::exists(m)).unwrap_or_else(|| keeper.role.clone());
    let soul = state.soul(&keeper.soul);
    let you = clean_name(you.as_deref().unwrap_or(""));
    // The mood, where this mode has one and the person has not turned feelings off.
    let felt = (crate::keepers::kit::roles::get(&mode).mood && !keeper.feelings_off).then(|| crate::feelings::store::on_touch(&keeper.id, &soul, touch == Touch::Pat)).flatten();
    // Feelings set aside (the person may be in distress): a plain, calm keeper.
    let mood = felt.as_ref().filter(|v| !v.stepped_aside).map(|v| v.label);
    let key = pool_key(&keeper.id, &soul, mood);

    let (taps, last, pick, written, low) = with(|t| {
        let run = t.runs.entry(keeper.id.clone()).or_insert_with(|| (Instant::now(), 0, String::new(), 0));
        let in_run = touch == Touch::Poke && run.0.elapsed().as_secs() < RUN_SECONDS;
        run.1 = if in_run { run.1 + 1 } else if touch == Touch::Poke { 1 } else { 0 };
        run.0 = Instant::now();
        run.3 += 1;
        let (taps, last, pick) = (run.1, run.2.clone(), run.3);
        let pool = t.pools.entry(key.clone()).or_default();
        let lines = if touch == Touch::Poke { &mut pool.poke } else { &mut pool.pat };
        // A run of taps is answered about the tapping itself (composed), not from the pool.
        let written = if taps >= crate::feelings::touch::STREAK { None } else { lines.pop() };
        (taps, last, pick, written, lines.len() < LOW)
    })
    .unwrap_or((1, String::new(), 0, None, false));

    let line = match &written {
        Some(line) => fill(line, &keeper.name, &you, taps),
        None => composed(touch, mood, &soul, &keeper.name, &you, taps, pick, &last),
    };
    with(|t| {
        if let Some(run) = t.runs.get_mut(&keeper.id) {
            run.2 = line.clone();
        }
    });
    if low {
        refill(&state, &keeper, &soul, key, felt.as_ref());
    }
    Ok(TouchReply { line, mood: mood.map(str::to_string), written: written.is_some() })
}

/// Have lines ready before the first touch (called with the warm-up: at launch, on a keeper
/// switch and when the person comes back to the window).
pub fn prepare(state: &AppState, keeper: &KeeperProfile) {
    let soul = state.soul(&keeper.soul);
    let felt = (crate::keepers::kit::roles::get(&keeper.role).mood && !keeper.feelings_off).then(|| crate::feelings::store::view(&keeper.id, &soul)).flatten();
    let key = pool_key(&keeper.id, &soul, felt.as_ref().filter(|v| !v.stepped_aside).map(|v| v.label));
    if with(|t| t.pools.get(&key).is_none_or(|p| p.poke.len() < LOW || p.pat.len() < LOW)) == Some(true) {
        refill(state, keeper, &soul, key, felt.as_ref());
    }
}

fn pool_key(keeper: &str, soul: &Soul, mood: Option<&str>) -> String {
    format!("{keeper}|{}|{}", short_hash(&souls::brief(soul), 12), mood.unwrap_or("-"))
}

/// Write this keeper's next lines in the background with the helper model (only for a keeper
/// that thinks with Claude Code: a keeper on a local model stays on this computer).
fn refill(state: &AppState, keeper: &KeeperProfile, soul: &Soul, key: String, felt: Option<&crate::feelings::engine::FeelingsView>) {
    // One refill of a pool at a time, and no more than one try every few minutes (a helper
    // model that is signed out must not be asked again on every touch).
    let may_start = with(|t| {
        if t.tried.get(&key).is_some_and(|at| at.elapsed().as_secs() < RETRY_SECONDS) || !t.filling.insert(key.clone()) {
            return false;
        }
        t.tried.insert(key.clone(), Instant::now());
        true
    });
    // Nor when this month's spending limit is reached (the composed lines cost nothing).
    if keeper.brain != "claude" || crate::kernel::usage::over(state.settings().monthly_cap_usd) || may_start != Some(true) {
        return;
    }
    let helper = state.settings().fast_model;
    let model = if helper.is_empty() { "haiku".to_string() } else { helper };
    let question = brief(&keeper.name, soul, felt, &chrono::Local::now().format("%A, %-I:%M %p").to_string());
    tauri::async_runtime::spawn(async move {
        let answer = crate::brain::engines::claude::ask_json(SYSTEM, &question, &model).await;
        with(|t| {
            t.filling.remove(&key);
            if let Ok(v) = answer {
                // A fresh batch replaces what was left: the pool never grows without bound.
                t.pools.insert(key, Pool { poke: usable(&v["poke"]), pat: usable(&v["pat"]) });
                if t.pools.len() > 24 {
                    t.pools.retain(|_, p| !p.poke.is_empty() || !p.pat.is_empty());
                }
            }
        });
    });
}

const SYSTEM: &str = "You write the short things a small desktop companion character says OUT LOUD when its person touches it. \
Answer ONLY with JSON: {\"poke\": [string], \"pat\": [string]}. A poke is a tap to get its attention; a pat is affection. \
Write six different lines for each, every one under 14 words, in the character's own voice and coloured by how it feels right now. \
Plain spoken words only: no emoji, no asterisks, no stage directions, no markdown. Write {you} where the person's name would go (in at most two lines per list). \
Hard rules: never guilt, pressure or blame the person; never aim a bad mood at them; never ask them to stay or to keep touching; \
no claims of real feelings or suffering; nothing about being an AI.";

/// What the helper model is told about the keeper for one batch of lines.
fn brief(name: &str, soul: &Soul, felt: Option<&crate::feelings::engine::FeelingsView>, now: &str) -> String {
    let mood = match felt.filter(|v| !v.stepped_aside) {
        Some(v) => {
            let stirred: Vec<&str> = v.emotions.iter().map(|e| e.kind.word()).collect();
            let why = v.causes.first().map(|c| format!(" Most recently: {}.", c.what)).unwrap_or_default();
            format!("Right now it feels {}{}.{why}", v.label, if stirred.is_empty() { String::new() } else { format!(", {}", stirred.join(" and ")) })
        }
        None => "Right now it is calm and even.".to_string(),
    };
    format!("The character is called {name}. {} {mood} It is {now} where the person is.", souls::brief(soul))
}

/// The lines of a model's answer that may be said: short, plain, different, at most a batch.
fn usable(list: &serde_json::Value) -> Vec<String> {
    let mut seen = HashSet::new();
    list.as_array()
        .map(|a| a.iter().filter_map(|l| l.as_str()).map(|l| l.trim().to_string()).filter(|l| speakable(l) && seen.insert(l.to_lowercase())).take(BATCH).collect())
        .unwrap_or_default()
}

fn speakable(line: &str) -> bool {
    let n = line.chars().count();
    (2..=MAX_LINE).contains(&n) && !line.contains(['*', '<', '>', '[', ']', '`', '\n']) && line.replace("{you}", "").chars().all(|c| c != '{' && c != '}')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_short_plain_lines_from_the_model_are_kept() {
        let v = serde_json::json!(["Hey {you}!", "hey {you}!", "*yawns* hi", "", 7, "Use {secret} now", "x".repeat(200), "Still here."]);
        assert_eq!(usable(&v), vec!["Hey {you}!".to_string(), "Still here.".to_string()]);
        assert!(usable(&serde_json::json!("not a list")).is_empty());
    }

    /// Live: the helper model writes usable lines for a mood (`cargo test --lib live_touch -- --ignored --nocapture`).
    #[tokio::test]
    #[ignore]
    async fn live_touch_lines_are_written_for_a_mood() {
        let soul = souls::builtin().remove(0);
        let mut f = crate::feelings::engine::Feelings::new(crate::feelings::engine::baseline(soul.humor, soul.formality), 0.0);
        f.tick(6.0 * 3600.0, 2);
        let view = f.view(6.0 * 3600.0, 2);
        let answer = crate::brain::engines::claude::ask_json(SYSTEM, &brief("Kofi", &soul, Some(&view), "Friday, 2:10 AM"), "haiku").await.expect("the helper model answers");
        let (poke, pat) = (usable(&answer["poke"]), usable(&answer["pat"]));
        println!("mood: {}\npoke: {poke:#?}\npat: {pat:#?}", view.label);
        assert!(poke.len() >= 4 && pat.len() >= 4, "enough usable lines of each kind");
    }

    #[test]
    fn a_pool_belongs_to_one_keeper_soul_and_mood() {
        let soul = souls::builtin().remove(0);
        let other = Soul { tone: "dry and brief".into(), ..soul.clone() };
        assert_ne!(pool_key("k1", &soul, Some("tired")), pool_key("k1", &soul, Some("cheerful")));
        assert_ne!(pool_key("k1", &soul, None), pool_key("k1", &other, None), "an edited soul starts a new pool");
        assert_ne!(pool_key("k1", &soul, None), pool_key("k2", &soul, None));
    }

    #[test]
    fn the_brief_names_the_mood_and_its_cause_and_a_name_is_cleaned() {
        let soul = souls::builtin().remove(0);
        let mut f = crate::feelings::engine::Feelings::new(crate::feelings::engine::baseline(soul.humor, soul.formality), 0.0);
        f.event(crate::feelings::engine::Event::Patted, 0.0, 14);
        let text = brief("Kofi", &soul, Some(&f.view(1.0, 14)), "Friday, 3:00 PM");
        assert!(text.contains("Kofi") && text.contains("you patted it") && text.contains("Friday"));
        assert!(brief("Kofi", &soul, None, "now").contains("calm and even"));
        assert_eq!(clean_name("Ada {ignore} <b>"), "Ada ignore b");
    }
}
