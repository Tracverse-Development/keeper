//! Finding, installing and starting the DKG node this assistant remembers on.
//!
//! A node keeps its files in a home folder (`DKG_HOME`, else `~/.dkg`): `api.port` and
//! `auth.token` (comment lines start with `#`). Keeper first looks for a node the person
//! already has; only when there is none does it install its OWN node in its own folder
//! (`~/Library/Application Support/Keeper/dkg-node`) on a free port, pinned to a known
//! version with automatic updates off. It never starts, stops or changes a node it did not install.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use tokio::process::Command;

use crate::kernel::{paths, programs, DeskError, Result};

/// The node version Keeper installs (the version proven on the founder's Mac, 2026-11-25).
pub const NODE_PACKAGE: &str = "@origintrail-official/dkg@10.0.26";
/// The network a new node joins (an edge node; no tokens are spent by anything Keeper does).
const NEW_NODE_NETWORK: &str = "testnet";
const PORT_RANGE: std::ops::RangeInclusive<u16> = 9210..=9239;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeLocation {
    pub home: PathBuf,
    pub port: u16,
    #[serde(skip)]
    pub token: String,
}

/// The token is the first line of `auth.token` that is not a comment.
pub fn read_token(text: &str) -> Option<String> {
    text.lines().map(str::trim).find(|l| !l.is_empty() && !l.starts_with('#')).map(str::to_string)
}

/// Read a node's location from its home folder, or None when it has no port or token.
pub fn locate(home: &Path) -> Option<NodeLocation> {
    let port = std::fs::read_to_string(home.join("api.port")).ok()?.trim().parse().ok()?;
    let token = read_token(&std::fs::read_to_string(home.join("auth.token")).ok()?)?;
    Some(NodeLocation { home: home.to_path_buf(), port, token })
}

/// Where to look, in order: the folder chosen at setup, `DKG_HOME`, `~/.dkg`, our own node.
pub fn candidate_homes(saved: &str) -> Vec<PathBuf> {
    let mut homes = Vec::new();
    if !saved.is_empty() {
        homes.push(PathBuf::from(saved));
    }
    if let Ok(env_home) = std::env::var("DKG_HOME") {
        homes.push(PathBuf::from(env_home));
    }
    if let Some(home) = dirs::home_dir() {
        homes.push(home.join(".dkg"));
    }
    homes.push(paths::own_node_home().join("home"));
    homes.dedup();
    homes
}

fn free_port() -> Option<u16> {
    PORT_RANGE.into_iter().find(|p| std::net::TcpListener::bind(("127.0.0.1", *p)).is_ok())
}

/// The config `dkg init` writes for an edge node with sign-in on and automatic updates off.
pub fn node_config(name: &str, port: u16) -> serde_json::Value {
    serde_json::json!({
        "name": name,
        "apiPort": port,
        "listenPort": 0,
        "nodeRole": "edge",
        "networkConfig": NEW_NODE_NETWORK,
        "contextGraphs": [],
        "autoUpdate": { "enabled": false },
        "auth": { "enabled": true }
    })
}

/// Install and start Keeper's own node. `say` receives one plain line per step.
pub async fn install(computer_name: &str, say: impl Fn(&str)) -> Result<NodeLocation> {
    // Node.js: the computer's own (20+), or Keeper's private, checksum-verified copy.
    let bin_dir = super::runtime::ensure_node(&say).await?;
    let npm = bin_dir.join(if cfg!(windows) { "npm.cmd" } else { "npm" });
    let root = paths::own_node_home();
    let program_dir = root.join("program");
    let home = root.join("home");
    std::fs::create_dir_all(&program_dir)?;
    std::fs::create_dir_all(&home)?;
    let path_env = programs::child_path(Some(&bin_dir));

    say(&format!("Downloading the DKG node ({NODE_PACKAGE})…"));
    let out = Command::new(&npm)
        .args(["install", "--no-audit", "--no-fund", "--prefix"])
        .arg(&program_dir)
        .arg(NODE_PACKAGE)
        .env("PATH", &path_env)
        .output()
        .await?;
    if !out.status.success() {
        let tail: String = String::from_utf8_lossy(&out.stderr).lines().rev().take(3).collect::<Vec<_>>().join(" ");
        return Err(DeskError::Io(format!("The node did not install: {tail}")));
    }

    let port = free_port().ok_or_else(|| DeskError::Io("No free local port between 9210 and 9239.".into()))?;
    say(&format!("Writing the node's settings (port {port}, automatic updates off)…"));
    let config = serde_json::to_vec_pretty(&node_config(computer_name, port))?;
    std::fs::write(home.join("config.json"), config)?;

    say("Starting the node…");
    let dkg = program_dir.join("node_modules").join(".bin").join(if cfg!(windows) { "dkg.cmd" } else { "dkg" });
    let start = Command::new(&dkg).arg("start").env("DKG_HOME", &home).env("PATH", &path_env).output().await?;
    if !start.status.success() {
        return Err(DeskError::Io(format!("The node did not start: {}", String::from_utf8_lossy(&start.stdout).lines().last().unwrap_or(""))));
    }

    say("Waiting for the node to answer…");
    for _ in 0..90 {
        if let Some(location) = locate(&home) {
            if super::DkgClient::new(&location).status().await.is_ok() {
                return Ok(location);
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    Err(DeskError::Node("the new node started but did not answer within 90 seconds".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_token_skips_the_comment_line() {
        let file = "# DKG node API token — treat this like a password\nabc123\n";
        assert_eq!(read_token(file).as_deref(), Some("abc123"));
        assert_eq!(read_token("# only a comment\n"), None);
    }

    #[test]
    fn a_new_node_is_pinned_and_signed_in() {
        let c = node_config("Mac", 9211);
        assert_eq!(c["autoUpdate"]["enabled"], false);
        assert_eq!(c["auth"]["enabled"], true);
        assert_eq!(c["nodeRole"], "edge");
    }

    #[test]
    fn locate_reads_port_and_token() {
        let dir = std::env::temp_dir().join(format!("umoja-desk-node-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("api.port"), "9200\n").unwrap();
        std::fs::write(dir.join("auth.token"), "# c\nsecret\n").unwrap();
        let loc = locate(&dir).unwrap();
        assert_eq!((loc.port, loc.token.as_str()), (9200, "secret"));
        std::fs::remove_dir_all(dir).ok();
    }
}
