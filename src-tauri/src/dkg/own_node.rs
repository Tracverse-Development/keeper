//! The node Keeper installed for the person (never one it found): keeping it running and
//! removing it. A node only runs while its daemon does, and nothing restarted it after a reboot
//! or a crash, so a keeper silently lost its memory (FIX-0009, found in the round-2 VM tests).
//! `ensure_running` starts it at launch when it does not answer; `stop` ends it before Keeper is
//! removed (deleting the app alone left the daemon listening on the network, with its 547 MB).

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tokio::process::Command;

use crate::kernel::{paths, programs, DeskError, Result};

use super::{node, runtime, DkgClient};

/// How long a starting node may take to answer.
const START_WAIT: Duration = Duration::from_secs(60);

/// The home folder of Keeper's own node.
pub fn home() -> PathBuf {
    paths::own_node_home().join("home")
}

/// Is `node_home` the node Keeper installed? (Keeper never starts or stops any other node.)
pub fn is_own(node_home: &str) -> bool {
    !node_home.is_empty() && Path::new(node_home) == home()
}

fn dkg_program() -> PathBuf {
    paths::own_node_home().join("program").join("node_modules").join(".bin").join(if cfg!(windows) { "dkg.cmd" } else { "dkg" })
}

async fn answers(node_home: &Path) -> bool {
    match node::locate(node_home) {
        Some(location) => DkgClient::new(&location).status().await.is_ok(),
        None => false,
    }
}

async fn run_dkg(verb: &str) -> Result<()> {
    let bin_dir = runtime::ensure_node(&|_: &str| {}).await?;
    let out = Command::new(dkg_program()).arg(verb).env("DKG_HOME", home()).env("PATH", programs::child_path(Some(&bin_dir))).output().await?;
    if out.status.success() {
        Ok(())
    } else {
        Err(DeskError::Io(format!("dkg {verb}: {}", String::from_utf8_lossy(&out.stdout).lines().last().unwrap_or(""))))
    }
}

/// Start Keeper's own node if it is the one in use and does not answer. A node the person runs
/// themselves is left alone.
pub async fn ensure_running(node_home: &str) -> Result<bool> {
    if !is_own(node_home) || !dkg_program().exists() {
        return Ok(false);
    }
    // One start at a time: several failing turns in a row must not start several daemons.
    if STARTING.swap(true, Ordering::SeqCst) {
        return Ok(false);
    }
    let result = start_and_wait().await;
    STARTING.store(false, Ordering::SeqCst);
    result
}

static STARTING: AtomicBool = AtomicBool::new(false);

async fn start_and_wait() -> Result<bool> {
    if answers(&home()).await {
        return Ok(false);
    }
    // A node that keeps dying at start may have a damaged dashboard file (FIX-0058): set it aside
    // first, so this start (or its supervisor's next restart) comes up with a fresh one.
    super::node_repair::repair(&home()).await;
    run_dkg("start").await?;
    let started = std::time::Instant::now();
    while started.elapsed() < START_WAIT {
        if answers(&home()).await {
            return Ok(true);
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    Err(DeskError::Node("Keeper's memory node was started but did not answer within a minute.".into()))
}

/// The watchdog: every `WATCH_EVERY`, start Keeper's own node if it stopped answering, and send
/// the writes that waited in the outbox once it answers. Hot memory hides a dead node from the
/// conversation (turns still answer and remember), so nothing else would notice it (round 5, VM).
pub fn watch(node_home: impl Fn() -> String + Send + 'static) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(WATCH_EVERY).await;
            let home_now = node_home();
            if home_now.is_empty() {
                continue;
            }
            let _ = ensure_running(&home_now).await;
            if crate::memory::outbox::waiting() > 0 {
                if let Some(location) = node::locate(Path::new(&home_now)) {
                    let client = DkgClient::new(&location);
                    if client.status().await.is_ok() {
                        crate::memory::outbox::flush(&client).await;
                    }
                }
            }
        }
    });
}

const WATCH_EVERY: Duration = Duration::from_secs(20);

/// Stop Keeper's own node (before removing Keeper). Never touches another node.
pub async fn stop() -> Result<()> {
    if dkg_program().exists() {
        run_dkg("stop").await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn only_keepers_own_node_is_ever_started_or_stopped() {
        assert!(super::is_own(&super::home().display().to_string()));
        assert!(!super::is_own("/Users/someone/.dkg"));
        assert!(!super::is_own(""));
    }
}
