//! macOS: `open` for apps and pages, `osascript` for notifications, `scutil` for the name,
//! `mdfind` for files (`spotlight_macos.rs`), what the Mac reports about itself
//! (`status_macos.rs`) and the settings a keeper may change when asked (`controls_macos.rs`).
//! Arguments are always passed as separate argv entries, never through a shell.

use std::process::Command;

use crate::kernel::{DeskError, Result};

pub use super::mail_macos::{compose as compose_mail, unread as unread_mail};
pub use super::controls_macos::{quit_app, display_sleep, keep_awake, lock_screen, new_note, run_shortcut, screenshot, set_dark_mode, set_volume};
pub use super::spotlight_macos::spotlight;
pub use super::status_macos::{battery, open_apps, shortcuts, time_in_zone, wifi};

pub const TARGET_TRIPLE: &str = if cfg!(target_arch = "aarch64") { "aarch64-apple-darwin" } else { "x86_64-apple-darwin" };

fn run(cmd: &mut Command, what: &str) -> Result<()> {
    let out = cmd.output()?;
    if out.status.success() {
        Ok(())
    } else {
        Err(DeskError::Io(format!("I couldn't {what}.")))
    }
}

pub fn open_app(name: &str) -> Result<()> {
    run(Command::new("/usr/bin/open").arg("-a").arg(name), &format!("find an app called {name}"))
}

/// The folders apps are installed in (the system's own, the shared ones, the person's).
fn app_folders() -> Vec<std::path::PathBuf> {
    let mut folders: Vec<std::path::PathBuf> = ["/Applications", "/Applications/Utilities", "/System/Applications", "/System/Applications/Utilities"].iter().map(std::path::PathBuf::from).collect();
    folders.extend(dirs::home_dir().map(|h| h.join("Applications")));
    folders
}

pub async fn sqlite_quick_check(db: &std::path::Path) -> Option<(String, bool)> {
    let sqlite = std::path::Path::new("/usr/bin/sqlite3");
    if !sqlite.exists() {
        return None;
    }
    let out = tokio::process::Command::new(sqlite).arg(db).arg("PRAGMA quick_check;").output().await.ok()?;
    Some((format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr)), out.status.success()))
}

pub async fn sqlite_recover(damaged: &std::path::Path, into: &std::path::Path) -> bool {
    use tokio::io::AsyncWriteExt;
    let sqlite = std::path::Path::new("/usr/bin/sqlite3");
    if !sqlite.exists() {
        return false;
    }
    let Ok(dump) = tokio::process::Command::new(sqlite).arg(damaged).arg(".recover").output().await else { return false };
    if dump.stdout.is_empty() {
        return false;
    }
    let Ok(mut load) = tokio::process::Command::new(sqlite).arg(into).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).spawn() else { return false };
    let Some(mut stdin) = load.stdin.take() else { return false };
    if stdin.write_all(&dump.stdout).await.is_err() {
        return false;
    }
    drop(stdin);
    load.wait().await.is_ok_and(|s| s.success()) && into.exists()
}

pub fn app_installed(name: &str) -> bool {
    let wanted = format!("{}.app", name.trim().to_lowercase());
    // A plain name only: never a path, so nothing outside the app folders is looked at.
    if name.trim().is_empty() || name.contains('/') {
        return false;
    }
    app_folders().iter().any(|folder| {
        std::fs::read_dir(folder).map(|entries| entries.flatten().any(|e| e.file_name().to_string_lossy().to_lowercase() == wanted)).unwrap_or(false)
    })
}

pub fn open_url(url: &str) -> Result<()> {
    run(Command::new("/usr/bin/open").arg(url), "open that page")
}

pub fn open_path(path: &std::path::Path) -> Result<()> {
    run(Command::new("/usr/bin/open").arg(path), "open that")
}

/// Runs a system tool (argv only, never a shell) and returns what it printed, or `failed` as a
/// plain sentence when it fails or takes longer than `within` (the tool is stopped then).
/// `tool_output(Command::new("/usr/bin/pmset").args(["-g", "batt"]), Duration::from_secs(5), "I couldn't read the battery.")`
pub(super) async fn tool_output(cmd: &mut tokio::process::Command, within: std::time::Duration, failed: &str) -> Result<String> {
    let run = cmd.env("LC_ALL", "en_US.UTF-8").kill_on_drop(true).output();
    match tokio::time::timeout(within, run).await {
        Ok(Ok(out)) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).into_owned()),
        _ => Err(DeskError::Io(failed.to_string())),
    }
}

