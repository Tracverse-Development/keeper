//! The person's choices, kept in one small JSON file (0600). Nothing personal is stored here:
//! what each keeper learns lives on the DKG node, in that keeper's own Context Graph. API keys
//! live in `kernel::secrets`, never in this file.
//!
//! Keepers: each keeper is a profile (name, look, domain, brain, model) bound to ONE Context
//! Graph, its domain of memory. The first keeper is the System Administration keeper. A settings
//! file from before keepers existed (v0.1/v0.2) is migrated into keeper #1 on load (LES-039).

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

/// One worn part with its effect values (validated by `keepers::kit::parts::check`), and the
/// wardrobe item it was put on from (`part:<id>`, `stock:<id>` or `kit:<id>`; absent on outfits
/// from before the wardrobe and on imported packs, which carry data only).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WornPart {
    pub part: String,
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub effects: std::collections::BTreeMap<String, serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item: Option<String>,
}

/// One paint zone's look (`keepers::kit::look`): a colour (#rrggbb) and a material, either optional.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ZoneLook {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub material: Option<String>,
}

/// A keeper's own voice: which engine and which voice (a macOS voice name or an ElevenLabs id).
/// Absent = the app-wide voice in Settings.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperVoice {
    pub engine: VoiceEngine,
    pub id: String,
}

/// The outfit a keeper wears when nothing was chosen (the look the robot shipped with).
pub fn default_wearables() -> Vec<WornPart> {
    ["memory-halo", "ark-hull"].iter().map(|p| WornPart { part: p.to_string(), effects: Default::default(), item: Some(format!("part:{p}")) }).collect()
}

/// One keeper: soul (who), role (what it can do), body (species + wearables) and its own graph (memory).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct KeeperProfile {
    /// Stable id ("keeper-1", "keeper-3f9a…").
    pub id: String,
    /// What the person calls it (also its wake word: "Hey <name>").
    pub name: String,
    /// Its body: a species id ("robot", "puppy"); the window's skin registry draws it.
    pub skin: String,
    /// Its job: an id from `keepers::kit::roles::ROLES` ("system", "companion"). Was `domain`.
    #[serde(alias = "domain")]
    pub role: String,
    /// Its personality: a soul id (built in, or from the person's kit on the DKG).
    pub soul: String,
    /// What it wears, slot by slot (halo, head, neck, torso, back, base, aura): references into
    /// the person's wardrobe (`keepers::kit::wardrobe`) with the effect values worn.
    pub wearables: Vec<WornPart>,
    /// Its Context Graph: the exact id (DKG reference §2).
    pub graph_id: String,
    /// The engine that thinks: an id from `brain::engines::CATALOGUE`.
    pub brain: String,
    /// The engine's model ("" = the engine's own default; an Ollama tag for Ollama).
    pub model: String,
    /// Colour and material per paint zone (`keepers::kit::look`); empty = the species' own colours.
    #[serde(skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub look: std::collections::BTreeMap<String, ZoneLook>,
    /// What it does on its own when idle, 0..3 per habit; empty = the species' defaults.
    #[serde(skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    pub habits: std::collections::BTreeMap<String, f64>,
    /// Its own voice; None = the app-wide voice.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<KeeperVoice>,
    /// How it shows its answers (`brain::styles`: balanced, explainer, brief, chat); "" = balanced.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub style: String,
    /// The person turned this keeper's (simulated) mood off, in every mode.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub feelings_off: bool,
    /// Its sub-graph of the ONE home context graph (`graph_id`); None = the whole graph, as
    /// before the move (docs/design/keeper-memory-graph.md).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_sub: Option<String>,
    /// Where its memory was before the move: kept as a backup, and erased together with the new
    /// copy until a confirmed clean-up removes it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legacy_graph: Option<String>,
}


