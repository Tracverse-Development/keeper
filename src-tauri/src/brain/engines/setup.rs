//! Setting up an engine for the person, so a new Mac needs nothing but Keeper. Claude Code is
//! installed with Keeper's own Node.js (`dkg::runtime`) into Keeper's folder
//! (`paths::engines_home`, pinned to a release at least two weeks old; it updates itself after),
//! then signing in opens Terminal running that Claude Code, where the person signs in through
//! their browser as usual. Found missing in the round-2 VM test (DESK-ENGINE-SETUP-001).

use serde_json::json;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

use crate::kernel::{events, paths, programs, DeskError, Result};

/// The Claude Code release Keeper installs (2026-11-10; Claude Code updates itself afterwards).
pub const CLAUDE_CODE: &str = "@anthropic-ai/claude-code@2.1.322";

fn say(app: &AppHandle, line: &str) {
    let _ = app.emit(events::SETUP_PROGRESS, json!({ "step": "engine", "detail": line }));
}

/// Install Claude Code into Keeper's folder (skipped when the computer already has it).
#[tauri::command]
pub async fn engine_setup(app: AppHandle, engine: String) -> Result<String> {
    if engine != "claude" {
        return Err(DeskError::Invalid("Keeper can set up Claude Code for you; install the others yourself for now.".into()));
    }
    if let Some(found) = programs::find("claude") {
        return Ok(found.display().to_string());
    }
    let bin_dir = crate::dkg::runtime::ensure_node(&|line: &str| say(&app, line)).await?;
    say(&app, "Installing Claude Code (a one-time download)…");
    let npm = bin_dir.join(if cfg!(windows) { "npm.cmd" } else { "npm" });
    let out = Command::new(&npm)
        .args(["install", "-g", "--no-audit", "--no-fund", "--prefix"])
        .arg(paths::engines_home())
        .arg(CLAUDE_CODE)
        .env("PATH", programs::child_path(Some(&bin_dir)))
        .output()
        .await?;
    if !out.status.success() {
        let tail: String = String::from_utf8_lossy(&out.stderr).lines().rev().take(2).collect::<Vec<_>>().join(" ");
        return Err(DeskError::Io(format!("Claude Code did not install: {tail}")));
    }
    let installed = programs::find("claude").ok_or_else(|| DeskError::Io("Claude Code installed but was not found".into()))?;
    say(&app, "Claude Code is installed. Sign in next.");
    Ok(installed.display().to_string())
}

/// Open Terminal running Claude Code so the person signs in (their browser opens from there).
#[tauri::command]
pub async fn engine_sign_in(engine: String) -> Result<()> {
    if engine != "claude" {
        return Err(DeskError::Invalid("Only Claude Code signs in from here for now.".into()));
    }
    let claude = programs::find("claude").ok_or_else(|| DeskError::Invalid("Set up Claude Code first.".into()))?;
    crate::platform::open_in_terminal(&claude, &programs::child_path(None))
}
