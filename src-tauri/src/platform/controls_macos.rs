//! The Mac settings a keeper changes when the person asks in words: appearance, volume, staying
//! awake, the display, the lock, a screenshot, a new note, one of their Shortcuts. Each is small
//! and reversible. Scripts are fixed text built from checked values (a bool, a number 0-100);
//! the person's own words (a note) reach AppleScript only as `argv` items, never inside the
//! script, so nothing they type can become code. Pure builders below are unit-tested; the calls
//! themselves are not run in tests (they would change the Mac).

use std::process::{Child, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tokio::process::Command;

use super::macos::tool_output;
use super::status::{Volume, MAX_AWAKE_MINUTES};
use super::MusicDo;
use crate::kernel::{DeskError, Result};

const OSASCRIPT: &str = "/usr/bin/osascript";
const QUICK: Duration = Duration::from_secs(10);
/// A call that can make macOS ask the person for permission first (controlling another app,
/// recording the screen): long enough to read the question and answer it. With 10 s the call
/// ended while the dialog was still open, and macOS took that as a refusal (FIX-0043).
const MAY_ASK: Duration = Duration::from_secs(90);
/// A Shortcut may take a while (it can ask the person something); it is stopped after this.
const SHORTCUT_LIMIT: Duration = Duration::from_secs(120);

/// The one `caffeinate` Keeper started, if it is holding the Mac awake (ours to stop).
static AWAKE: Mutex<Option<Child>> = Mutex::new(None);

async fn applescript(script: &str, args: &[&str], failed: &str) -> Result<()> {
    tool_output(Command::new(OSASCRIPT).arg("-e").arg(script).args(args), MAY_ASK, failed).await.map(drop)
}

/// The appearance script: only `true` or `false` is ever written into it.
fn dark_mode_script(on: bool) -> String {
    format!("tell application \"System Events\" to tell appearance preferences to set dark mode to {on}")
}

pub async fn set_dark_mode(on: bool) -> Result<()> {
    applescript(&dark_mode_script(on), &[], "I couldn't change the appearance. Keeper may need permission to control System Events (System Settings, Privacy & Security, Automation).").await
}

/// The volume script: a level is clamped to 0-100 before it is written in.
fn volume_script(volume: Volume) -> String {
    match volume {
        Volume::Level(level) => format!("set volume output volume {}", level.min(100)),
        Volume::Mute => "set volume output muted true".into(),
        Volume::Unmute => "set volume output muted false".into(),
    }
}

pub async fn set_volume(volume: Volume) -> Result<()> {
    applescript(&volume_script(volume), &[], "I couldn't change the volume.").await
}

/// `caffeinate`: keep the display (-d) and the system (-i) awake for the time (-t, seconds), and
/// let go if Keeper itself goes away (-w, Keeper's process id).
fn keep_awake_args(minutes: u32, keeper_pid: u32) -> Vec<String> {
    let seconds = minutes.min(MAX_AWAKE_MINUTES) * 60;
    vec!["-d".into(), "-i".into(), "-t".into(), seconds.to_string(), "-w".into(), keeper_pid.to_string()]
}

pub fn keep_awake(minutes: u32) -> Result<()> {
    let mut held = AWAKE.lock().map_err(|_| DeskError::Io("I couldn't change how long the Mac stays awake.".into()))?;
    // Only ever the process Keeper started itself.
    if let Some(mut old) = held.take() {
        let _ = old.kill();
        let _ = old.wait();
    }
    if minutes == 0 {
        return Ok(());
    }
    let child = std::process::Command::new("/usr/bin/caffeinate").args(keep_awake_args(minutes, std::process::id())).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()?;
    *held = Some(child);
    Ok(())
}

pub async fn display_sleep() -> Result<()> {
    tool_output(Command::new("/usr/bin/pmset").arg("displaysleepnow"), QUICK, "I couldn't put the display to sleep.").await.map(drop)
}

/// Locks at once through the system's own login framework (the same call as the menu bar's Lock
/// Screen), from JavaScript for Automation; the script is fixed text.
const LOCK_SCRIPT: &str = "ObjC.import('Foundation'); $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/login.framework').load; ObjC.bindFunction('SACLockScreenImmediate', ['int', []]); $.SACLockScreenImmediate();";

pub async fn lock_screen() -> Result<()> {
    tool_output(Command::new(OSASCRIPT).args(["-l", "JavaScript", "-e", LOCK_SCRIPT]), MAY_ASK, "I couldn't lock the screen.").await.map(drop)
}

/// `screencapture -x` (silent: no shutter sound) of the whole screen into a private temporary
/// file, read back and removed.
pub async fn screenshot() -> Result<Vec<u8>> {
    let mut nonce = [0u8; 8];
    let _ = getrandom::getrandom(&mut nonce);
    let file = std::env::temp_dir().join(format!("keeper-screen-{}.png", hex::encode(nonce)));
    let failed = "I couldn't take a screenshot. Keeper may need Screen Recording permission (System Settings, Privacy & Security).";
    let taken = tool_output(Command::new("/usr/sbin/screencapture").args(["-x", "-t", "png"]).arg(&file), MAY_ASK, failed).await;
    let bytes = taken.ok().and_then(|_| std::fs::read(&file).ok());
    let _ = std::fs::remove_file(&file);
    bytes.filter(|b| !b.is_empty()).ok_or_else(|| DeskError::Io(failed.into()))
}

/// A note's body is HTML in Notes: the title as its heading, then the text, every character
/// that HTML reads (`& < > "`) escaped and line breaks kept.
fn note_html(title: &str, body: &str) -> String {
    let escape = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;");
    let lines: Vec<String> = body.lines().map(|l| format!("<div>{}</div>", if l.trim().is_empty() { "<br>".to_string() } else { escape(l) })).collect();
    format!("<h1>{}</h1>{}", escape(title), lines.concat())
}

/// The note arrives as `argv`, never inside the script.
const NOTE_SCRIPT: &str = "on run argv\ntell application \"Notes\" to make new note with properties {body:item 1 of argv}\nend run";

pub async fn new_note(title: &str, body: &str) -> Result<()> {
    applescript(NOTE_SCRIPT, &[&note_html(title, body)], "I couldn't make the note. Keeper may need permission to use Notes (System Settings, Privacy & Security, Automation).").await
}

const QUIT_SCRIPT: &str = "on run argv\ntell application (item 1 of argv) to quit\nend run";

/// Asks the app named `name` (checked by the caller) to quit; it may first ask to save.
pub async fn quit_app(name: &str) -> Result<()> {
    applescript(QUIT_SCRIPT, &[name], &format!("{name} didn't quit. It may be waiting for you in one of its own windows (unsaved work or a question); the first time, Keeper may also need permission to control it (System Settings, Privacy & Security, Automation).")).await
}

/// The Music script: one of four fixed commands, nothing else ever written into it.
fn music_script(what: MusicDo) -> &'static str {
    match what {
        MusicDo::Play => "tell application \"Music\" to play",
        MusicDo::Pause => "tell application \"Music\" to pause",
        MusicDo::Next => "tell application \"Music\" to next track",
        MusicDo::Previous => "tell application \"Music\" to previous track",
    }
}

