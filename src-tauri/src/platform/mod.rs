//! The OS seam: every call to the operating system goes through here (open an app or a page,
//! show a notification, find the bundled voice helper). Each build compiles only its OS's file,
//! so a Windows or Linux port is a new file here and nothing else changes.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as os;

#[cfg(not(target_os = "macos"))]
mod unsupported;
#[cfg(not(target_os = "macos"))]
use unsupported as os;

use std::path::PathBuf;

use crate::kernel::Result;

pub fn open_app(name: &str) -> Result<()> {
    os::open_app(name)
}

pub fn open_url(url: &str) -> Result<()> {
    os::open_url(url)
}

pub fn notify(title: &str, body: &str) {
    os::notify(title, body)
}

/// A secret from the system keychain (None when there is none).
pub fn secret_get(name: &str) -> Option<String> {
    os::secret_get(name)
}

/// Store (or replace) a secret in the system keychain; an empty value deletes it.
pub fn secret_set(name: &str, value: &str) -> Result<()> {
    os::secret_set(name, value)
}

/// The computer's name ("Ada's MacBook Pro"), for naming a new node.
pub fn computer_name() -> String {
    os::computer_name()
}

/// The voice helper next to the app's executable (a Tauri sidecar), or the dev build's copy.
pub fn voice_helper() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let bundled = dir.join("umoja-voice");
    if bundled.is_file() {
        return Some(bundled);
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join(format!("umoja-voice-{}", os::TARGET_TRIPLE));
    dev.is_file().then_some(dev)
}
