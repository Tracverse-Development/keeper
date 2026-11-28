//! What a file looks like in Keeper's viewer. Read here, on this computer; a picture or document
//! picture travels to the window as a `data:` address (the window's content policy allows those
//! for pictures only), a video or song plays through `keeper-media:` (its own checks), and a
//! text file opens as a draft (`sdk::drafts`), so it is changed only by the person's Save.

use std::path::Path;

use base64::Engine;
use serde::Serialize;

use crate::kernel::Result;

/// The biggest picture sent to the window whole.
const MAX_PICTURE_BYTES: u64 = 20 * 1024 * 1024;
/// The most of a document's words shown under its picture.
const MAX_WORDS: usize = 6_000;
/// Quick Look picture width (pixels).
const LOOK_SIZE: u32 = 1400;

const PICTURES: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
/// Pictures WebKit cannot draw itself: shown through Quick Look.
const OTHER_PICTURES: [&str; 4] = ["heic", "heif", "tiff", "tif"];
const DOCUMENTS: [&str; 12] = ["pdf", "doc", "docx", "rtf", "rtfd", "odt", "pages", "key", "numbers", "xlsx", "pptx", "html"];

/// A file, as the viewer shows it.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Preview {
    Picture { name: String, path: String, src: String },
    /// A video or song the window's player plays (`localMediaSrc(path)`).
    Media { name: String, path: String, video: bool },
    /// A text file: its words, and whether Keeper can edit it (`files_edit`).
    Text { name: String, path: String, text: String, editable: bool },
    /// A document: its first page as Quick Look draws it, and its words where they can be read.
    Document { name: String, path: String, src: Option<String>, text: Option<String> },
    /// Anything else: what it is and how big.
    Other { name: String, path: String, size: u64 },
}

fn extension(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).unwrap_or_default()
}

fn data_address(kind: &str, bytes: &[u8]) -> String {
    format!("data:{kind};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))
}

fn picture_kind(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    }
}

/// What `path` (already checked by `super::place`) looks like.
pub async fn preview(app: &tauri::AppHandle, path: &Path) -> Result<Preview> {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let shown = path.display().to_string();
    let ext = extension(path);
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if PICTURES.contains(&ext.as_str()) && size <= MAX_PICTURE_BYTES {
        let bytes = std::fs::read(path).map_err(|_| crate::kernel::DeskError::Invalid("I couldn't open that picture.".into()))?;
        return Ok(Preview::Picture { name, path: shown, src: data_address(picture_kind(&ext), &bytes) });
    }
    if crate::stage::local_media::playable(&shown).is_some() {
        return Ok(Preview::Media { name, path: shown, video: crate::stage::local_media::is_video(path) });
    }
    // Text only when it really reads as text (a PDF passes the place rules but is not text).
    let text = crate::sdk::drafts::place::editable(&shown).and_then(|real| crate::sdk::drafts::place::read_text(&real));
    if let (Ok(text), false) = (text, DOCUMENTS.contains(&ext.as_str())) {
        return Ok(Preview::Text { name, path: shown, text, editable: true });
    }
    if OTHER_PICTURES.contains(&ext.as_str()) || DOCUMENTS.contains(&ext.as_str()) {
        let src = crate::platform::quick_look_png(path, LOOK_SIZE).await.ok().map(|png| data_address("image/png", &png));
        let text = if DOCUMENTS.contains(&ext.as_str()) {
            let read = crate::assistant::attach::read(&crate::assistant::attach::AttachInput { path: Some(shown.clone()), text: None }, Some(app)).await;
            read.ok().map(|a| a.text.chars().take(MAX_WORDS).collect::<String>()).filter(|t| !t.trim().is_empty())
        } else {
            None
        };
        if OTHER_PICTURES.contains(&ext.as_str()) {
            if let Some(src) = src {
                return Ok(Preview::Picture { name, path: shown, src });
            }
        }
        return Ok(Preview::Document { name, path: shown, src, text });
    }
    Ok(Preview::Other { name, path: shown, size })
}

#[cfg(test)]
mod tests {
    #[test]
    fn pictures_travel_as_data_addresses_of_their_kind() {
        assert_eq!(super::data_address("image/png", b"ab"), "data:image/png;base64,YWI=");
        assert_eq!(super::picture_kind("jpg"), "image/jpeg");
        assert_eq!(super::picture_kind("webp"), "image/webp");
    }
}
