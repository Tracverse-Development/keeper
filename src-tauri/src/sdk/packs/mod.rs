//! The packs of abilities, one per area. Each exports `ABILITIES`; `registry::PACKS` lists them.
//!
//!   reminders  remind, list-reminders (and the clock behind it: scheduling, repeats, snooze, what came due while closed)
//!   calendar   upcoming (events and reminders for a day), and the heads-up watch before each event
//!   personal   the person's calendar and contacts
//!   desktop    open an app or a website
//!   files      draft a change to a text file (the person saves it), show a text file
//!   video      a YouTube video, or a video or song on this computer, played inside Keeper
//!   core       the keeper itself: its memory, what it has done, which mind it thinks with
//!   computer   this computer: look (battery, Wi-Fi, disk, open apps, world time, Shortcuts),
//!              open (Finder, System Settings, Dictionary), change when asked (dark mode,
//!              volume, stay awake, display, lock, clipboard, screenshot, note, run a Shortcut)
//!   everyday   exact sums and unit conversions, every system, no network

pub mod calendar;
pub mod computer;
pub mod core;
pub mod day;
pub mod desktop;
pub mod everyday;
pub mod files;
pub mod personal;
pub mod reminders;
pub mod video;
