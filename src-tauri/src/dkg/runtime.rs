//! Node.js for Keeper's own DKG node, so a person never has to install it themselves. A Node.js
//! 20 or newer already on the computer is used as it is; otherwise the pinned official build is
//! downloaded from nodejs.org, checked against the release's published SHA-256 (SHASUMS256.txt),
//! and unpacked into Keeper's own folder (`<node home>/runtime`). Found on a clean Mac in the VM
//! tests (round 2): the node install stopped at "install Node.js from nodejs.org".

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::kernel::{paths, programs, DeskError, Result};

/// The pinned Node.js release (LTS line 24, released 2026-11-10).
pub const NODE_VERSION: &str = "24.22.3";
const OLDEST_MAJOR: u32 = 20;

/// The release file for this computer, e.g. `node-v24.22.3-darwin-arm64.tar.gz`.
pub fn archive_name(version: &str) -> Option<String> {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "linux" => "linux",
        _ => return None,
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        _ => return None,
    };
    Some(format!("node-v{version}-{os}-{arch}.tar.gz"))
}

/// The expected SHA-256 of `file` in a SHASUMS256.txt body.
pub fn expected_sha(shasums: &str, file: &str) -> Option<String> {
    shasums.lines().find_map(|l| {
        let (sum, name) = l.split_once("  ")?;
        (name.trim() == file && sum.len() == 64 && sum.chars().all(|c| c.is_ascii_hexdigit())).then(|| sum.to_lowercase())
    })
}

/// The major version a `node --version` line names ("v24.22.2" → 24).
pub fn major(version_line: &str) -> Option<u32> {
    version_line.trim().trim_start_matches('v').split('.').next()?.parse().ok()
}

async fn usable(node: &Path) -> bool {
    match tokio::process::Command::new(node).arg("--version").output().await {
        Ok(out) => major(&String::from_utf8_lossy(&out.stdout)).is_some_and(|m| m >= OLDEST_MAJOR),
        Err(_) => false,
    }
}

/// The folder holding a usable `node` and `npm`, installing Keeper's own copy when needed.
pub async fn ensure_node(say: &impl Fn(&str)) -> Result<PathBuf> {
    if let Some(node) = programs::find("node") {
        if usable(&node).await {
            return Ok(node.parent().map(Path::to_path_buf).unwrap_or_default());
        }
    }
    let file = archive_name(NODE_VERSION).ok_or_else(|| DeskError::Invalid("Keeper can't set up Node.js on this kind of computer yet. Install Node.js 20 or newer from nodejs.org, then press Try again.".into()))?;
    let runtime = paths::own_node_home().join("runtime");
    let bin = runtime.join(file.trim_end_matches(".tar.gz")).join("bin");
    if usable(&bin.join("node")).await {
        return Ok(bin);
    }
    say(&format!("Setting up Node.js {NODE_VERSION} for the node (a one-time download)…"));
    let base = format!("https://nodejs.org/dist/v{NODE_VERSION}");
    let http = reqwest::Client::builder().no_proxy().build().map_err(|e| DeskError::Io(e.to_string()))?;
    let shasums = http.get(format!("{base}/SHASUMS256.txt")).send().await.and_then(|r| r.error_for_status()).map_err(|e| DeskError::Io(format!("could not reach nodejs.org: {e}")))?.text().await.map_err(|e| DeskError::Io(e.to_string()))?;
    let want = expected_sha(&shasums, &file).ok_or_else(|| DeskError::Io(format!("nodejs.org lists no checksum for {file}")))?;
    let bytes = http.get(format!("{base}/{file}")).send().await.and_then(|r| r.error_for_status()).map_err(|e| DeskError::Io(format!("could not download Node.js: {e}")))?.bytes().await.map_err(|e| DeskError::Io(e.to_string()))?;
    let got = hex::encode(Sha256::digest(&bytes));
    if got != want {
        return Err(DeskError::Io("the Node.js download did not match its published checksum, so it was not used".into()));
    }
    std::fs::create_dir_all(&runtime)?;
    let archive = runtime.join(&file);
    std::fs::write(&archive, &bytes)?;
    crate::platform::unpack(&archive, &runtime).await?;
    let _ = std::fs::remove_file(&archive);
    if !usable(&bin.join("node")).await {
        return Err(DeskError::Io("Node.js was unpacked but does not run".into()));
    }
    Ok(bin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_right_build_and_its_checksum_are_chosen() {
        let sums = "aaaa  node-v24.22.3-linux-x64.tar.gz\nb5d1c0ffee00000000000000000000000000000000000000000000000000b5d1  node-v24.22.3-darwin-arm64.tar.gz\n";
        assert_eq!(expected_sha(sums, "node-v24.22.3-darwin-arm64.tar.gz").as_deref(), Some("b5d1c0ffee00000000000000000000000000000000000000000000000000b5d1"));
        assert_eq!(expected_sha(sums, "node-v24.22.3-linux-x64.tar.gz"), None, "a malformed sum is refused");
        assert_eq!(major("v24.22.2\n"), Some(24));
        assert_eq!(major("garbage"), None);
        if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
            assert_eq!(archive_name("24.22.3").as_deref(), Some("node-v24.22.3-darwin-arm64.tar.gz"));
        }
    }
}
