//! The OS seam: every call to the operating system goes through here (open an app or a page,
//! show a notification, find the bundled voice helper, ask Spotlight for files). Each build
//! compiles only its OS's file, so a Windows or Linux port is a new file here and nothing else
//! changes.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
mod spotlight_macos;
#[cfg(target_os = "macos")]
use macos as os;

#[cfg(not(target_os = "macos"))]
mod unsupported;
#[cfg(not(target_os = "macos"))]
use unsupported as os;

use std::path::PathBuf;
use std::time::Duration;

use crate::kernel::Result;

pub fn open_app(name: &str) -> Result<()> {
    os::open_app(name)
}

pub fn open_url(url: &str) -> Result<()> {
    os::open_url(url)
}

/// Show a file in the system file manager (Finder on macOS).
pub fn reveal(path: &std::path::Path) {
    os::reveal(path)
}

pub fn notify(title: &str, body: &str) {
    os::notify(title, body)
}

/// The computer's name ("Ada's MacBook Pro"), for naming a new node.
pub fn computer_name() -> String {
    os::computer_name()
}

/// Ask the system file index (Spotlight on macOS) for paths matching `query`, a query in the
/// index's own syntax built by the caller (`pim::files`). Searches only inside `only_in` when
/// given; stops after `max` paths or `within`, whichever comes first, and returns what it has.
/// Systems without an index answer with a plain-words error (callers fall back to a walk).
pub async fn spotlight(query: &str, only_in: &[PathBuf], max: usize, within: Duration) -> Result<Vec<PathBuf>> {
    os::spotlight(query, only_in, max, within).await
}

/// The voice helper next to the app's executable (a Tauri sidecar), or the dev build's copy.
pub fn voice_helper() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let bundled = dir.join("keeper-voice");
    if bundled.is_file() {
        return Some(bundled);
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join(format!("keeper-voice-{}", os::TARGET_TRIPLE));
    dev.is_file().then_some(dev)
}
