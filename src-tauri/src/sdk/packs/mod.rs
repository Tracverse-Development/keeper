//! The packs of abilities, one per area. Each exports `ABILITIES`; `registry::PACKS` lists them.
//!
//!   reminders  remind (and the clock behind it: scheduling, repeats, snooze, what came due while closed)
//!   personal   the person's calendar and contacts
//!   desktop    open an app or a website
//!   core       the keeper itself: its memory, what it has done, which mind it thinks with

pub mod core;
pub mod desktop;
pub mod personal;
pub mod reminders;
