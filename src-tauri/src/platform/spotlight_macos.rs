//! Spotlight on macOS: `mdfind`, run with argv only (never a shell), read line by line and cut
//! off at a path count or a time limit so a huge index can never stall a turn.

use std::ffi::OsString;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::kernel::{DeskError, Result};

const MDFIND: &str = "/usr/bin/mdfind";

/// The argv after the program: one `-onlyin <dir>` per folder, then the query as ONE argument.
/// The query is always last, so even a query that starts with `-` would not read as a flag
/// (callers also sanitise it: `pim::files::sanitise`).
pub fn spotlight_args(query: &str, only_in: &[PathBuf]) -> Vec<OsString> {
    let mut args = Vec::with_capacity(only_in.len() * 2 + 1);
    for dir in only_in {
        args.push(OsString::from("-onlyin"));
        args.push(dir.clone().into_os_string());
    }
    args.push(OsString::from(query));
    args
}

pub async fn spotlight(query: &str, only_in: &[PathBuf], max: usize, within: Duration) -> Result<Vec<PathBuf>> {
    let mut child = Command::new(MDFIND)
        .args(spotlight_args(query, only_in))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| DeskError::Io("Spotlight could not be asked.".into()))?;
    let stdout = child.stdout.take().ok_or_else(|| DeskError::Io("Spotlight gave no answer.".into()))?;
    let mut found = Vec::new();
    let read = async {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.is_empty() {
                found.push(PathBuf::from(line));
            }
            if found.len() >= max {
                break;
            }
        }
    };
    // Out of time: keep what arrived (best effort), the child is killed on drop.
    let _ = tokio::time::timeout(within, read).await;
    let _ = child.start_kill();
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_is_one_last_argument_after_the_folders() {
        let args = spotlight_args("kMDItemDisplayName == \"*tax*\"cd", &[PathBuf::from("/Users/a"), PathBuf::from("/Applications")]);
        let words: Vec<String> = args.iter().map(|a| a.to_string_lossy().into_owned()).collect();
        assert_eq!(words, ["-onlyin", "/Users/a", "-onlyin", "/Applications", "kMDItemDisplayName == \"*tax*\"cd"]);
    }

    #[test]
    fn no_folders_means_just_the_query() {
        assert_eq!(spotlight_args("-rf", &[]), vec![OsString::from("-rf")]);
    }
}
