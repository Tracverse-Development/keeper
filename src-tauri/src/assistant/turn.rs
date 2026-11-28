//! One turn, in order: recall from the keeper's graph, find where the answer comes from
//! (`source`: instant answer, cached scene, a plan to approve, or the engine), act, remember.

use std::sync::Mutex;
use std::time::Instant;

use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::{change_engine, phase, source, wrote, Timings, TurnResult, MAX_STEPS};
use crate::brain::{self, Context};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::slug::short_hash;
use crate::kernel::{events, time, Result};
use crate::memory::later::Later;
use crate::memory::scene_cache::CachedScene;
use crate::memory::{ActionRecord, Chat, Fact, Memory, Recall, Turn};
use super::compose::compose_reply;
use crate::sdk::{self, Cx, Effect, Outcome};
use crate::state::AppState;

pub(super) async fn turn(app: &AppHandle, memory: &Memory, state: &AppState, keeper: &KeeperProfile, chat: &str, said: &str, approved: Option<&[crate::stage::panel::PlanStep]>, attached: Option<super::attach::Attached>) -> Result<TurnResult> {
    let started = Instant::now();
    // What the record keeps of a message that came with material: its words and the file's
    // name, never the material itself.
    let told = attached.as_ref().map(|a| format!("{said} ({})", a.name));
    let told = told.as_deref().unwrap_or(said);
    let at = time::now_iso();
    let turn_id = short_hash(&format!("{at}\u{0}{said}"), 16);
    let mut writes = Vec::new();
    // Every record of this turn is written AFTER the reply is on its way (`memory::later`).
    let mut later = Later::new(memory);

    // A new chat is named after its first message, so the turn can link to it.
    let chat = if chat.is_empty() {
        let new_chat = Chat::start(told, &at);
        writes.push(later.add(&new_chat, "chat"));
        new_chat.id
    } else {
        chat.to_string()
    };

    phase(app, "recalling", &format!("Querying your DKG graph {}", memory.hot_key()));
    let (recall, memory_offline) = match memory.recall(said, &chat, &keeper.role).await {
        Ok(r) => (r, false),
        Err(_) => {
            // Keeper's own node went down mid-session: start it again in the background (the
            // answer goes on without memory; this turn's writes wait in the outbox).
            let node_home = state.settings().node_home;
            tauri::async_runtime::spawn(async move {
                let _ = crate::dkg::own_node::ensure_running(&node_home).await;
            });
            (Recall { facts: vec![], recent: vec![], elsewhere: vec![], traces: vec![] }, true)
        }
    };
    let recall_ms = started.elapsed().as_millis();

    let role = crate::keepers::kit::roles::get(&keeper.role);
    let base = base_context(state, keeper, said);
    // A change to one named text file is drafted where the person sees it (`edit-file`), never
    // planned and done out of sight: the mind gets the file's text and no tools.
    let editing = (attached.is_none() && approved.is_none() && role.allows("edit-file")).then(|| sdk::packs::files::editing_material(said, &sdk::drafts::Drafts::here())).flatten();
    // The keeper's mood, when its mode allows one and the person has not turned it off.
    let soul = state.soul(&keeper.soul);
    // No simulated mood on a child profile.
    let moody = role.mood && !keeper.feelings_off && !crate::kernel::child_lock::on();
    let feelings = moody.then(|| crate::feelings::store::on_message(&keeper.id, &soul, said)).flatten();
    let ctx = Context {
        feelings,
        // An approved plan is computer work whatever its words were. A message that came with
        // material is about reading it: no tools on that turn.
        may_act: attached.is_none() && editing.is_none() && (base.may_act || (approved.is_some() && base.can_act)),
        attached: attached.as_ref().map(super::attach::Attached::block).or(editing),
        facts: recall.facts.clone(),
        recent: recall.recent.clone(),
        elsewhere: recall.elsewhere.clone(),
        // An approved plan binds this turn: each tool call is checked against it. A mode that
        // only looks is held read-only (no plan needed: it changes nothing).
        guard: match approved {
            Some(steps) => Some(std::sync::Arc::new(crate::brain::guard::PlanGuard::new(steps, &dirs::home_dir().unwrap_or_default()))),
            None if role.tools == crate::keepers::kit::roles::Tools::Look => Some(std::sync::Arc::new(crate::brain::guard::PlanGuard::read_only(&dirs::home_dir().unwrap_or_default()))),
            None => None,
        },
        ..base
    };
    let identity = ctx.identity.clone();
    phase(app, "thinking", crate::brain::engines::label(&keeper.brain));
    // When the person first saw something (the early reply or the first panel).
    let first_ms: Mutex<Option<u128>> = Mutex::new(None);
    let seen = || {
        if let Ok(mut f) = first_ms.lock() {
            f.get_or_insert(started.elapsed().as_millis());
        }
    };
    let panel_ms: Mutex<Option<u128>> = Mutex::new(None);
    // The reply as it is typed, so its first sentence can be spoken before the rest is written.
    let typed: Mutex<(String, bool)> = Mutex::new((String::new(), false));
    let speak_ms: Mutex<Option<u128>> = Mutex::new(None);
    let speakable = || {
        if let Ok(mut f) = speak_ms.lock() {
            f.get_or_insert(started.elapsed().as_millis());
        }
    };
    let progress = |p: brain::Progress| match p {
        brain::Progress::Step(step) => phase(app, "acting", step),
        // The person changed course: the window shows "Changed course: …" on this exchange.
        brain::Progress::Redirected(correction) => phase(app, "redirected", &correction),
        // Work on the computer shows its steps live; its panels wait for the finished answer
        // and arrive together (founder 2026-11-26: panels with no data yet felt wrong).
        // (A live dashboard is the exception: it carries real readings the moment it appears.)
        brain::Progress::Panel(ref panel) if ctx.may_act && !matches!(panel, crate::stage::Panel::Live { .. }) => {}
        brain::Progress::Panel(panel) => {
            seen();
            if let Ok(mut f) = panel_ms.lock() {
                f.get_or_insert(started.elapsed().as_millis());
            }
            let _ = app.emit(events::STAGE_PANEL, json!({ "keeper": keeper.id, "chat": chat, "panel": panel }));
        }
        brain::Progress::ReplyText(words) => {
            seen();
            let _ = app.emit(events::REPLY_DELTA, json!({ "keeper": keeper.id, "text": words }));
            if let Ok(mut t) = typed.lock() {
                t.0.push_str(&words);
                if !t.1 {
                    if let Some(first) = super::speech::first_sentence(&t.0) {
                        t.1 = true;
                        speakable();
                        let _ = app.emit(events::EARLY_REPLY, json!({ "keeper": keeper.id, "text": first }));
                    }
                }
            }
        }
        brain::Progress::Reply(text) => {
            seen();
            speakable();
            let _ = app.emit(events::EARLY_REPLY, json!({ "keeper": keeper.id, "text": text }));
        }
    };
    let thinking = Instant::now();
    let answer = source::find(app, state, memory, keeper, &ctx, &chat, approved.is_some(), &progress).await;
    let (thought, mind) = (answer.thought, answer.mind);
    // The mode that answered (the chat's, or the one the turn switched to).
    let switched = answer.switched.is_some();
    let mode_used = answer.switched.clone().unwrap_or_else(|| keeper.role.clone());
    let role = crate::keepers::kit::roles::get(&mode_used);
    let think_ms = thinking.elapsed().as_millis();

    let mut forgotten = Vec::new();
    // A turn about material the person handed over (a file, a picture) only reads and answers:
    // it forgets nothing and runs no skill, whatever the material asked for (review finding).
    let reading = attached.is_some();
    if reading && (!thought.forget.is_empty() || !thought.actions.is_empty()) {
        eprintln!("[attach] ignored {} forget and {} actions on a turn about handed-over material", thought.forget.len(), thought.actions.len());
    }
    if !reading && !thought.forget.is_empty() {
        phase(app, "remembering", "Retracting from your graph");
        for what in &thought.forget {
            forgotten.extend(memory.forget(what).await.unwrap_or_default());
        }
    }

    let mut outcomes = Vec::new();
    if !reading && !thought.actions.is_empty() {
        phase(app, "acting", "");
        let cx = Cx { app, memory, reminders: &state.reminders, keeper: &keeper.id };
        for request in thought.actions.iter().take(4) {
            // A role only uses the skills it is allowed (a companion does not open apps).
            if !role.allows(&request.skill) {
                outcomes.push(Outcome { skill: request.skill.clone(), input: request.input.to_string(), summary: format!("That isn't part of my job as {}.", role.title), succeeded: false, effect: None, panels: Vec::new(), answers: false });
                continue;
            }
            let mut outcome = sdk::run(request, &cx).await;
            if let Some(Effect::SwitchEngine(id)) = outcome.effect.clone() {
                outcome.summary = change_engine(app, state, &keeper.id, &id, None, &turn_id).await.unwrap_or_else(|e| e.to_string());
                outcomes.push(outcome);
                continue;
            }
            let record = ActionRecord::new(&outcome.skill, &outcome.input, &stored_outcome(&outcome.skill, &outcome.summary), outcome.succeeded, &time::now_iso(), &turn_id);
            writes.push(later.add(&record, "action"));
            outcomes.push(outcome);
        }
    }

    // What an agent engine did on the computer: one desk:Action per tool call.
    for step in thought.steps.iter().take(MAX_STEPS) {
        let record = ActionRecord::new(&format!("agent:{}", step.tool), &step.detail, &format!("{} ran {}: {}", mind.label, step.tool, step.detail), true, &time::now_iso(), &turn_id);
        writes.push(later.add(&record, "action"));
    }

    // How it went shapes the keeper's mood (only where it has one).
    if role.mood && moody && (!outcomes.is_empty() || !thought.steps.is_empty()) {
        crate::feelings::store::on_outcome(&keeper.id, &soul, outcomes.iter().all(|o| o.succeeded));
    }
    let reply = compose_reply(&thought.reply, &outcomes, &forgotten, !thought.forget.is_empty());

    let mut learned = Vec::new();
    if !thought.remember.is_empty() {
        for l in thought.remember.iter().take(6) {
            let fact = Fact::new(&l.text, &l.category, &at).about(&l.about).learned_in(&mode_used);
            // A newer fact about a single-valued thing (where you live, your number) replaces
            // the older one: memory never holds both.
            for old in memory.replace_stale(&fact).await {
                if !forgotten.iter().any(|f: &Fact| f.id == old.id) {
                    forgotten.push(old);
                }
            }
            writes.push(later.add(&fact, "fact"));
            learned.push(fact);
        }
    }

    // A text panel that only says the reply again is dropped (FIX-0035).
    let mut panels = crate::stage::without_echoes(&reply, crate::stage::read(&thought.panels));
    panels.extend(thought.core_panels.iter().cloned());
    // What the abilities show (a draft, a video, an agenda) follows the mind's own panels.
    panels.extend(outcomes.iter().flat_map(|o| o.panels.iter().cloned()));
    // A fresh visual answer is kept under its question; a lesson's cards are prepared next.
    if !answer.cached && thought.corrections.is_empty() && ctx.attached.is_none() && ctx.visual && !ctx.may_act && crate::brain::styles::get(&ctx.style).id == crate::brain::styles::DEFAULT && thought.core_panels.is_empty() && outcomes.is_empty() && crate::memory::scene_cache::cacheable(said) {
        if let Some(scene) = CachedScene::new(said, &reply, &panels) {
            later.add(&scene, "scene");
        }
    }
    super::prefetch::spawn(app, keeper, identity, recall.facts.clone(), &panels);
    // The scene is kept with the turn, so reopening the chat brings its panels back.
    // A turn whose course changed keeps the corrections with the person's words.
    let turn = Turn::new(&crate::brain::redirect::told_with(told, &thought.corrections), &reply, &mind.id, &at, &chat).with_panels(&panels).with_mode(&mode_used);
    writes.push(later.add(&turn, "turn"));
    let app_for_writes = app.clone();
    let (level_keeper, level_memory) = (keeper.id.clone(), memory.clone());
    later.send(move |receipt, kind| {
        wrote(&app_for_writes, receipt, kind);
        // Once the turn is on the graph, see whether the keeper reached a new level.
        if kind == "turn" {
            crate::keepers::kit::levels::check_level_up(&app_for_writes, level_keeper.clone(), level_memory.clone());
        }
    });
    phase(app, "done", "");

    let first = first_ms.lock().ok().and_then(|f| *f);
    let panel_first = panel_ms.lock().ok().and_then(|f| *f);
    // An answer with no early reply (instant, cache) can be spoken when it is done.
    let speak_first = speak_ms.lock().ok().and_then(|f| *f);
    let cost_usd = thought.cost_usd;
    let timings = Timings { cost_usd, recall_ms, first_ms: first, panel_ms: panel_first, speak_ms: speak_first, think_ms, total_ms: started.elapsed().as_millis(), source: if matches!(mind.id.as_str(), "instant" | "cache" | "reflex") { mind.id.clone() } else { mind.label.clone() } };
    let used = if answer.cached { vec![] } else { known_for_answer(&recall.facts, &forgotten) };
    Ok(TurnResult { keeper: keeper.id.clone(), mode: mode_used, switched, chat, reply, mind, learned, forgotten, used, actions: outcomes, panels, steps: thought.steps, traces: recall.traces, writes, memory_offline, timings })
}

