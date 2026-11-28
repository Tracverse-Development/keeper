//! The packs of abilities, one per area. Each exports `ABILITIES`; `registry::PACKS` lists them.
//!
//!   reminders  remind (and the clock behind it: scheduling, repeats, snooze, what came due while closed)
//!   personal   the person's calendar and contacts
//!   desktop    open an app or a website
//!   core       the keeper itself: its memory, what it has done, which mind it thinks with
//!   computer   this computer: look (battery, Wi-Fi, disk, open apps, world time, Shortcuts),
//!              open (Finder, System Settings, Dictionary), change when asked (dark mode,
//!              volume, stay awake, display, lock, clipboard, screenshot, note, run a Shortcut)
//!   everyday   exact sums and unit conversions, every system, no network

pub mod computer;
pub mod core;
pub mod desktop;
pub mod everyday;
pub mod personal;
pub mod reminders;