impl Default for KeeperProfile {
    fn default() -> Self {
        KeeperProfile { id: String::new(), name: "Keeper".into(), skin: "robot".into(), role: "system".into(), soul: "steady".into(), wearables: default_wearables(), graph_id: String::new(), brain: "reflex".into(), model: String::new(), look: Default::default(), habits: Default::default(), voice: None, style: String::new(), feelings_off: false, memory_sub: None, legacy_graph: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub setup_complete: bool,
    /// The DKG node's home folder (holds `api.port` and `auth.token`).
    pub node_home: String,
    pub keepers: Vec<KeeperProfile>,
    /// The keeper on screen (and the one the phone link and voice talk to by default).
    pub active_keeper: String,
    /// May agent engines act on this computer (run commands, edit files)? Off until the person says so.
    pub agent_actions: bool,
    /// macOS voice name for the system voice.
    pub voice: String,
    pub voice_engine: VoiceEngine,
    /// The ElevenLabs voice id when `voice_engine` is ElevenLabs.
    pub eleven_voice_id: String,
    /// Listen all the time (off until the person turns it on).
    pub always_listening: bool,
    /// While always listening: wait for "Hey <keeper>" (true), or treat every sentence as meant
    /// for the active keeper (false, "open mic").
    pub wake_word: bool,
    /// Answer visually on the Stage (panels) by default; "just text" in a message overrides it.
    pub visual: bool,
    /// Prepare the next scenes in the background (each card of a lesson) so clicking is instant.
    pub prefetch_scenes: bool,
    /// The quick helper model for prepared scenes and follow-ups on a panel ("" = off).
    pub fast_model: String,
    /// Short conversational turns are answered by the quick helper model (about twice as fast).
    pub quick_replies: bool,
    /// Before an agent acts on the computer, show its plan and wait for Approve.
    pub ask_before_acting: bool,
    /// The day the morning brief was last shown (YYYY-MM-DD).
    pub last_brief: String,
    /// The global push-to-talk shortcut ("Alt+Space"); empty = off.
    pub talk_shortcut: String,
    /// Install updates by itself (checked at launch and every few hours).
    pub auto_update: bool,
    /// The most the cloud minds may cost in a calendar month, in dollars at their own prices
    /// (`kernel::usage`); 0 = no limit. Once reached, turns stay on this computer.
    #[serde(default, skip_serializing_if = "is_zero")]
    pub monthly_cap_usd: f64,
    /// The name (and optional https link) put on packs the person shares, as their maker
    /// (`keepers::kit::packs::Maker`); empty = packs carry no maker.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub maker_name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub maker_link: String,
    /// The kit (souls, modes, wardrobe) lives in the `kit` sub-graph of the home graph.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub kit_moved: bool,

    // Fields of the single-assistant settings (v0.1–v0.2): read once to migrate, never written.
    #[serde(skip_serializing)]
    assistant_name: String,
    #[serde(skip_serializing)]
    graph_id: String,
    #[serde(skip_serializing)]
    brain: String,
    #[serde(skip_serializing)]
    ollama_model: String,
    #[serde(skip_serializing)]
    skin: String,
}

fn is_zero(v: &f64) -> bool {
    *v == 0.0
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            setup_complete: false,
            node_home: String::new(),
            keepers: Vec::new(),
            active_keeper: String::new(),
            agent_actions: false,
            voice: "Samantha".into(),
            voice_engine: VoiceEngine::System,
            eleven_voice_id: String::new(),
            always_listening: false,
            wake_word: true,
            visual: true,
            prefetch_scenes: true,
            fast_model: "haiku".into(),
            ask_before_acting: true,
            quick_replies: true,
            last_brief: String::new(),
            talk_shortcut: "Alt+Space".into(),
            auto_update: true,
            monthly_cap_usd: 0.0,
            maker_name: String::new(),
            maker_link: String::new(),
            kit_moved: false,
            assistant_name: String::new(),
            graph_id: String::new(),
            brain: String::new(),
            ollama_model: String::new(),
            skin: String::new(),
        }
    }
}