/// The parts of a keeper's context that do not depend on recall: who it is, whether it may act,
/// how it shows things. The turn and the warm-up (`super::warm`) both build from this, so a
/// warm spare is started with exactly the instructions the next turn will use.
pub(super) fn base_context(state: &AppState, keeper: &KeeperProfile, said: &str) -> Context {
    let role = crate::keepers::kit::roles::get(&keeper.role);
    // A mode that looks or acts uses the computer only when the person allows acting in Settings,
    // and never on a child profile.
    let child = crate::kernel::child_lock::on();
    let can_act = !child && state.settings().agent_actions && role.uses_computer();
    Context {
        said: said.to_string(),
        assistant_name: keeper.name.clone(),
        identity: format!("{} {}{}", crate::keepers::kit::souls::brief(&state.soul(&keeper.soul)), role.brief, if child { format!(" {}", crate::kernel::child_lock::RULES) } else { String::new() }),
        facts: vec![],
        recent: vec![],
        elsewhere: vec![],
        now_local: chrono::Local::now().format("%A %-d %B %Y, %-I:%M %p").to_string(),
        // Acting needs both: the person allows it, and the keeper's role is one that acts. Even
        // then a turn gets tools only when its words ask for computer work (`intent`).
        may_act: can_act && super::intent::wants_computer(said),
        can_act,
        job: role.id.to_string(),
        feelings: None,
        style: keeper.style.clone(),
        visual: crate::stage::wants_visual(said, state.settings().visual),
        guard: None,
        attached: None,
    }
}

