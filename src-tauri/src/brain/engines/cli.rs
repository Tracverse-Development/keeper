//! The shared runner for agent CLIs (Claude Code, Codex, Gemini, Hermes): find the program,
//! run it headless with a time limit, hand each output line to the engine's reader as it
//! arrives (so the window can say "Running: ls ~/Desktop" while the agent works). Each run is
//! registered with `control` so the person can pause, resume or redirect it; its time limit
//! counts only time spent working.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

use crate::kernel::{paths, programs, DeskError, Result};

use super::control;

/// Stops every engine run in progress (the Stop button); `kill_on_drop` ends the process.
static STOP: tokio::sync::Notify = tokio::sync::Notify::const_new();
/// The words a stopped turn ends with.
pub const STOPPED: &str = "stopped";
/// The words a run ends with when the person changed course (`redirect`): the brain takes the
/// correction and starts again (`brain::redirect`).
pub const REDIRECTED: &str = "redirected";

/// Stop the engine runs in progress now (anything paused is continued first, then stopped).
pub fn cancel() {
    control::cancel();
    STOP.notify_waiters();
}

/// Change course: stop the runs in progress so the brain starts again with `correction`.
pub fn redirect(correction: &str) -> std::result::Result<(), control::ControlError> {
    control::redirect(correction)?;
    STOP.notify_waiters();
    Ok(())
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
/// The program leads its own process group, so pausing it (`control`) also pauses the commands
/// it runs, and nothing else.
pub fn spawn(program: &Path, args: &[String], cwd: &Path, stdin: bool) -> Result<Child> {
    let mut command = Command::new(program);
    #[cfg(unix)]
    command.process_group(0);
    command
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
/// at once; the caller knows why). Bounded by `timeout` of WORK: time paused does not count.
pub async fn drive(mut child: Child, input: Option<String>, timeout: Duration, mut on_line: impl FnMut(&str) -> bool) -> Result<Run> {
    let leader = child.id();
    let run = control::register(leader);
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
    // The person can stop or redirect a turn at any moment: the program's group is asked to end
    // and the program is killed when `child` drops (`kill_on_drop`).
    let ended = tokio::select! {
        done = work => Ok(done),
        _ = control::worked_for(run.id(), timeout) => Err(format!("it took longer than {} minutes", timeout.as_secs() / 60)),
        _ = STOP.notified() => Err(if control::redirect_pending() { REDIRECTED } else { STOPPED }.to_string()),
    };
    match ended {
        Ok((stdout, stderr, success)) => Ok(Run { success, stdout, stderr }),
        Err(why) => {
            control::end_group(leader);
            Err(DeskError::Brain(why))
        }
    }
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

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::Instant;

    fn state_of(pid: u32) -> String {
        let out = std::process::Command::new("ps").args(["-o", "stat=", "-p", &pid.to_string()]).output().unwrap();
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    /// A real child process: paused in place, its time limit not counting the pause, resumed;
    /// then paused and stopped, which ends it and leaves nothing frozen. One test, because
    /// pausing applies to every run in progress.
    #[tokio::test]
    async fn a_real_run_pauses_resumes_and_stops_while_paused() {
        let sh = PathBuf::from("sh");
        let script = |s: &str| vec!["-c".to_string(), s.to_string()];
        assert!(control::pause().is_err(), "nothing running says so");

        // Six lines 0.25 s apart (1.5 s of work) inside a 2.5 s limit, paused for 1.5 s.
        let child = spawn(&sh, &script("for i in 1 2 3 4 5 6; do echo $i; sleep 0.25; done"), Path::new("/tmp"), false).unwrap();
        let pid = child.id().unwrap();
        let pauser = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            assert_eq!(control::pause(), Ok(control::WorkState::Paused));
            tokio::time::sleep(Duration::from_millis(200)).await;
            let frozen = state_of(pid);
            tokio::time::sleep(Duration::from_millis(1300)).await;
            assert_eq!(control::resume(), Ok(control::WorkState::Running));
            frozen
        });
        let started = Instant::now();
        let run = drive(child, None, Duration::from_millis(2500), |_| true).await.expect("the pause did not count against the limit");
        assert!(started.elapsed() > Duration::from_millis(2500), "it really waited while paused");
        assert_eq!(run.stdout.lines().count(), 6);
        assert!(pauser.await.unwrap().starts_with('T'), "the process was stopped in place");
        assert_eq!(control::state(), control::WorkState::Idle);

        // Stop while paused: the run ends as stopped and its whole group is gone, the command it
        // was running included (FIX-0038: only the engine itself used to be killed), not frozen.
        let child = spawn(&sh, &script("sleep 30 & echo $!; wait"), Path::new("/tmp"), false).unwrap();
        let pid = child.id().unwrap();
        let stopper = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(400)).await;
            control::pause().unwrap();
            tokio::time::sleep(Duration::from_millis(200)).await;
            cancel();
        });
        let mut command_pid = String::new();
        let ended = drive(child, None, Duration::from_secs(60), |line| {
            command_pid = line.trim().to_string();
            true
        })
        .await;
        stopper.await.unwrap();
        assert!(matches!(ended, Err(DeskError::Brain(ref m)) if m == STOPPED));
        tokio::time::sleep(Duration::from_millis(300)).await;
        for (what, p) in [("the engine", pid), ("the command it ran", command_pid.parse().unwrap())] {
            let left = state_of(p);
            assert!(left.is_empty() || left.starts_with('Z'), "{what} is gone (state {left:?})");
        }
        assert_eq!(control::state(), control::WorkState::Idle);

        // Redirect: the run ends as redirected and the correction waits for the brain.
        let child = spawn(&sh, &script("echo go; sleep 30"), Path::new("/tmp"), false).unwrap();
        let redirector = tokio::spawn(async {
            tokio::time::sleep(Duration::from_millis(300)).await;
            redirect("use metric").unwrap();
        });
        let ended = drive(child, None, Duration::from_secs(60), |_| true).await;
        redirector.await.unwrap();
        assert!(matches!(ended, Err(DeskError::Brain(ref m)) if m == REDIRECTED));
        assert_eq!(control::take_correction().as_deref(), Some("use metric"));
    }
}
