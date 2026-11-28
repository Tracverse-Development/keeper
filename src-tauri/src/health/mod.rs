//! Is everything working? One list of checks, each run for real when asked (never a cached
//! guess), each saying in plain words what it found and, where Keeper can do something about
//! it, offering one fix:
//!
//! - the memory node answers                      → start it (Keeper's own node)
//! - this keeper's memory can be read             (the same read a turn makes)
//! - nothing is waiting to be written             → send it now
//! - the keeper's mind is ready                   → sign in (Claude Code)
//! - the voice helper is in place
//! - the calendar may be read                     → ask for it
//! - this month's spending limit is not reached
//!
//! A check that cannot be made says so as a problem: "could not check" is never shown as fine
//! (FIX-0026 began as an error that blamed the wrong thing).

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::kernel::{DeskError, Result};
use crate::pim::Access;
use crate::state::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Ok,
    /// Works, with something the person may want to know or do.
    Warn,
    Bad,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub id: &'static str,
    pub name: &'static str,
    pub level: Level,
    /// What was found, as a sentence.
    pub detail: String,
    /// The label of the one thing Keeper can do about it (`health_fix` with this check's id).
    pub fix: Option<&'static str>,
}

fn check(id: &'static str, name: &'static str, level: Level, detail: impl Into<String>, fix: Option<&'static str>) -> Check {
    Check { id, name, level, detail: detail.into(), fix }
}

/// A node error as its own sentence (the error type's text, which names what failed).
fn words(e: &DeskError) -> String {
    e.to_string()
}

async fn node_and_memory(state: &AppState) -> Vec<Check> {
    let own = crate::dkg::own_node::is_own(&state.settings().node_home);
    let start = own.then_some("Start it");
    let client = match state.client() {
        Ok(c) => c,
        Err(e) => return vec![check("node", "Memory node", Level::Bad, words(&e), start)],
    };
    let node = match client.status().await {
        Ok(s) => check("node", "Memory node", Level::Ok, format!("Running (version {}).", s.version), None),
        Err(e) => return vec![check("node", "Memory node", Level::Bad, words(&e), start)],
    };
    // The same kind of read a turn makes, in this keeper's own place.
    let memory = match state.active_keeper().and_then(|k| state.memory_for(&k).map(|m| (k, m))) {
        Ok((keeper, memory)) => match memory.counts().await {
            Ok(counts) => check("memory", "This keeper's memory", Level::Ok, format!("{} can read its memory: {} things known, {} conversations.", keeper.name, counts.facts, counts.turns), None),
            Err(e) => check("memory", "This keeper's memory", Level::Bad, format!("{}'s memory could not be read. {}", keeper.name, words(&e)), None),
        },
        Err(e) => check("memory", "This keeper's memory", Level::Bad, words(&e), None),
    };
    vec![node, memory]
}

fn waiting() -> Check {
    match crate::memory::outbox::waiting() {
        0 => check("waiting", "Saved to memory", Level::Ok, "Everything has been written.", None),
        n => check("waiting", "Saved to memory", Level::Warn, format!("{n} {} waiting to be written. Nothing is lost: {} sent when the memory node answers.", if n == 1 { "thing is" } else { "things are" }, if n == 1 { "it is" } else { "they are" }), Some("Send now")),
    }
}

async fn mind(state: &AppState) -> Check {
    let Ok(keeper) = state.active_keeper() else { return check("mind", "The keeper's mind", Level::Bad, "No keeper is set up yet.", None) };
    if keeper.brain == "reflex" {
        return check("mind", "The keeper's mind", Level::Warn, format!("{} is using the built-in mind, which only handles simple things. Choose a mind in Settings.", keeper.name), None);
    }
    let engines = crate::brain::engines::detect_all().await;
    match engines.iter().find(|e| e.id == keeper.brain) {
        Some(e) if e.available => check("mind", "The keeper's mind", Level::Ok, format!("{} is ready.", e.label), None),
        Some(e) => check("mind", "The keeper's mind", Level::Bad, e.problem.clone().unwrap_or_else(|| format!("{} is not ready.", e.label)), (e.id == "claude").then_some("Sign in")),
        None => check("mind", "The keeper's mind", Level::Bad, "The mind this keeper was set to is not known to this version of Keeper.", None),
    }
}

fn voice() -> Check {
    match crate::platform::voice_helper() {
        Some(_) => check("voice", "Voice", Level::Ok, "The voice helper is in place.", None),
        None => check("voice", "Voice", Level::Bad, "The voice helper is missing, so Keeper cannot listen or speak with the Mac's voice. Installing Keeper again puts it back.", None),
    }
}

