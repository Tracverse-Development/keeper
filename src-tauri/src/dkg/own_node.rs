//! The node Keeper installed for the person (never one it found): keeping it running and
//! removing it. A node only runs while its daemon does, and nothing restarted it after a reboot
//! or a crash, so a keeper silently lost its memory (FIX-0009, found in the round-2 VM tests).
//! `ensure_running` starts it at launch when it does not answer; `stop` ends it before Keeper is
//! removed (deleting the app alone left the daemon listening on the network, with its 547 MB).

use std::path::{Path, PathBuf};
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
    if !is_own(node_home) || answers(&home()).await || !dkg_program().exists() {
        return Ok(false);
    }
    run_dkg("start").await?;
    let started = std::time::Instant::now();
    while started.elapsed() < START_WAIT {
        if answers(&home()).await {
            return Ok(true);
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    Err(DeskError::Node("Keeper's memory node was started but did not answer within a minute".into()))
}

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
