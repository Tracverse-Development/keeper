//! Changing this computer when the person asks in words. Each change is small and reversible
//! (asking again undoes it), plays no sound, and touches nothing of theirs except what it names:
//! dark mode, the volume level, staying awake, the display, the lock, the clipboard, a new
//! screenshot in ~/Pictures/Keeper, a new note, running one of their own Shortcuts.

use super::super::super::{input, Ability, Access, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};
use crate::platform::{self, Volume, MAX_AWAKE_MINUTES};
use crate::stage::Panel;

/// The longest text put on the clipboard or into a note.
const MAX_TEXT: usize = 20_000;

pub const ABILITIES: &[Ability] = &[
    Ability { id: "dark-mode", how: "{\"on\": true} turns dark mode on (false turns it off)", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(dark_mode(input)) },
    Ability { id: "set-volume", how: "{\"level\": 40} sets the volume from 0 to 100, or {\"mute\": true} mutes ({\"mute\": false} unmutes); plays no sound", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(set_volume(input)) },
    Ability { id: "keep-awake", how: "{\"minutes\": 60} keeps the Mac and its display awake for up to 480 minutes; {\"minutes\": 0} lets it sleep again", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(async move { keep_awake(input) }) },
    Ability { id: "screen-off", how: "{} puts the display to sleep now", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |_, _| Box::pin(screen_off()) },
    Ability { id: "lock-screen", how: "{} locks the screen now", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |_, _| Box::pin(lock_screen()) },
    Ability { id: "copy-text", how: "{\"text\": \"hello\"} puts text on the clipboard", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(copy_text(input)) },
    Ability { id: "screenshot", how: "{} takes a silent screenshot of the whole screen into Pictures/Keeper and shows it", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |_, _| Box::pin(screenshot()) },
    Ability { id: "new-note", how: "{\"title\": \"Shopping\", \"text\": \"milk, eggs\"} makes a new note in Apple Notes (title optional: the first line is used)", access: Access::Change, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(new_note(input)) },
    Ability { id: "run-shortcut", how: "{\"name\": \"Morning routine\"} runs one of the person's Shortcuts by its exact name (list-shortcuts shows them)", access: Access::Change, platforms: MAC, modes: &[], instant: Instant::No, run: |input, _| Box::pin(run_shortcut(input)) },
];

async fn dark_mode(input: &serde_json::Value) -> Result<Done> {
    let on = input::switch(input, "on")?;
    platform::set_dark_mode(on).await?;
    Ok(Done::said(if on { "Dark mode is on." } else { "Dark mode is off." }))
}

/// What the person asked for: muting wins when both are given.
fn volume_asked(input: &serde_json::Value) -> Result<Volume> {
    if input.get("mute").is_some() {
        return Ok(if input::switch(input, "mute")? { Volume::Mute } else { Volume::Unmute });
    }
    Ok(Volume::Level(input::number(input, "level", 0, 100)? as u8))
}

async fn set_volume(input: &serde_json::Value) -> Result<Done> {
    let volume = volume_asked(input)?;
    platform::set_volume(volume).await?;
    Ok(Done::said(match volume {
        Volume::Mute => "Muted.".to_string(),
        Volume::Unmute => "Sound is back on.".to_string(),
        Volume::Level(level) => format!("The volume is at {level}%."),
    }))
}

fn keep_awake(input: &serde_json::Value) -> Result<Done> {
    let minutes = input::number(input, "minutes", 0, i64::from(MAX_AWAKE_MINUTES))? as u32;
    platform::keep_awake(minutes)?;
    Ok(Done::said(match minutes {
        0 => "Your Mac can sleep again whenever it likes.".to_string(),
        m => format!("I'll keep your Mac awake for {}.", super::duration_words(m)),
    }))
}

async fn screen_off() -> Result<Done> {
    platform::display_sleep().await?;
    Ok(Done::said("The display is asleep. Move the mouse or press a key to wake it."))
}

async fn lock_screen() -> Result<Done> {
    platform::lock_screen().await?;
    Ok(Done::said("Locked. Sign back in to come back."))
}

/// A required text field no longer than [`MAX_TEXT`].
fn bounded_text<'a>(input: &'a serde_json::Value, key: &str) -> Result<&'a str> {
    let text = input::text(input, key)?;
    if text.chars().count() > MAX_TEXT {
        return Err(DeskError::Invalid(format!("That's too long: I take up to {MAX_TEXT} characters.")));
    }
    Ok(text)
}

async fn copy_text(input: &serde_json::Value) -> Result<Done> {
    platform::clipboard_write(bounded_text(input, "text")?).await?;
    Ok(Done::said("It's on your clipboard."))
}