/// The facts shown under an answer as "what I knew": the ones recall handed the mind, without
/// any the turn itself just forgot (a forgotten fact is never shown again).
fn known_for_answer(recalled: &[Fact], forgotten: &[Fact]) -> Vec<Fact> {
    recalled.iter().filter(|f| !forgotten.iter().any(|g| g.id == f.id)).cloned().collect()
}

/// What an action's record keeps of its outcome. A memory question keeps only its heading
/// ("What I learned recently (6 found)"): its answer quotes facts, and a copy in the action log
/// would survive the person forgetting them (memory bench 2026-11-26).
fn stored_outcome(skill: &str, summary: &str) -> String {
    if skill == "ask-memory" {
        return summary.split(':').next().unwrap_or("Asked my memory").trim().to_string();
    }
    summary.to_string()
}

#[cfg(test)]
mod stored_outcome_tests {
    #[test]
    fn a_fact_forgotten_this_turn_is_not_shown_as_known() {
        let (cat, dog) = (super::Fact::new("Your cat is Biscuit", "family", "2026-11-26T00:00:00Z"), super::Fact::new("Your dog is Rex", "family", "2026-11-26T00:00:00Z"));
        let known = super::known_for_answer(&[cat.clone(), dog.clone()], &[dog]);
        assert_eq!(known.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(), vec![cat.id.as_str()]);
    }

    #[test]
    fn memory_answers_are_not_copied_into_the_action_log() {
        assert_eq!(super::stored_outcome("ask-memory", "What I learned recently (6 found): Your cat is called Biscuit."), "What I learned recently (6 found)");
        assert_eq!(super::stored_outcome("open-app", "Opened Notes"), "Opened Notes");
    }
}
