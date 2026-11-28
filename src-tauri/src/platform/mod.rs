//! The OS seam: every call to the operating system goes through here (open an app or a page,
//! show a notification, find the bundled voice helper, ask Spotlight for files). Each build
//! compiles only its OS's file, so a Windows or Linux port is a new file here and nothing else
//! changes.

#[cfg(target_os = "macos")]
mod macos;
mod pictures;
pub mod read_commands;
#[cfg(target_os = "macos")]
mod spotlight_macos;
#[cfg(target_os = "macos")]
mod status_macos;
#[cfg(target_os = "macos")]
mod controls_macos;
#[cfg(target_os = "macos")]
mod mail_macos;
#[cfg(target_os = "macos")]
mod browser_macos;
mod status;
#[cfg(target_os = "macos")]
use macos as os;

#[cfg(not(target_os = "macos"))]
mod unsupported;
#[cfg(not(target_os = "macos"))]
use unsupported as os;

use std::path::PathBuf;
use std::time::Duration;

use crate::kernel::Result;

pub use pictures::{save_png, PICTURES_FOLDER};
pub use status::{Battery, Volume, WiFi, ZoneTime, MAX_AWAKE_MINUTES};

/// An unread message as the inbox lists it: who sent it, its subject, when it came (ISO, local).
/// Never its words.
#[derive(Debug, Clone, PartialEq)]
pub struct Unread {
    pub from: String,
    pub subject: String,
    pub received: String,
}

/// A picture of a file as Quick Look draws it (PNG bytes, `size` pixels wide).
pub async fn quick_look_png(path: &std::path::Path, size: u32) -> Result<Vec<u8>> {
    os::quick_look_png(path, size).await
}

/// Runs a fixed script (`browser::scripts`) in Keeper's browser page, in an isolated world the page
/// cannot see, and returns its string answer.
pub async fn browser_script(view: &tauri::Webview, script: String) -> Result<String> {
    os::browser_script(view, script).await
}

/// Opens the person's own mail app on a filled-in `mailto:` link; nothing is sent.
pub fn compose_mail(mailto: &str) -> Result<()> {
    os::compose_mail(mailto)
}

/// How many unread messages the Mac's mail inbox holds, and the newest `limit` (sender, subject,
/// when). macOS asks the person first.
pub async fn unread_mail(limit: usize) -> Result<(usize, Vec<Unread>)> {
    os::unread_mail(limit).await
}

pub fn open_app(name: &str) -> Result<()> {
    os::open_app(name)
}

/// Whether an app with this name (any case, no ".app") is installed where apps live, so "open
/// Notes" can be run at once and "open the door for me" is left to the mind. Only looks.
pub fn app_installed(name: &str) -> bool {
    os::app_installed(name)
}

/// A SQLite database's own health check (`PRAGMA quick_check`) with the system's sqlite3: its
/// answer (stdout and stderr) and whether sqlite3 succeeded. None where the system has no sqlite3
/// (nothing is checked then). Only reads the file.
pub async fn sqlite_quick_check(db: &std::path::Path) -> Option<(String, bool)> {
    os::sqlite_quick_check(db).await
}

/// Rebuilds a damaged SQLite database into a new file with the system's sqlite3 (`.recover`,
/// which salvages every row it can read): true when `into` was written. False where the system
/// has no sqlite3 or the recovery failed. Reads `damaged`, writes only `into`.
pub async fn sqlite_recover(damaged: &std::path::Path, into: &std::path::Path) -> bool {
    os::sqlite_recover(damaged, into).await
}

pub fn open_url(url: &str) -> Result<()> {
    os::open_url(url)
}

/// Open a file or folder with its usual app (a folder opens in the Finder). The caller checks
/// the path (`sdk::packs::computer::home_path`: inside the person's home, absolute).
pub fn open_path(path: &std::path::Path) -> Result<()> {
    os::open_path(path)
}

/// Show a file in the system file manager (Finder on macOS).
pub fn reveal(path: &std::path::Path) {
    os::reveal(path)
}

pub fn notify(title: &str, body: &str) {
    os::notify(title, body)
}

