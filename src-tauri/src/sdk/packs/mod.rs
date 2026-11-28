//! The packs of abilities, one per area. Each exports `ABILITIES`; `registry::PACKS` lists them.
//! An ability's whole phrasings (`Instant`) live beside it, in its pack (a `words` file where
//! there are several), never in a mind: the built-in mind has no copies (FIX-0053).
//!
//!   reminders  remind, list-reminders, snooze (and the clock behind it: scheduling, repeats, what came due while closed)
//!   calendar   upcoming (events and reminders for a day), and the heads-up watch before each event
//!   day        the morning brief, recent work, the week in review, focus sessions (instant-only)
//!   personal   the person's calendar and contacts
//!   desktop    open an app or a website ("open Notes", "go to bbc.co.uk": `words`)
//!   files      draft a change to a text file (the person saves it), show a text file; `find`:
//!              find my files, show or open a known folder (instant-only)
//!   video      a YouTube video, or a video or song on this computer, played inside Keeper
//!   core       the keeper itself: its memory, what it has done, which mind it thinks with, whether
//!              everything is working (`health`), what it knows about the person and what is out
//!              of date (instant-only)
//!   computer   this computer: look (battery, Wi-Fi, disk, open apps, world time, Shortcuts),
//!              open (Finder, System Settings, Dictionary), change when asked (dark mode,
//!              volume, stay awake, display, lock, clipboard, screenshot, note, run a Shortcut)
//!   everyday   exact sums and unit conversions, every system, no network
//!   routines   save, list and forget routines by name (instant-only); "run my …" is expanded
//!   clipboard  work on what was copied in any app, at the Mac only (instant-only)

pub mod calendar;
pub mod clipboard;
pub mod computer;
pub mod core;
pub mod day;
pub mod desktop;
pub mod everyday;
pub mod files;
pub mod personal;
pub mod reminders;
pub mod routines;
pub mod video;
