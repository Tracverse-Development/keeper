//! The shared runner for agent CLIs (Claude Code, Codex, Gemini, Hermes): find the program,
//! run it headless with a time limit, hand each output line to the engine's reader as it
//! arrives (so the window can say "Running: ls ~/Desktop" while the agent works).

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

use crate::kernel::{paths, programs, DeskError, Result};

/// Stops every engine run in progress (the Stop button); `kill_on_drop` ends the process.
static STOP: tokio::sync::Notify = tokio::sync::Notify::const_new();
/// The words a stopped turn ends with.
pub const STOPPED: &str = "stopped";

/// Stop the engine runs in progress now.
pub fn cancel() {
    STOP.notify_waiters();
}

/// A chat answer should come quickly; an agent doing real work on the computer may take minutes.
pub const CHAT_TIMEOUT: Duration = Duration::from_secs(180);
pub const ACT_TIMEOUT: Duration = Duration::from_secs(900);

/// The program on PATH or in the places CLIs usually install to (any OS).
pub fn program(name: &str) -> Option<PathBuf> {
    programs::find(name)
}

/// Where an engine works: the person's home when it may act, else a quiet folder of the app's own.
pub fn workdir(may_act: bool) -> PathBuf {
    if may_act {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    }
    let dir = paths::app_home().join("workspace");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub struct Run {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Start `program args` in `cwd`, with stdin open when `stdin` is true (an engine that takes
/// its message on stdin, or a warm spare that waits for one: `warm`).
pub fn spawn(program: &Path, args: &[String], cwd: &Path, stdin: bool) -> Result<Child> {
    Command::new(program)
        .args(args)
        .current_dir(cwd)
        .env("PATH", programs::child_path(None))
        .stdin(if stdin { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| DeskError::Brain(format!("could not start {}: {e}", program.display())))
}

/// Run `program args` in `cwd`; see `drive`.
pub async fn run(program: &Path, args: &[String], cwd: &Path, timeout: Duration, on_line: impl FnMut(&str) -> bool) -> Result<Run> {
    drive(spawn(program, args, cwd, false)?, None, timeout, on_line).await
}

/// Drive a started program: write `input` to its stdin and close it, then hand every stdout line
/// to `on_line` as it comes; `on_line` returns whether to keep going (`false` kills the program
/// at once; the caller knows why). Bounded by `timeout`.
pub async fn drive(mut child: Child, input: Option<String>, timeout: Duration, mut on_line: impl FnMut(&str) -> bool) -> Result<Run> {
    if let Some(stdin) = child.stdin.take() {
        let mut stdin = stdin;
        if let Some(text) = input {
            stdin.write_all(text.as_bytes()).await.map_err(|e| DeskError::Brain(format!("could not send the message: {e}")))?;
        }
        drop(stdin);
    }
    let stdout = child.stdout.take().ok_or_else(|| DeskError::Brain("no output".into()))?;
    let mut stderr = child.stderr.take().ok_or_else(|| DeskError::Brain("no error output".into()))?;
    let work = async {
        let mut all = String::new();
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let keep_going = on_line(&line);
            all.push_str(&line);
            all.push('\n');
            if !keep_going {
                let _ = child.kill().await;
                return (all, String::new(), false);
            }
        }
        let mut err = String::new();
        let _ = stderr.read_to_string(&mut err).await;
        let status = child.wait().await;
        (all, err, status.map(|s| s.success()).unwrap_or(false))
    };
    // The person can stop a turn at any moment (`cancel`): the program is killed with the future.
    let bounded = tokio::time::timeout(timeout, work);
    let (stdout, stderr, success) = tokio::select! {
        done = bounded => done.map_err(|_| DeskError::Brain(format!("it took longer than {} minutes", timeout.as_secs() / 60)))?,
        _ = STOP.notified() => return Err(DeskError::Brain(STOPPED.into())),
    };
    Ok(Run { success, stdout, stderr })
}

/// Shorten a tool input for display and the DKG record (one line, at most `max` characters).
pub fn short(text: &str, max: usize) -> String {
    let one_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if one_line.chars().count() <= max {
        one_line
    } else {
        format!("{}…", one_line.chars().take(max).collect::<String>())
    }
}
