//! Other systems until their port lands: everything answers "not supported yet".

use crate::kernel::{DeskError, Result};

pub const TARGET_TRIPLE: &str = "unsupported";

pub fn open_app(_: &str) -> Result<()> {
    Err(DeskError::Invalid("Opening apps is not supported on this system yet.".into()))
}
pub async fn sqlite_quick_check(_: &std::path::Path) -> Option<(String, bool)> {
    None
}
pub async fn sqlite_recover(_: &std::path::Path, _: &std::path::Path) -> bool {
    false
}
pub fn app_installed(_: &str) -> bool {
    false
}
pub fn open_url(_: &str) -> Result<()> {
    Err(DeskError::Invalid("Opening pages is not supported on this system yet.".into()))
}
pub fn notify(_: &str, _: &str) {}
pub fn system_version() -> String {
    std::env::consts::OS.to_string()
}
pub fn computer_name() -> String {
    "Keeper".into()
}
pub fn reveal(_: &std::path::Path) {}
pub async fn clipboard_read() -> Result<String> {
    Err(DeskError::Invalid("Reading the clipboard is not supported on this system yet.".into()))
}
pub async fn clipboard_write(_: &str) -> Result<()> {
    Err(DeskError::Invalid("Writing the clipboard is not supported on this system yet.".into()))
}
pub async fn document_text(_: &std::path::Path) -> Result<String> {
    Err(DeskError::Invalid("Reading that kind of document is not supported on this system yet.".into()))
}
pub async fn spotlight(_: &str, _: &[std::path::PathBuf], _: usize, _: std::time::Duration) -> Result<Vec<std::path::PathBuf>> {
    Err(DeskError::Invalid("Searching files is not supported on this system yet.".into()))
}

pub fn open_in_terminal(_program: &std::path::Path, _path: &std::ffi::OsStr) -> Result<()> {
    Err(crate::kernel::DeskError::Invalid("Open a terminal and run `claude` to sign in.".into()))
}
pub fn signal_group(_: u32, _: super::GroupSignal) -> Result<()> {
    Err(DeskError::Invalid("Pausing work is not supported on this system yet.".into()))
}

pub fn open_path(_: &std::path::Path) -> Result<()> {
    not_yet("Opening files and folders")
}

// What a keeper looks at and changes on the computer (`platform::battery` and the rest).
fn not_yet<T>(what: &str) -> Result<T> {
    Err(DeskError::Invalid(format!("{what} is not supported on this system yet.")))
}
pub async fn battery() -> Result<Option<super::Battery>> {
    not_yet("Reading the battery")
}
pub async fn wifi() -> Result<super::WiFi> {
    not_yet("Reading Wi-Fi")
}
pub async fn open_apps() -> Result<Vec<String>> {
    not_yet("Listing open apps")
}
pub async fn time_in_zone(_: &str) -> Result<super::ZoneTime> {
    not_yet("The world clock")
}
pub async fn shortcuts() -> Result<Vec<String>> {
    not_yet("Shortcuts")
}
pub async fn run_shortcut(_: &str) -> Result<()> {
    not_yet("Shortcuts")
}
pub async fn set_dark_mode(_: bool) -> Result<()> {
    not_yet("Changing the appearance")
}
pub async fn set_volume(_: super::Volume) -> Result<()> {
    not_yet("Changing the volume")
}
pub fn keep_awake(_: u32) -> Result<()> {
    not_yet("Keeping the computer awake")
}
pub async fn display_sleep() -> Result<()> {
    not_yet("Sleeping the display")
}
pub async fn lock_screen() -> Result<()> {
    not_yet("Locking the screen")
}
pub async fn screenshot() -> Result<Vec<u8>> {
    not_yet("Taking a screenshot")
}
pub async fn quit_app(_: &str) -> Result<()> {
    not_yet("Quitting apps")
}
pub fn compose_mail(_: &str) -> Result<()> {
    Err(DeskError::Invalid("Opening an email is not supported on this system yet.".into()))
}
pub async fn unread_mail(_: usize) -> Result<(usize, Vec<super::Unread>)> {
    not_yet("Reading your inbox")
}
pub async fn new_note(_: &str, _: &str) -> Result<()> {
    not_yet("Making a note")
}