/// The system's name and version ("macOS 27.2"), for a support report.
pub fn system_version() -> String {
    os::system_version()
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

/// The text of a word-processor or web document (rtf, doc, docx, odt, html, webarchive), read by
/// the system's own converter. Systems without one answer with a plain-words error.
pub async fn document_text(path: &std::path::Path) -> Result<String> {
    os::document_text(path).await
}

/// The text on the system clipboard (empty when it holds none), and putting text on it. Read
/// only when the person asks the keeper to work on what they copied (`sdk::packs::clipboard`).
pub async fn clipboard_read() -> Result<String> {
    os::clipboard_read().await
}

pub async fn clipboard_write(text: &str) -> Result<()> {
    os::clipboard_write(text).await
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

/// Unpack a `.tar.gz` / `.tar.xz` archive into `into` (the system `tar`, present on macOS, Linux
/// and Windows 10+). argv only, never a shell.
pub async fn unpack(archive: &std::path::Path, into: &std::path::Path) -> Result<()> {
    std::fs::create_dir_all(into)?;
    let out = tokio::process::Command::new("tar").arg("-xf").arg(archive).arg("-C").arg(into).output().await?;
    if out.status.success() {
        Ok(())
    } else {
        Err(crate::kernel::DeskError::Io(format!("could not unpack {}: {}", archive.display(), String::from_utf8_lossy(&out.stderr).lines().next().unwrap_or(""))))
    }
}

/// Open a terminal window running `program` (for sign-ins that need the person at a prompt).
/// `path` is the PATH the program runs with (it may need Keeper's own Node.js).
pub fn open_in_terminal(program: &std::path::Path, path: &std::ffi::OsStr) -> Result<()> {
    os::open_in_terminal(program, path)
}

/// What `signal_group` asks of a process group Keeper started.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupSignal {
    /// Stop in place (SIGSTOP): nothing runs until `Continue`.
    Pause,
    /// Carry on after a `Pause` (SIGCONT).
    Continue,
    /// Ask everything in the group to end (SIGTERM).
    End,
}

/// Send `signal` to the process group led by `leader` (a child Keeper spawned in its own group:
/// `brain::engines::cli::spawn`). Only for groups Keeper started and owns; never any other pid.
pub fn signal_group(leader: u32, signal: GroupSignal) -> Result<()> {
    os::signal_group(leader, signal)
}

// What a keeper can look at and change on this computer (`sdk::packs::computer`). Each reads or
// changes one thing, with argv only; systems without it answer in plain words.

/// The battery now; `None` on a computer without one (a desktop).
pub async fn battery() -> Result<Option<Battery>> {
    os::battery().await
}

/// The Wi-Fi connection now (network, signal, channel). Takes a few seconds on macOS.
pub async fn wifi() -> Result<WiFi> {
    os::wifi().await
}

/// The apps open in the Dock now (not background helpers), in the system's order.
pub async fn open_apps() -> Result<Vec<String>> {
    os::open_apps().await
}

/// The time now in an IANA time zone ("Asia/Tokyo"); an unknown zone is an error, never UTC.
pub async fn time_in_zone(zone: &str) -> Result<ZoneTime> {
    os::time_in_zone(zone).await
}

/// The names of the person's Shortcuts (the Shortcuts app), and running one by its exact name.
pub async fn shortcuts() -> Result<Vec<String>> {
    os::shortcuts().await
}

pub async fn run_shortcut(name: &str) -> Result<()> {
    os::run_shortcut(name).await
}

/// Dark mode on or off (the system appearance; reversible by the same call).
pub async fn set_dark_mode(on: bool) -> Result<()> {
    os::set_dark_mode(on).await
}

/// The output volume: a level 0-100, or muted / unmuted. Plays no sound.
pub async fn set_volume(volume: Volume) -> Result<()> {
    os::set_volume(volume).await
}

/// Keep the computer and display awake for `minutes` (1 to [`MAX_AWAKE_MINUTES`]), or stop with 0. Keeper owns the
/// one process that holds it awake: a new request replaces it, and it ends when Keeper quits.
pub fn keep_awake(minutes: u32) -> Result<()> {
    os::keep_awake(minutes)
}

/// Put the display to sleep now (it locks too when the person's settings ask for a password).
pub async fn display_sleep() -> Result<()> {
    os::display_sleep().await
}

/// Lock the screen now (the person signs back in to return).
pub async fn lock_screen() -> Result<()> {
    os::lock_screen().await
}

/// A silent picture of the whole screen, as PNG bytes (the caller saves it).
pub async fn screenshot() -> Result<Vec<u8>> {
    os::screenshot().await
}

/// A new note in the system's notes app with `title` and `body` (plain text).
/// Asks a Mac app to quit (the app may ask the person to save first). The caller checks the name.
pub async fn quit_app(name: &str) -> Result<()> {
    os::quit_app(name).await
}

pub async fn new_note(title: &str, body: &str) -> Result<()> {
    os::new_note(title, body).await
}