impl Settings {
    /// These settings with the active keeper's own voice in place of the app-wide one (when it
    /// has one), so each keeper sounds like itself.
    pub fn speaking_as_active(&self) -> Settings {
        let mut s = self.clone();
        if let Some(v) = self.keepers.iter().find(|k| k.id == self.active_keeper).and_then(|k| k.voice.clone()) {
            match v.engine {
                VoiceEngine::Elevenlabs => s.eleven_voice_id = v.id,
                _ => s.voice = v.id,
            }
            s.voice_engine = v.engine;
        }
        s
    }

    /// Read the settings; a missing or unreadable file means first run (defaults).
    pub fn load() -> Settings {
        let mut s: Settings = std::fs::read(paths::settings_file()).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok()).unwrap_or_default();
        s.migrate();
        s
    }

    pub fn save(&self) -> super::Result<()> {
        let bytes = serde_json::to_vec_pretty(self)?;
        paths::write_private(&paths::settings_file(), &bytes)?;
        Ok(())
    }

    /// A pre-keepers file becomes keeper #1, the System Administration keeper, on its own graph.
    fn migrate(&mut self) {
        if !self.keepers.is_empty() || self.graph_id.is_empty() {
            return;
        }
        let model = if self.brain == "ollama" { self.ollama_model.clone() } else { String::new() };
        self.keepers.push(KeeperProfile {
            id: "keeper-1".into(),
            name: if self.assistant_name.is_empty() { "Keeper".into() } else { self.assistant_name.clone() },
            skin: if self.skin.is_empty() { "robot".into() } else { self.skin.clone() },
            role: "system".into(),
            soul: "steady".into(),
            wearables: default_wearables(),
            graph_id: self.graph_id.clone(),
            brain: if self.brain.is_empty() { "reflex".into() } else { self.brain.clone() },
            model, look: Default::default(), habits: Default::default(), voice: None, style: String::new(), feelings_off: false, memory_sub: None, legacy_graph: None
        });
        self.active_keeper = "keeper-1".into();
    }

    /// The keeper on screen (the first one when the saved id is gone).
    pub fn active(&self) -> Option<&KeeperProfile> {
        self.keepers.iter().find(|k| k.id == self.active_keeper).or(self.keepers.first())
    }

    pub fn keeper(&self, id: &str) -> Option<&KeeperProfile> {
        self.keepers.iter().find(|k| k.id == id)
    }

    pub fn keeper_mut(&mut self, id: &str) -> Option<&mut KeeperProfile> {
        self.keepers.iter_mut().find(|k| k.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_single_assistant_file_becomes_keeper_one() {
        // LES-039: the exact v0.2 file shape; nothing is lost, and it is never written back in the old shape.
        let s: Settings = serde_json::from_str(r#"{"setupComplete":true,"assistantName":"Kofi","graphId":"umoja-desk-x","nodeHome":"/n","brain":"claude","voice":"Bahh","skin":"puppy","alwaysListening":false}"#).unwrap();
        let mut s = s;
        s.migrate();
        let k = s.active().unwrap();
        assert_eq!((k.name.as_str(), k.graph_id.as_str(), k.brain.as_str(), k.skin.as_str(), k.role.as_str()), ("Kofi", "umoja-desk-x", "claude", "puppy", "system"));
        assert_eq!((k.soul.as_str(), k.wearables.len()), ("steady", 2));
        assert_eq!(s.voice, "Bahh");
        assert!(s.wake_word && s.auto_update && !s.agent_actions);
        assert_eq!(s.talk_shortcut, "Alt+Space");
        let saved = serde_json::to_string(&s).unwrap();
        assert!(!saved.contains("assistantName") && saved.contains("\"keepers\""));
    }

    #[test]
    fn a_v03_keeper_with_a_domain_reads_as_a_role() {
        let k: KeeperProfile = serde_json::from_str(r#"{"id":"keeper-2","name":"Pup","skin":"puppy","domain":"companion","graphId":"g","brain":"reflex"}"#).unwrap();
        assert_eq!((k.role.as_str(), k.soul.as_str(), k.wearables.len()), ("companion", "steady", 2));
    }

    #[test]
    fn a_fresh_install_has_no_keeper_until_setup() {
        let mut s = Settings::default();
        s.migrate();
        assert!(s.keepers.is_empty() && s.active().is_none());
    }
}
