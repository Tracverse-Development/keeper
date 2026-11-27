//! Voice: the bridge to `keeper-voice`, the small Swift helper bundled with the app
//! (`native/voice/`). It hears with Apple's on-device speech recogniser and speaks with the
//! system voices, so neither the person's voice nor the assistant's words leave the computer.
//!
//! The helper takes one JSON command per line on stdin (`listen`, `stop`, `speak`, `hush`,
//! `authorize`) and writes one JSON event per line on stdout (`ready`, `level`, `partial`,
//! `final`, `speech-start`, `word`, `speech-end`, `authorized`, `error`). Every event goes to the
//! window as `voice://event`; a `final` that is meant for the assistant (push-to-talk, or past
//! the wake word) also goes as `voice://command`.
//!
//! Request/response (`ask`): a command sent with a fresh `id` (the PIM commands: `pim-access`,
//! `pim-request`, `events`, `event-create`, `contacts`) is answered by ONE event with that `id`,
//! which goes back to the caller (`replies`), not to the window.

pub mod eleven;
mod replies;
pub mod wake;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex as AsyncMutex;

use crate::kernel::settings::{Settings, VoiceEngine};
use crate::kernel::{events, DeskError, Result};
use crate::platform;

use replies::Replies;

/// How long `ask` waits for the helper's answer.
pub const ASK_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone, Copy, PartialEq)]
enum Mode {
    Off,
    Once,
    Always,
}

struct Shared {
    mode: Mode,
    wake: wake::Wake,
    /// Every keeper as (id, name), and the active keeper's id.
    keepers: Vec<(String, String)>,
    active: String,
    /// Always-listening needs the wake word (false = open mic: every sentence is a command).
    wake_required: bool,
}

#[derive(Clone)]
pub struct Voice {
    stdin: Arc<AsyncMutex<Option<ChildStdin>>>,
    shared: Arc<Mutex<Shared>>,
    replies: Arc<Replies>,
    /// Speech is rendered and handed over one at a time, so queued sentences keep their order.
    order: Arc<AsyncMutex<()>>,
}

impl Voice {
    pub fn new() -> Voice {
        Voice { stdin: Arc::new(AsyncMutex::new(None)), shared: Arc::new(Mutex::new(Shared { mode: Mode::Off, wake: wake::Wake::default(), keepers: Vec::new(), active: String::new(), wake_required: true })), replies: Arc::new(Replies::default()), order: Arc::new(AsyncMutex::new(())) }
    }

    pub fn set_keepers(&self, keepers: Vec<(String, String)>, active: String) {
        if let Ok(mut s) = self.shared.lock() {
            s.keepers = keepers;
            s.active = active;
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
        let replies = self.replies.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(event) = serde_json::from_str::<Value>(&line) else { continue };
                if replies.deliver(&event) {
                    continue;
                }
                let _ = app.emit(events::VOICE_EVENT, &event);
                if event["type"] == "final" {
                    route_final(&app, &shared, event["text"].as_str().unwrap_or_default());
                }
            }
            // The helper ended (crash or quit): the next call starts a fresh one.
            let _ = child.wait().await;
            *handle.lock().await = None;
            replies.clear();
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

    /// Send `command` (a JSON object) with a fresh `id` and wait up to `ASK_TIMEOUT` for the
    /// helper's one reply with that id. A reply with `"ok": false` becomes an error carrying the
    /// helper's own words.
    pub async fn ask(&self, app: &AppHandle, command: Value) -> Result<Value> {
        self.ask_within(app, command, ASK_TIMEOUT).await
    }

    /// `ask` with its own time limit (asking for permission waits on the person, not the Mac).
    pub async fn ask_within(&self, app: &AppHandle, mut command: Value, within: Duration) -> Result<Value> {
        let Some(fields) = command.as_object_mut() else { return Err(DeskError::Invalid("A helper command must be an object.".into())) };
        let (id, reply) = self.replies.open();
        fields.insert("id".into(), Value::String(id.clone()));
        if let Err(e) = self.send(app, command).await {
            self.replies.forget(&id);
            return Err(e);
        }
        match tokio::time::timeout(within, reply).await {
            Ok(Ok(event)) if event["ok"] == false => Err(DeskError::Io(event["error"].as_str().unwrap_or("The helper could not do that.").to_string())),
            Ok(Ok(event)) => Ok(event),
            Ok(Err(_)) => Err(DeskError::Io("The helper stopped before it answered.".into())),
            Err(_) => {
                self.replies.forget(&id);
                Err(DeskError::Io("The helper did not answer in time.".into()))
            }
        }
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

    /// End the sentence now (the push-to-talk key was released): what was heard so far is final.
    pub async fn finish(&self, app: &AppHandle) -> Result<()> {
        self.send(app, json!({ "cmd": "finish" })).await
    }

    pub async fn stop_listening(&self, app: &AppHandle) -> Result<()> {
        self.set_mode(Mode::Off);
        self.send(app, json!({ "cmd": "stop" })).await
    }

    /// Speak with the chosen voice engine. ElevenLabs that fails falls back to the Mac's voice,
    /// and the window hears why (no silent failures).
    /// `queue`: wait for what is being said (the rest of a reply after its first sentence).
    pub async fn speak(&self, app: &AppHandle, text: &str, settings: &Settings, queue: bool) -> Result<()> {
        // Testing only: KEEPER_SILENT=1 (set by the bench scripts) keeps a test copy quiet on the
        // machine running it. This is the one place the app makes sound. Never set in normal use.
        if std::env::var_os("KEEPER_SILENT").is_some() {
            return Ok(());
        }
        let _turn = self.order.lock().await;
        if settings.voice_engine == VoiceEngine::Elevenlabs {
            match eleven::render(text, &settings.eleven_voice_id).await {
                Ok(path) => return self.send(app, json!({ "cmd": "play", "path": path, "queue": queue })).await,
                Err(e) => {
                    let _ = app.emit(events::VOICE_EVENT, json!({ "type": "error", "message": format!("{e} Using the Mac's voice instead.") }));
                }
            }
        }
        self.send(app, json!({ "cmd": "speak", "text": text, "voice": settings.voice, "queue": queue })).await
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
    let active = s.active.clone();
    // (keeper id, command); an empty id means the active keeper.
    let command: Option<(String, String)> = match s.mode {
        Mode::Once => {
            s.mode = Mode::Off;
            Some((String::new(), text.to_string()))
        }
        // Open mic: every sentence is for the active keeper (words of one or two letters are noise).
        Mode::Always if !s.wake_required => Some((String::new(), text.to_string())).filter(|(_, t)| t.trim().len() > 2),
        Mode::Always => {
            let names: Vec<String> = s.keepers.iter().map(|(_, n)| n.clone()).collect();
            let active_index = s.keepers.iter().position(|(id, _)| *id == active).unwrap_or(0);
            let ids: Vec<String> = s.keepers.iter().map(|(id, _)| id.clone()).collect();
            match s.wake.hear(text, &names, active_index) {
                wake::Heard::Command(i, c) => Some((ids.get(i).cloned().unwrap_or_default(), c)),
                wake::Heard::Woken(i) => {
                    let _ = app.emit(events::VOICE_EVENT, json!({ "type": "woken", "keeper": ids.get(i) }));
                    None
                }
                wake::Heard::Ignore => None,
            }
        }
        Mode::Off => None,
    };
    if let Some((keeper, c)) = command.filter(|(_, c)| !c.trim().is_empty()) {
        let _ = app.emit(events::VOICE_COMMAND, json!({ "text": c, "keeper": keeper }));
    }
}
