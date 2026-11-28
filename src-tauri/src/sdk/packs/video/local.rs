//! Videos and songs on this computer, played inside Keeper (`play-file`), and the person's own
//! movies listed to play (`find-movies`). Which files may play is decided once, in
//! `stage::local_media` (the person's media folders, video and audio formats the player plays);
//! the list comes from `pim::files_of_type` (Spotlight, or a bounded walk).

use std::path::{Path, PathBuf};

use super::super::super::{input, Cx, Done};
use crate::kernel::{DeskError, Result};
use crate::stage::local_media::{self, FOLDERS};
use crate::stage::panel::MediaChoice;
use crate::stage::Panel;

/// The most movies one list shows (the first plays, the rest are buttons).
const MAX_MOVIES: usize = 8;

/// The words for where files may be played from ("Movies, Downloads, Desktop, Documents or Music").
fn folder_words() -> String {
    let (last, rest) = FOLDERS.split_last().unwrap_or((&"", &[]));
    format!("{} or {last}", rest.join(", "))
}

/// A file's name without its folder, for the person's eyes ("Holiday 2025.mp4").
fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

/// The folder a file sits in, said from the home folder ("In Movies/Trips").
fn where_it_is(path: &Path) -> Option<String> {
    let home = dirs::home_dir()?.canonicalize().ok()?;
    let folder = path.parent()?.strip_prefix(&home).ok()?;
    Some(format!("In {}", folder.display()))
}

/// The media panel that plays one file, titled `title` (nothing plays until the person presses Play).
pub fn file_panel(title: &str, real: &Path, choices: Vec<MediaChoice>) -> Option<Panel> {
    crate::stage::checked(Panel::Media {
        id: "media-file".into(),
        title: title.into(),
        url: String::new(),
        caption: None,
        path: Some(real.display().to_string()),
        // Where it came from, as a video's channel would be.
        channel: where_it_is(real),
        length: None,
        choices,
    })
}

/// The file `path` names, when Keeper may play it; otherwise the sentence that says why not.
pub fn checked_file(path: &str) -> Result<PathBuf> {
    if !local_media::is_media(Path::new(path.trim())) {
        return Err(DeskError::Invalid("I can play video and audio files (MP4, MOV, M4V, WebM, MP3, M4A, WAV, AIFF, FLAC), and that isn't one.".into()));
    }
    local_media::playable(path).ok_or_else(|| DeskError::Invalid(format!("I couldn't find that file in your {} folders.", folder_words())))
}

pub async fn play_file(input: &serde_json::Value, _cx: &Cx<'_>) -> Result<Done> {
    let real = checked_file(input::text(input, "path")?)?;
    let panel = file_panel(&file_name(&real), &real, Vec::new()).ok_or_else(|| DeskError::Invalid("I can't show that file.".into()))?;
    Ok(Done::said(format!("Here's {}. Press Play when you're ready.", file_name(&real))).showing(panel))
}

pub async fn find_movies(input: &serde_json::Value, _cx: &Cx<'_>) -> Result<Done> {
    let name = input::optional(input, "name");
    let home = dirs::home_dir().ok_or_else(|| DeskError::Io("I couldn't find your home folder.".into()))?;
    // Movies are looked for where people keep them; songs (Music) are for play-file by name.
    let folders: Vec<PathBuf> = FOLDERS.iter().filter(|f| **f != "Music").map(|f| home.join(f)).collect();
    let hits = crate::pim::files_of_type("public.movie", name, &folders, local_media::is_video, MAX_MOVIES).await?;
    let playable: Vec<PathBuf> = hits.iter().filter_map(|h| local_media::playable(&h.path)).collect();
    let Some((first, rest)) = playable.split_first() else {
        let what = name.map(|n| format!("videos called {n}")).unwrap_or_else(|| "videos I can play".into());
        return Ok(Done::said(format!("I didn't find any {what} in your {} folders.", folder_words())));
    };
    let choices = rest.iter().map(|p| MediaChoice { title: file_name(p), url: String::new(), path: Some(p.display().to_string()), channel: where_it_is(p), length: None }).collect();
    let title = name.map(|n| format!("Videos called {n}")).unwrap_or_else(|| "Videos on this Mac".into());
    let panel = file_panel(&title, first, choices).ok_or_else(|| DeskError::Invalid("I can't show those files.".into()))?;
    let count = playable.len();
    let said = if count == 1 { format!("I found one: {}. Press Play when you're ready.", file_name(first)) } else { format!("I found {count} videos; the newest is first. Press Play, or pick another.") };
    Ok(Done::said(said).showing(panel))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_media_in_the_media_folders_may_play() {
        assert!(checked_file("~/Documents/notes.txt").unwrap_err().to_string().starts_with("I can play video and audio files"));
        assert!(checked_file("/etc/hosts").unwrap_err().to_string().starts_with("I can play"));
        let missing = checked_file("~/Movies/definitely-not-here-123.mp4").unwrap_err().to_string();
        assert_eq!(missing, "I couldn't find that file in your Movies, Downloads, Desktop, Documents or Music folders.");
        assert!(checked_file("/Library/Sounds/x.mp3").is_err(), "outside the home");
    }

    #[test]
    fn a_file_panel_plays_the_path_and_names_the_file() {
        let Some(Panel::Media { title, url, path, choices, .. }) = file_panel("Trip 2025.mp4", Path::new("/Users/ada/Movies/Trip 2025.mp4"), Vec::new()) else { panic!("a media panel") };
        assert_eq!(title, "Trip 2025.mp4");
        assert!(url.is_empty());
        assert_eq!(path.as_deref(), Some("/Users/ada/Movies/Trip 2025.mp4"));
        assert!(choices.is_empty());
    }
}
