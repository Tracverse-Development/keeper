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
pub fn computer_name() -> String {
    "Keeper".into()
}
