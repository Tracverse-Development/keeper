//! The kernel: shared infrastructure every module may use, owned by none of them.
//! Dependencies point one way: modules → kernel, never kernel → module.

pub mod error;
pub mod events;
pub mod paths;
pub mod programs;
pub mod secrets;
pub mod settings;
pub mod time;
pub mod usage;
pub mod slug;

pub use error::{DeskError, Result};
