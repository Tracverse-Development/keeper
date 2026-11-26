//! Other systems until their port lands: everything answers "not supported yet".

use crate::kernel::{DeskError, Result};

pub const TARGET_TRIPLE: &str = "unsupported";

pub fn open_app(_: &str) -> Result<()> {
    Err(DeskError::Invalid("Opening apps is not supported on this system yet.".into()))
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
