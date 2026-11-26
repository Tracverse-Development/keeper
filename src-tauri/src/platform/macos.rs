//! macOS: `open` for apps and pages, `osascript` for notifications, `scutil` for the name,
//! `mdfind` for files (`spotlight_macos.rs`).
//! Arguments are always passed as separate argv entries, never through a shell.

use std::process::Command;

use crate::kernel::{DeskError, Result};

pub use super::spotlight_macos::spotlight;

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

pub fn open_url(url: &str) -> Result<()> {
    run(Command::new("/usr/bin/open").arg(url), "open that page")
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