async fn screenshot() -> Result<Done> {
    let png = platform::screenshot().await?;
    let stem = format!("Screenshot-{}", chrono::Local::now().format("%Y-%m-%d-%H%M%S"));
    let path = platform::save_png(&stem, &png)?;
    let panel = Panel::File { id: "screenshot".into(), title: "Screenshot".into(), path: path.display().to_string(), note: None };
    Ok(Done::said(format!("Took a screenshot and saved it in Pictures/{}.", platform::PICTURES_FOLDER)).showing(panel))
}

/// The note's title and body: the title given, or the text's first line (at most 80 characters)
/// with the rest as the body.
fn note_parts(title: Option<&str>, text: &str) -> (String, String) {
    if let Some(title) = title {
        return (title.chars().take(200).collect(), text.to_string());
    }
    let (first, rest) = text.split_once('\n').unwrap_or((text, ""));
    let first = first.trim();
    if first.chars().count() <= 80 {
        (first.to_string(), rest.trim_start_matches('\n').to_string())
    } else {
        (first.chars().take(60).collect::<String>().trim_end().to_string() + "…", text.to_string())
    }
}

async fn new_note(input: &serde_json::Value) -> Result<Done> {
    let (title, body) = note_parts(input::optional(input, "title"), bounded_text(input, "text")?);
    platform::new_note(&title, &body).await?;
    Ok(Done::said(format!("Made a note called \"{title}\" in Notes.")))
}

/// The Shortcut the person named, as the Shortcuts app spells it: a plain name (never a path
/// or a flag) that matches one of theirs, ignoring case.
fn shortcut_named(said: &str, theirs: &[String]) -> Result<String> {
    if !input::is_plain_name(said, 100) {
        return Err(DeskError::Invalid("That isn't the name of a Shortcut.".into()));
    }
    theirs.iter().find(|s| s.to_lowercase() == said.to_lowercase()).cloned().ok_or_else(|| DeskError::Invalid(format!("You don't have a Shortcut called {said}.")))
}

async fn run_shortcut(input: &serde_json::Value) -> Result<Done> {
    let name = shortcut_named(input::text(input, "name")?, &platform::shortcuts().await?)?;
    platform::run_shortcut(&name).await?;
    Ok(Done::said(format!("Ran your Shortcut {name}.")))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn the_volume_is_a_level_from_0_to_100_or_mute() {
        assert_eq!(volume_asked(&json!({ "level": 40 })).unwrap(), Volume::Level(40));
        assert_eq!(volume_asked(&json!({ "level": "0" })).unwrap(), Volume::Level(0));
        assert_eq!(volume_asked(&json!({ "mute": true, "level": 50 })).unwrap(), Volume::Mute);
        assert_eq!(volume_asked(&json!({ "mute": "off" })).unwrap(), Volume::Unmute);
        for bad in [json!({ "level": 101 }), json!({ "level": -1 }), json!({ "level": "loud" }), json!({})] {
            assert!(volume_asked(&bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn staying_awake_takes_0_to_480_minutes() {
        // Out-of-range values are refused before any process is started.
        for bad in [json!({ "minutes": 481 }), json!({ "minutes": -5 }), json!({ "minutes": "ages" }), json!({})] {
            assert_eq!(keep_awake(&bad).unwrap_err().to_string(), "The minutes needs to be a number from 0 to 480.", "{bad}");
        }
    }

    #[test]
    fn shortcut_names_are_theirs_and_never_paths_or_flags() {
        let theirs = vec!["Morning Routine".to_string(), "Log water".to_string()];
        assert_eq!(shortcut_named("morning routine", &theirs).unwrap(), "Morning Routine");
        assert!(shortcut_named("Unknown", &theirs).unwrap_err().to_string().contains("don't have"));
        for bad in ["-i", "--input-path /etc/passwd", "../Log water", "/tmp/x.shortcut"] {
            assert_eq!(shortcut_named(bad, &theirs).unwrap_err().to_string(), "That isn't the name of a Shortcut.", "{bad}");
        }
    }

    #[test]
    fn a_note_takes_its_title_from_the_first_line() {
        assert_eq!(note_parts(None, "Shopping\nmilk\neggs"), ("Shopping".into(), "milk\neggs".into()));
        assert_eq!(note_parts(Some("Ideas"), "one\ntwo"), ("Ideas".into(), "one\ntwo".into()));
        let long = "word ".repeat(30);
        let (title, body) = note_parts(None, &long);
        assert!(title.ends_with('…') && title.chars().count() <= 61 && body == long);
        assert!(bounded_text(&json!({ "text": "x".repeat(MAX_TEXT + 1) }), "text").is_err());
    }
}
