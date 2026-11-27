//! Photo mode's save: a still of a keeper the Studio drew (a keeper card, or a full portrait)
//! written to `~/Pictures/Keeper/<keeper-name>-<date-time>.png` on this Mac and nowhere else.
//! Nothing is uploaded or shared; the window only hands over the PNG's bytes.
//!
//! The window is not trusted with the file: the bytes must be a PNG (signature and header
//! checked, size capped, its pixel size sane) and the file NAME is made here, from the keeper's
//! saved name and the clock, never from anything the window sends. The folder and the
//! never-overwrite rule are the OS seam's (`platform::pictures`).

use chrono::{DateTime, Local};
use serde::Serialize;
use tauri::State;

use crate::kernel::{DeskError, Result};
use crate::state::AppState;

/// The largest photo accepted, in bytes (a 2160 x 2700 portrait is a few MB).
pub const MAX_PHOTO_BYTES: usize = 32 * 1024 * 1024;
/// The largest photo side accepted, in pixels (the window draws at most 4096).
pub const MAX_PHOTO_SIDE: u32 = 8192;
const PNG_MAGIC: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
/// How much of the keeper's name goes into the file name.
const NAME_CHARS: usize = 32;

/// Where a photo went: the full path, and the part a person recognises (`Pictures/Keeper/<file>`).
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PhotoSaved {
    pub path: String,
    pub shown: String,
}

/// The photo's bytes when `data` (base64) is a PNG of a sane size; anything else is refused.
pub fn photo_bytes(data: &str) -> Result<Vec<u8>> {
    use base64::Engine;
    let refused = || DeskError::Invalid("That isn't a picture I can save.".into());
    if data.len() > MAX_PHOTO_BYTES / 3 * 4 + 8 {
        return Err(refused());
    }
    let bytes = base64::engine::general_purpose::STANDARD.decode(data.trim()).map_err(|_| refused())?;
    if bytes.len() > MAX_PHOTO_BYTES || !bytes.starts_with(&PNG_MAGIC) {
        return Err(refused());
    }
    // The first chunk of every PNG is IHDR (13 bytes): width and height, big-endian.
    let header = bytes.get(8..24).ok_or_else(refused)?;
    if header[0..4] != [0, 0, 0, 13] || &header[4..8] != b"IHDR" {
        return Err(refused());
    }
    let side = |b: &[u8]| u32::from_be_bytes([b[0], b[1], b[2], b[3]]);
    let (width, height) = (side(&header[8..12]), side(&header[12..16]));
    if width == 0 || height == 0 || width > MAX_PHOTO_SIDE || height > MAX_PHOTO_SIDE {
        return Err(refused());
    }
    Ok(bytes)
}

/// The file name (without `.png`): the keeper's name made safe (letters and digits of any
/// language, single dashes for anything else, at most `NAME_CHARS`; `Keeper` when nothing is
/// left), then the local date and time, `Malik-2026-11-27-143005`.
pub fn photo_stem(name: &str, at: DateTime<Local>) -> String {
    let mut clean = String::new();
    for c in name.chars() {
        if c.is_alphanumeric() {
            clean.push(c);
        } else if !clean.is_empty() && !clean.ends_with('-') {
            clean.push('-');
        }
        if clean.chars().count() >= NAME_CHARS {
            break;
        }
    }
    let clean = clean.trim_end_matches('-');
    let clean = if clean.is_empty() { "Keeper" } else { clean };
    format!("{clean}-{}", at.format("%Y-%m-%d-%H%M%S"))
}

/// `Pictures/Keeper/<file>`: how the Studio says where the photo went.
fn shown(path: &std::path::Path) -> String {
    let file = path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
    format!("Pictures/{}/{file}", crate::platform::PICTURES_FOLDER)
}

/// Save a photo of keeper `keeper` (its id) that the Studio drew: `data` is the PNG in base64.
#[tauri::command]
pub fn photo_save(state: State<'_, AppState>, keeper: String, data: String) -> Result<PhotoSaved> {
    let bytes = photo_bytes(&data)?;
    let profile = state.keeper_or_active(&keeper)?;
    let path = crate::platform::save_png(&photo_stem(&profile.name, Local::now()), &bytes)?;
    Ok(PhotoSaved { shown: shown(&path), path: path.display().to_string() })
}