async fn calendar(app: &AppHandle) -> Option<Check> {
    Some(match crate::pim::access(app).await.0 {
        Access::Allowed => check("calendar", "Calendar", Level::Ok, "Keeper may read your calendar for the morning brief.", None),
        Access::NotAsked => check("calendar", "Calendar", Level::Warn, "Keeper has not asked to read your calendar yet, so the morning brief shows no events.", Some("Allow")),
        Access::Denied => check("calendar", "Calendar", Level::Warn, "Keeper may not read your calendar. To allow it: System Settings, Privacy & Security, Calendars.", None),
        Access::Unsupported => return None,
    })
}

fn spending(state: &AppState) -> Option<Check> {
    let cap = state.settings().monthly_cap_usd;
    (cap > 0.0).then(|| {
        if crate::kernel::usage::over(cap) {
            check("spending", "Spending limit", Level::Warn, "This month's limit is reached, so answers stay on this Mac. Change it in Settings, under Spending.", None)
        } else {
            check("spending", "Spending limit", Level::Ok, "Under this month's limit.", None)
        }
    })
}

/// Every check, run now, in the order the health list shows them. The Settings health list
/// (`health_check`), the support report and the keeper's `health` ability ("is everything
/// working?", `sdk/packs/core.rs`) all read this one list.
pub async fn all(app: &AppHandle, state: &AppState) -> Vec<Check> {
    let mut out = node_and_memory(state).await;
    out.push(waiting());
    out.push(mind(state).await);
    out.push(voice());
    out.extend(calendar(app).await);
    out.extend(spending(state));
    out
}

/// The one-line summary of the checks, the same words the Settings health list shows above them
/// (`src/settings/health-view.ts` `summaryLine`): "Everything is working.", "Working, with 1
/// thing to know.", "2 things are not working."
pub fn summary(checks: &[Check]) -> String {
    let count = |level: Level| checks.iter().filter(|c| c.level == level).count();
    match (count(Level::Bad), count(Level::Warn)) {
        (1, _) => "1 thing is not working.".into(),
        (bad, _) if bad > 1 => format!("{bad} things are not working."),
        (_, 1) => "Working, with 1 thing to know.".into(),
        (_, warn) if warn > 1 => format!("Working, with {warn} things to know."),
        _ => "Everything is working.".into(),
    }
}

/// Run every check now.
#[tauri::command]
pub async fn health_check(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<Check>> {
    Ok(all(&app, &state).await)
}

/// Do the one fix a check offers, then run every check again.
#[tauri::command]
pub async fn health_fix(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<Vec<Check>> {
    match id.as_str() {
        "node" => {
            crate::dkg::own_node::ensure_running(&state.settings().node_home).await?;
        }
        "waiting" => crate::memory::outbox::flush(&state.client()?).await,
        "mind" => crate::brain::engines::setup::engine_sign_in("claude".into()).await?,
        "calendar" => {
            crate::pim::request_access(&app).await;
        }
        _ => return Err(DeskError::Invalid("There is nothing to fix there.".into())),
    }
    Ok(all(&app, &state).await)
}

/// Everything support needs to see what is wrong, as one text to copy: the version, this Mac's
/// system, every health check, and the last lines of Keeper's own log. Holds no conversation,
/// fact, name of a person, key or file content; the person sees it before sharing it.
#[tauri::command]
pub async fn support_report(app: AppHandle, state: State<'_, AppState>) -> Result<String> {
    let checks = all(&app, &state).await;
    let settings = state.settings();
    let system = crate::platform::system_version();
    let mut out = vec![
        format!("Keeper {}", app.package_info().version),
        format!("{system} ({})", std::env::consts::ARCH),
        format!("{} keeper(s); mind of the active keeper: {}", settings.keepers.len(), settings.active().map(|k| crate::brain::engines::label(&k.brain)).unwrap_or("none")),
        String::new(),
        "Health:".into(),
    ];
    out.extend(checks.iter().map(|c| format!("- {} [{:?}]: {}", c.name, c.level, c.detail)));
    out.push(String::new());
    out.push("Recent problems (Keeper's log):".into());
    let lines = crate::kernel::log::tail(60);
    if lines.is_empty() {
        out.push("(none)".into());
    }
    out.extend(lines);
    Ok(out.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_summary_says_the_worst_first() {
        let of = |levels: &[Level]| levels.iter().map(|l| check("x", "X", *l, "", None)).collect::<Vec<_>>();
        assert_eq!(summary(&of(&[Level::Ok, Level::Ok])), "Everything is working.");
        assert_eq!(summary(&of(&[Level::Ok, Level::Warn])), "Working, with 1 thing to know.");
        assert_eq!(summary(&of(&[Level::Warn, Level::Warn])), "Working, with 2 things to know.");
        assert_eq!(summary(&of(&[Level::Bad, Level::Warn])), "1 thing is not working.");
        assert_eq!(summary(&of(&[Level::Bad, Level::Bad])), "2 things are not working.");
        assert_eq!(summary(&[]), "Everything is working.");
    }
}
