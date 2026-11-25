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
