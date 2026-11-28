//! The packs of abilities, one per area. Each exports `ABILITIES`; `registry::PACKS` lists them.
//!
//!   reminders  remind, list-reminders (and the clock behind it: scheduling, repeats, snooze, what came due while closed)
//!   calendar   upcoming (events and reminders for a day), and the heads-up watch before each event
//!   personal   the person's calendar and contacts
//!   desktop    open an app or a website
//!   files      draft a change to a text file (the person saves it), show a text file
//!   video      a YouTube video, or a video or song on this computer, played inside Keeper
//!   core       the keeper itself: its memory, what it has done, which mind it thinks with

pub mod calendar;
pub mod core;
pub mod desktop;
pub mod files;
pub mod personal;
pub mod reminders;
pub mod video;
