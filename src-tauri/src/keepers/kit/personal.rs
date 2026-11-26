//! Personal items: a pendant or a T-shirt print with the person's own picture. The picture is
//! personal data, so it stays on this computer: a private file in Keeper's own folder (0600),
//! never in a pack, never on the DKG, never sent anywhere. Each keeper may have one per kind,
//! unlocked by level (`levels::UNLOCKS`: photo-pendant at 5, photo-shirt at 8). Removing a
//! picture deletes the file. Only PNG and JPEG pictures up to `MAX_BYTES` are taken.

use base64::Engine;
use serde::Serialize;

use crate::kernel::{paths, DeskError, Result};

pub const MAX_BYTES: usize = 4 * 1024 * 1024;

/// The kinds of personal item and the unlock each needs.
pub const KINDS: &[(&str, &str)] = &[("pendant", "photo-pendant"), ("shirt", "photo-shirt")];

/// "png" or "jpg" from the file's first bytes (its real type, whatever its name says).
pub fn picture_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        Some("png")
    } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("jpg")
    } else {
        None
    }
}

fn valid_keeper_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// The unlock id a kind needs, or None for an unknown kind.
pub fn unlock_for(kind: &str) -> Option<&'static str> {
    KINDS.iter().find(|(k, _)| *k == kind).map(|(_, u)| *u)
}

fn folder() -> std::path::PathBuf {
    paths::app_home().join("personal")
}

fn file(keeper: &str, kind: &str, ext: &str) -> std::path::PathBuf {
    folder().join(format!("{keeper}-{kind}.{ext}"))
}

/// Keep `bytes` as `keeper`'s picture for `kind` (replacing any earlier one).
pub fn save(keeper: &str, kind: &str, bytes: &[u8]) -> Result<()> {
    if !valid_keeper_id(keeper) || unlock_for(kind).is_none() {
        return Err(DeskError::Invalid("That isn't a personal item.".into()));
    }
    if bytes.len() > MAX_BYTES {
        return Err(DeskError::Invalid("That picture is too big (4 MB at most).".into()));
    }
    let ext = picture_type(bytes).ok_or_else(|| DeskError::Invalid("Choose a PNG or JPEG picture.".into()))?;
    remove(keeper, kind)?;
    std::fs::create_dir_all(folder()).map_err(|e| DeskError::Io(e.to_string()))?;
    paths::write_private(&file(keeper, kind, ext), bytes).map_err(|e| DeskError::Io(e.to_string()))
}

/// Delete `keeper`'s picture for `kind` (nothing to delete is fine).
pub fn remove(keeper: &str, kind: &str) -> Result<()> {
    if !valid_keeper_id(keeper) || unlock_for(kind).is_none() {
        return Err(DeskError::Invalid("That isn't a personal item.".into()));
    }
    for ext in ["png", "jpg"] {
        let _ = std::fs::remove_file(file(keeper, kind, ext));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Picture {
    pub kind: &'static str,
    /// A data URL the window draws (the picture never leaves the computer).
    pub data_url: String,
}

/// `keeper`'s pictures, as data URLs for the character to draw.
pub fn list(keeper: &str) -> Vec<Picture> {
    if !valid_keeper_id(keeper) {
        return vec![];
    }
    KINDS
        .iter()
        .filter_map(|(kind, _)| {
            ["png", "jpg"].iter().find_map(|ext| {
                let bytes = std::fs::read(file(keeper, kind, ext)).ok()?;
                let mime = if *ext == "png" { "image/png" } else { "image/jpeg" };
                Some(Picture { kind, data_url: format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)) })
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_real_pictures_and_known_kinds() {
        assert_eq!(picture_type(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0]), Some("png"));
        assert_eq!(picture_type(&[0xff, 0xd8, 0xff, 0xe0]), Some("jpg"));
        assert_eq!(picture_type(b"<svg onload=alert(1)>"), None, "an SVG (or anything else) is refused");
        assert_eq!(unlock_for("pendant"), Some("photo-pendant"));
        assert!(unlock_for("tattoo").is_none());
        assert!(save("../x", "pendant", &[0xff, 0xd8, 0xff]).is_err(), "a keeper id can't reach outside the folder");
        assert!(save("k1", "pendant", b"not a picture").is_err());
    }
}
