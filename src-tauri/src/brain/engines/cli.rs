//! The shared runner for agent CLIs (Claude Code, Codex, Gemini, Hermes): find the program,
//! run it headless with a time limit, hand each output line to the engine's reader as it
//! arrives (so the window can say "Running: ls ~/Desktop" while the agent works).

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;

use crate::kernel::{paths, programs, DeskError, Result};

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

/// Run `program args` in `cwd`; `on_line` sees every stdout line as it comes and returns
/// whether to keep going: `false` kills the program at once (the caller knows why).
pub async fn run(program: &Path, args: &[String], cwd: &Path, timeout: Duration, mut on_line: impl FnMut(&str) -> bool) -> Result<Run> {
    let mut child = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .env("PATH", programs::child_path(None))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| DeskError::Brain(format!("could not start {}: {e}", program.display())))?;
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
    let (stdout, stderr, success) = tokio::time::timeout(timeout, work).await.map_err(|_| DeskError::Brain(format!("it took longer than {} minutes", timeout.as_secs() / 60)))?;
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