/// AppleScript string literal: backslashes and quotes escaped, so the text stays text.
fn applescript_text(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

pub fn reveal(path: &std::path::Path) {
    let _ = Command::new("/usr/bin/open").arg("-R").arg(path).output();
}

pub fn notify(title: &str, body: &str) {
    let script = format!("display notification {} with title {}", applescript_text(body), applescript_text(title));
    let _ = Command::new("/usr/bin/osascript").arg("-e").arg(script).output();
}

/// `textutil` turns a document into plain text on standard output (the path is one argv entry
/// after `--`-free fixed flags; a document that takes too long is given up on).
pub async fn document_text(path: &std::path::Path) -> Result<String> {
    let convert = tokio::process::Command::new("/usr/bin/textutil").args(["-convert", "txt", "-stdout"]).arg(path).kill_on_drop(true).output();
    match tokio::time::timeout(std::time::Duration::from_secs(15), convert).await {
        Ok(Ok(out)) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).into_owned()),
        _ => Err(DeskError::Invalid("I couldn't read that document.".into())),
    }
}

/// The text on the clipboard (`pbpaste`; empty when it holds no text).
pub async fn clipboard_read() -> Result<String> {
    let out = tokio::process::Command::new("/usr/bin/pbpaste").env("LC_CTYPE", "UTF-8").output().await.map_err(|_| DeskError::Io("I couldn't read the clipboard.".into()))?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Put `text` on the clipboard (`pbcopy`, the text on its standard input; never an argument).
pub async fn clipboard_write(text: &str) -> Result<()> {
    use tokio::io::AsyncWriteExt;
    let failed = || DeskError::Io("I couldn't put that on the clipboard.".into());
    let mut child = tokio::process::Command::new("/usr/bin/pbcopy").env("LC_CTYPE", "UTF-8").stdin(std::process::Stdio::piped()).spawn().map_err(|_| failed())?;
    let mut stdin = child.stdin.take().ok_or_else(failed)?;
    stdin.write_all(text.as_bytes()).await.map_err(|_| failed())?;
    drop(stdin);
    if child.wait().await.map_err(|_| failed())?.success() {
        Ok(())
    } else {
        Err(failed())
    }
}

pub fn system_version() -> String {
    let version = Command::new("/usr/bin/sw_vers").arg("-productVersion").output().ok().map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default();
    format!("macOS {version}")
}

pub fn computer_name() -> String {
    Command::new("/usr/sbin/scutil")
        .args(["--get", "ComputerName"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Keeper".into())
}

#[cfg(test)]
mod tests {
    #[test]
    fn notification_text_cannot_escape_its_string() {
        assert_eq!(super::applescript_text("a\"b\\c"), "\"a\\\"b\\\\c\"");
    }
}

/// A `.command` file in Keeper's folder that Terminal runs when opened.
pub fn open_in_terminal(program: &std::path::Path, path: &std::ffi::OsStr) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let script = crate::kernel::paths::app_home().join("sign-in.command");
    let quote = |s: &str| format!("'{}'", s.replace('\'', "'\\''"));
    let body = format!("#!/bin/sh\nexport PATH={}\nexec {}\n", quote(&path.to_string_lossy()), quote(&program.display().to_string()));
    std::fs::write(&script, body)?;
    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700))?;
    std::process::Command::new("/usr/bin/open").arg(&script).spawn()?;
    Ok(())
}

/// `/bin/kill -s <SIG> -- -<leader>`: the whole group (an engine and the commands it runs).
pub fn signal_group(leader: u32, signal: super::GroupSignal) -> Result<()> {
    let name = match signal {
        super::GroupSignal::Pause => "STOP",
        super::GroupSignal::Continue => "CONT",
        super::GroupSignal::End => "TERM",
    };
    run(Command::new("/bin/kill").args(["-s", name, "--"]).arg(format!("-{leader}")), "signal the keeper's work")
}
