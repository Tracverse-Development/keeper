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

/// The voices this key can use.
pub async fn voices() -> Result<Vec<ElevenVoice>> {
    let res = http().get(format!("{API}/voices")).header("xi-api-key", key()?).send().await.map_err(|e| DeskError::Io(format!("ElevenLabs: {e}")))?;
    if !res.status().is_success() {
        return Err(DeskError::Invalid(format!("ElevenLabs refused the key ({}).", res.status())));
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
    fn voice_ids_cannot_reach_into_the_url() {
        assert!(super::valid_voice_id("21m00Tcm4TlvDq8ikWAM"));
        assert!(!super::valid_voice_id("../voices"));
        assert!(!super::valid_voice_id("a?x=1"));
        assert!(!super::valid_voice_id(""));
    }
}
