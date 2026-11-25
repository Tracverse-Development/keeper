//! The person's choices, kept in one small JSON file (0600). Nothing personal is stored here:
//! what the assistant learns about the person lives on the DKG node. Secrets (the ElevenLabs
//! key) live in the system keychain (`platform::secret_*`), never in this file.

use serde::{Deserialize, Serialize};

use super::paths;

/// Which voice speaks the replies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VoiceEngine {
    /// The Mac's own voices (on the device).
    System,
    /// ElevenLabs (reply text is sent to ElevenLabs to be spoken).
    Elevenlabs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub setup_complete: bool,
    /// The assistant's name as the person calls it (also its wake word).
    pub assistant_name: String,
    /// The Context Graph that holds this person's memory (exact id, DKG reference §2).
    pub graph_id: String,
    /// The DKG node's home folder (holds `api.port` and `auth.token`).
    pub node_home: String,
    /// The engine that thinks: an id from `brain::engines::CATALOGUE` ("claude", "codex", "reflex", …).
    pub brain: String,
    /// Ollama model tag when `brain` is "ollama".
    pub ollama_model: String,
    /// May an agent engine act on this computer (run commands, edit files)? Off until the person says so.
    pub agent_actions: bool,
    /// macOS voice name for the system voice.
    pub voice: String,
    pub voice_engine: VoiceEngine,
    /// The ElevenLabs voice id when `voice_engine` is ElevenLabs.
    pub eleven_voice_id: String,
    /// Listen all the time for the wake word (off until the person turns it on).
    pub always_listening: bool,
    /// The character's look: an id from the window's skin registry ("robot", "puppy").
    pub skin: String,
    /// Install updates by itself (checked at launch and every few hours).
    pub auto_update: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            setup_complete: false,
            assistant_name: "Umoja".into(),
            graph_id: String::new(),
            node_home: String::new(),
            brain: "reflex".into(),
            ollama_model: String::new(),
            agent_actions: false,
            voice: "Samantha".into(),
            voice_engine: VoiceEngine::System,
            eleven_voice_id: String::new(),
            always_listening: false,
            skin: "robot".into(),
            auto_update: true,
        }
    }
}

impl Settings {
    /// Read the settings; a missing or unreadable file means first run (defaults).
    pub fn load() -> Settings {
        std::fs::read(paths::settings_file())
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) -> super::Result<()> {
        let bytes = serde_json::to_vec_pretty(self)?;
        paths::write_private(&paths::settings_file(), &bytes)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_settings_file_older_than_a_field_keeps_working() {
        // LES-039: a field the file does not have takes its default; nothing is wiped.
        // This is the exact v0.1 file shape (brain was a three-value enum then).
        let s: Settings = serde_json::from_str(r#"{"setupComplete":true,"assistantName":"Kofi","graphId":"umoja-desk-x","brain":"reflex","voice":"Bahh","alwaysListening":false}"#).unwrap();
        assert!(s.setup_complete);
        assert_eq!(s.assistant_name, "Kofi");
        assert_eq!(s.brain, "reflex");
        assert_eq!(s.voice, "Bahh");
        assert_eq!(s.skin, "robot");
        assert!(!s.agent_actions);
        assert!(s.auto_update);
        assert_eq!(s.voice_engine, VoiceEngine::System);
    }
}