pub async fn music(what: MusicDo) -> Result<()> {
    applescript(music_script(what), &[], "The Music app didn't answer. The first time, Keeper may need permission to control it (System Settings, Privacy & Security, Automation).").await
}

/// The song playing in Music now ("Song by Artist"), or None when nothing plays.
pub async fn music_now() -> Option<String> {
    let script = "tell application \"Music\"\nif it is running and player state is playing then\nreturn (name of current track) & \" by \" & (artist of current track)\nend if\nend tell\nreturn \"\"";
    tool_output(Command::new(OSASCRIPT).arg("-e").arg(script), QUICK, "").await.ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Moves a file or folder to the Trash through the Finder (so Put Back works). The path reaches
/// AppleScript only as `argv`.
const TRASH_SCRIPT: &str = "on run argv\ntell application \"Finder\" to delete (POSIX file (item 1 of argv) as alias)\nend run";

pub async fn move_to_trash(path: &std::path::Path) -> Result<()> {
    let shown = path.display().to_string();
    applescript(TRASH_SCRIPT, &[&shown], "The Finder didn't move that to the Trash. The first time, Keeper may need permission to control the Finder (System Settings, Privacy & Security, Automation).").await
}

pub async fn run_shortcut(name: &str) -> Result<()> {
    if name.starts_with('-') {
        return Err(DeskError::Invalid("That isn't the name of a Shortcut.".into()));
    }
    tool_output(Command::new("/usr/bin/shortcuts").args(["run", name]).stdin(Stdio::null()), SHORTCUT_LIMIT, &format!("The Shortcut {name} didn't finish.")).await.map(drop)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_scripts_hold_only_checked_values() {
        assert_eq!(dark_mode_script(true), "tell application \"System Events\" to tell appearance preferences to set dark mode to true");
        assert!(dark_mode_script(false).ends_with("to false"));
        assert_eq!(volume_script(Volume::Level(40)), "set volume output volume 40");
        assert_eq!(volume_script(Volume::Level(250)), "set volume output volume 100");
        assert_eq!(volume_script(Volume::Mute), "set volume output muted true");
        assert_eq!(volume_script(Volume::Unmute), "set volume output muted false");
    }

    #[test]
    fn staying_awake_is_bounded_and_tied_to_keeper() {
        assert_eq!(keep_awake_args(30, 4242), ["-d", "-i", "-t", "1800", "-w", "4242"]);
        assert_eq!(keep_awake_args(10_000, 1)[3], (MAX_AWAKE_MINUTES * 60).to_string());
    }

    #[test]
    fn a_note_is_text_not_markup_or_script() {
        assert_eq!(note_html("Shopping", "milk & eggs\n\n<b>bread</b>"), "<h1>Shopping</h1><div>milk &amp; eggs</div><div><br></div><div>&lt;b&gt;bread&lt;/b&gt;</div>");
        assert_eq!(note_html("\"quoted\" end tell", ""), "<h1>&quot;quoted&quot; end tell</h1>");
        // The person's words are never part of the script itself.
        assert!(NOTE_SCRIPT.starts_with("on run argv") && NOTE_SCRIPT.contains("{body:item 1 of argv}"));
    }
}
