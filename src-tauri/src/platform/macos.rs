//! macOS: `open` for apps and pages, `osascript` for notifications, `scutil` for the name.
//! Arguments are always passed as separate argv entries, never through a shell.

use std::process::Command;

use crate::kernel::{DeskError, Result};

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

pub fn notify(title: &str, body: &str) {
    let script = format!("display notification {} with title {}", applescript_text(body), applescript_text(title));
    let _ = Command::new("/usr/bin/osascript").arg("-e").arg(script).output();
}

/// Keychain items are filed under the app's identifier.
const KEYCHAIN_SERVICE: &str = "com.umojaark.desk";

pub fn secret_get(name: &str) -> Option<String> {
    let bytes = security_framework::passwords::get_generic_password(KEYCHAIN_SERVICE, name).ok()?;
    String::from_utf8(bytes).ok().filter(|s| !s.is_empty())
}

pub fn secret_set(name: &str, value: &str) -> Result<()> {
    if value.is_empty() {
        let _ = security_framework::passwords::delete_generic_password(KEYCHAIN_SERVICE, name);
        return Ok(());
    }
    security_framework::passwords::set_generic_password(KEYCHAIN_SERVICE, name, value.as_bytes()).map_err(|_| DeskError::Io("The key could not be saved in the Keychain.".into()))
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
