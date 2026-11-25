//! Voice: the bridge to `keeper-voice`, the small Swift helper bundled with the app
//! (`native/voice/`). It hears with Apple's on-device speech recogniser and speaks with the
//! system voices, so neither the person's voice nor the assistant's words leave the computer.
//!
//! The helper takes one JSON command per line on stdin (`listen`, `stop`, `speak`, `hush`,
//! `authorize`) and writes one JSON event per line on stdout (`ready`, `level`, `partial`,
//! `final`, `speech-start`, `word`, `speech-end`, `authorized`, `error`). Every event goes to the
//! window as `voice://event`; a `final` that is meant for the assistant (push-to-talk, or past
//! the wake word) also goes as `voice://command`.

pub mod eleven;
pub mod wake;

use std::sync::{Arc, Mutex};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex as AsyncMutex;

use crate::kernel::settings::{Settings, VoiceEngine};
use crate::kernel::{events, DeskError, Result};
use crate::platform;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Mode {
    Off,
    Once,
    Always,
}

struct Shared {
    mode: Mode,
    wake: wake::Wake,
    name: String,
    /// Always-listening needs the wake word (false = open mic: every sentence is a command).
    wake_required: bool,
}

#[derive(Clone)]
pub struct Voice {
    stdin: Arc<AsyncMutex<Option<ChildStdin>>>,
    shared: Arc<Mutex<Shared>>,
}

impl Voice {
    pub fn new() -> Voice {
        Voice { stdin: Arc::new(AsyncMutex::new(None)), shared: Arc::new(Mutex::new(Shared { mode: Mode::Off, wake: wake::Wake::default(), name: "Keeper".into(), wake_required: true })) }
    }

    pub fn set_name(&self, name: &str) {
        if let Ok(mut s) = self.shared.lock() {
            s.name = name.to_string();
        }
    }

    pub fn set_wake_required(&self, required: bool) {
        if let Ok(mut s) = self.shared.lock() {
            s.wake_required = required;
        }
    }

    /// Start the helper once; later calls reuse it. False when the helper is not bundled.
    pub async fn ensure_started(&self, app: &AppHandle) -> Result<()> {
        let mut stdin = self.stdin.lock().await;
        if stdin.is_some() {
            return Ok(());
        }
        let helper = platform::voice_helper().ok_or_else(|| DeskError::Io("The voice helper is missing from this build.".into()))?;
        let mut child = Command::new(helper)
            .arg("serve")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()?;
        *stdin = child.stdin.take();
        let stdout = child.stdout.take().ok_or_else(|| DeskError::Io("voice helper has no output".into()))?;
        let app = app.clone();
        let shared = self.shared.clone();
        let handle = self.stdin.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(event) = serde_json::from_str::<Value>(&line) else { continue };
                let _ = app.emit(events::VOICE_EVENT, &event);
                if event["type"] == "final" {
                    route_final(&app, &shared, event["text"].as_str().unwrap_or_default());
                }
            }
            // The helper ended (crash or quit): the next call starts a fresh one.
            let _ = child.wait().await;
            *handle.lock().await = None;
            let _ = app.emit(events::VOICE_EVENT, json!({ "type": "stopped" }));
        });
        Ok(())
    }

    async fn send(&self, app: &AppHandle, command: Value) -> Result<()> {
        self.ensure_started(app).await?;
        let mut guard = self.stdin.lock().await;
        let stdin = guard.as_mut().ok_or_else(|| DeskError::Io("The voice helper is not running.".into()))?;
        let mut line = command.to_string();
        line.push('\n');
        stdin.write_all(line.as_bytes()).await?;
        stdin.flush().await?;
        Ok(())
    }

    fn set_mode(&self, mode: Mode) {
        if let Ok(mut s) = self.shared.lock() {
            s.mode = mode;
        }
    }

    pub async fn authorize(&self, app: &AppHandle) -> Result<()> {
        self.send(app, json!({ "cmd": "authorize" })).await
    }

    /// Listen for one sentence (push-to-talk).
    pub async fn listen_once(&self, app: &AppHandle) -> Result<()> {
        self.set_mode(Mode::Once);
        self.send(app, json!({ "cmd": "listen", "mode": "once" })).await
    }

    /// Listen all the time for the wake word.
    pub async fn listen_always(&self, app: &AppHandle) -> Result<()> {
        self.set_mode(Mode::Always);
        self.send(app, json!({ "cmd": "listen", "mode": "always" })).await
    }

    pub async fn stop_listening(&self, app: &AppHandle) -> Result<()> {
        self.set_mode(Mode::Off);
        self.send(app, json!({ "cmd": "stop" })).await
    }

    /// Speak with the chosen voice engine. ElevenLabs that fails falls back to the Mac's voice,
    /// and the window hears why (no silent failures).
    pub async fn speak(&self, app: &AppHandle, text: &str, settings: &Settings) -> Result<()> {
        if settings.voice_engine == VoiceEngine::Elevenlabs {
            match eleven::render(text, &settings.eleven_voice_id).await {
                Ok(path) => return self.send(app, json!({ "cmd": "play", "path": path })).await,
                Err(e) => {
                    let _ = app.emit(events::VOICE_EVENT, json!({ "type": "error", "message": format!("{e} Using the Mac's voice instead.") }));
                }
            }
        }
        self.send(app, json!({ "cmd": "speak", "text": text, "voice": settings.voice })).await
    }

    /// Ask for the English system voices (answered as a `voices` event).
    pub async fn list_voices(&self, app: &AppHandle) -> Result<()> {
        self.send(app, json!({ "cmd": "voices" })).await
    }

    pub async fn hush(&self, app: &AppHandle) -> Result<()> {
        self.send(app, json!({ "cmd": "hush" })).await
    }
}

fn route_final(app: &AppHandle, shared: &Arc<Mutex<Shared>>, text: &str) {
    let Ok(mut s) = shared.lock() else { return };
    let command = match s.mode {
        Mode::Once => {
            s.mode = Mode::Off;
            Some(text.to_string())
        }
        // Open mic: every sentence is for the assistant (words of one or two letters are noise).
        Mode::Always if !s.wake_required => Some(text.to_string()).filter(|t| t.trim().len() > 2),
        Mode::Always => {
            let name = s.name.clone();
            match s.wake.hear(text, &name) {
                wake::Heard::Command(c) => Some(c),
                wake::Heard::Woken => {
                    let _ = app.emit(events::VOICE_EVENT, json!({ "type": "woken" }));
                    None
                }
                wake::Heard::Ignore => None,
            }
        }
        Mode::Off => None,
    };
    if let Some(c) = command.filter(|c| !c.trim().is_empty()) {
        let _ = app.emit(events::VOICE_COMMAND, json!({ "text": c }));
    }
}