#[cfg(test)]
mod tests {
    use base64::Engine;
    use chrono::TimeZone;

    use super::*;

    /// A PNG signature and an IHDR of `w` x `h`, then some bytes.
    fn png(w: u32, h: u32) -> Vec<u8> {
        let mut b = PNG_MAGIC.to_vec();
        b.extend([0, 0, 0, 13]);
        b.extend(b"IHDR");
        b.extend(w.to_be_bytes());
        b.extend(h.to_be_bytes());
        b.extend([8, 6, 0, 0, 0, 1, 2, 3, 4]);
        b
    }

    fn b64(bytes: &[u8]) -> String {
        base64::engine::general_purpose::STANDARD.encode(bytes)
    }

    #[test]
    fn only_a_real_png_of_a_sane_size_is_accepted() {
        assert!(photo_bytes(&b64(&png(2160, 2700))).is_ok());
        assert!(photo_bytes(&b64(b"#!/bin/sh\necho hi")).is_err(), "not a PNG");
        assert!(photo_bytes(&b64(&PNG_MAGIC)).is_err(), "a signature alone");
        let mut no_header = png(10, 10);
        no_header[12..16].copy_from_slice(b"IDAT");
        assert!(photo_bytes(&b64(&no_header)).is_err(), "first chunk not IHDR");
        assert!(photo_bytes(&b64(&png(0, 10))).is_err(), "no width");
        assert!(photo_bytes(&b64(&png(MAX_PHOTO_SIDE + 1, 10))).is_err(), "too wide");
        assert!(photo_bytes("not base64 !!").is_err());
        assert!(photo_bytes("").is_err());
    }

    #[test]
    fn an_oversized_photo_is_refused_before_it_is_decoded() {
        let mut big = png(100, 100);
        big.resize(MAX_PHOTO_BYTES + 1, 0);
        assert!(photo_bytes(&b64(&big)).is_err());
        let mut fits = png(100, 100);
        fits.resize(MAX_PHOTO_BYTES - 16, 0);
        assert!(photo_bytes(&b64(&fits)).is_ok(), "just under the cap is kept");
    }

    #[test]
    fn the_file_name_is_safe_whatever_the_keeper_is_called() {
        let at = Local.with_ymd_and_hms(2026, 11, 27, 14, 30, 5).unwrap();
        assert_eq!(photo_stem("Malik", at), "Malik-2026-11-27-143005");
        assert_eq!(photo_stem("Trini Boi", at), "Trini-Boi-2026-11-27-143005");
        assert_eq!(photo_stem("../../etc/passwd", at), "etc-passwd-2026-11-27-143005");
        assert_eq!(photo_stem("  ..//\\  ", at), "Keeper-2026-11-27-143005");
        assert_eq!(photo_stem("", at), "Keeper-2026-11-27-143005");
        assert_eq!(photo_stem("Zoë 🐶 Ñandú", at), "Zoë-Ñandú-2026-11-27-143005");
        assert_eq!(photo_stem("a\u{202e}gnp.exe", at), "a-gnp-exe-2026-11-27-143005", "no direction tricks, no dots");
        let long = photo_stem(&"x".repeat(500), at);
        assert_eq!(long, format!("{}-2026-11-27-143005", "x".repeat(NAME_CHARS)));
        for stem in [photo_stem("../../etc/passwd", at), photo_stem(".hidden", at), photo_stem("C:\\Windows", at)] {
            assert!(!stem.contains(['/', '\\', '.', '\0']) && !stem.starts_with('-'), "{stem}");
        }
    }

    #[test]
    fn says_where_it_went_in_words_a_person_knows() {
        assert_eq!(shown(std::path::Path::new("/Users/ada/Pictures/Keeper/Malik-2026-11-27-143005-2.png")), "Pictures/Keeper/Malik-2026-11-27-143005-2.png");
    }
}
