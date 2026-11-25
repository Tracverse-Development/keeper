//! ElevenLabs text to speech. The reply text goes to ElevenLabs (the window says so before the
//! person turns it on); the audio comes back as MP3 and the voice helper plays it on this Mac.
//! Only api.elevenlabs.io is ever called, and the key is read from the Keychain per call.

use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;
use serde_json::json;

use crate::kernel::{paths, DeskError, Result};
use crate::platform;

const API: &str = "https://api.elevenlabs.io/v1";
/// The Keychain item name for the key.
pub const KEY_NAME: &str = "elevenlabs-api-key";
/// Fast, natural, multilingual; low latency suits a conversation.
const MODEL: &str = "eleven_flash_v2_5";

#[derive(Debug, Clone, Serialize)]
pub struct ElevenVoice {
    pub id: String,
    pub name: String,
}

fn key() -> Result<String> {
    platform::secret_get(KEY_NAME).ok_or_else(|| DeskError::Invalid("Add your ElevenLabs key in Settings first.".into()))
}

fn http() -> reqwest::Client {
    reqwest::Client::builder().timeout(Duration::from_secs(30)).build().unwrap_or_default()
}

/// Voice ids are short letter-and-digit strings; anything else never reaches a URL.
pub fn valid_voice_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// ElevenLabs' stock voices, offered when a key may speak but not list voices (a key created
/// with text-to-speech permission only answers `missing_permissions` on /voices).
const STOCK: &[(&str, &str)] = &[
    ("21m00Tcm4TlvDq8ikWAM", "Rachel (calm, American)"),
    ("JBFqnCBsd6RMkjVDRZzb", "George (warm, British)"),
    ("nPczCjzI2devNBz1zQrb", "Brian (deep, American)"),
    ("onwK4e9ZLuTAKqWW03F9", "Daniel (British, news)"),
    ("XB0fDUnXU5powFXDhCwa", "Charlotte (Swedish-English)"),
    ("pFZP5JQG7iQjIQuC4Bku", "Lily (British, warm)"),
    ("EXAVITQu4vr4xnSDxMaL", "Sarah (soft, American)"),
    ("pNInz6obpgDQGcFmaJgB", "Adam (deep, American)"),
    ("TxGEqnHWrfWFTfGW9XjX", "Josh (young, American)"),
    ("ErXwobaYiN019PkySvjV", "Antoni (well-rounded)"),
];

fn stock() -> Vec<ElevenVoice> {
    STOCK.iter().map(|(id, name)| ElevenVoice { id: id.to_string(), name: name.to_string() }).collect()
}

/// The voices this key can use (the stock voices when the key may not list its own).
pub async fn voices() -> Result<Vec<ElevenVoice>> {
    let res = http().get(format!("{API}/voices")).header("xi-api-key", key()?).send().await.map_err(|e| DeskError::Io(format!("ElevenLabs: {e}")))?;
    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        if body.contains("missing_permissions") {
            return Ok(stock());
        }
        return Err(DeskError::Invalid("ElevenLabs refused the key.".into()));
    }
    let v: serde_json::Value = res.json().await.map_err(|e| DeskError::Io(e.to_string()))?;
    Ok(v["voices"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|x| Some(ElevenVoice { id: x["voice_id"].as_str()?.to_string(), name: x["name"].as_str()?.to_string() }))
        .collect())
}

/// Speak `text` with `voice_id` into an MP3 file (overwritten each time) and return its path.
pub async fn render(text: &str, voice_id: &str) -> Result<PathBuf> {
    if !valid_voice_id(voice_id) {
        return Err(DeskError::Invalid("Choose an ElevenLabs voice in Settings.".into()));
    }
    let res = http()
        .post(format!("{API}/text-to-speech/{voice_id}?output_format=mp3_44100_128"))
        .header("xi-api-key", key()?)
        .json(&json!({ "text": text, "model_id": MODEL }))
        .send()
        .await
        .map_err(|e| DeskError::Io(format!("ElevenLabs: {e}")))?;
    if !res.status().is_success() {
        return Err(DeskError::Io(format!("ElevenLabs answered {}", res.status())));
    }
    let bytes = res.bytes().await.map_err(|e| DeskError::Io(e.to_string()))?;
    let path = paths::app_home().join("speech.mp3");
    paths::write_private(&path, &bytes)?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    #[test]
    fn stock_voices_are_valid_ids() {
        assert!(super::stock().iter().all(|v| super::valid_voice_id(&v.id)));
    }

    #[test]
    fn voice_ids_cannot_reach_into_the_url() {
        assert!(super::valid_voice_id("21m00Tcm4TlvDq8ikWAM"));
        assert!(!super::valid_voice_id("../voices"));
        assert!(!super::valid_voice_id("a?x=1"));
        assert!(!super::valid_voice_id(""));
    }
}
