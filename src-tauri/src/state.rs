//! The composition root's state: the one place that holds each module's live object.
//! Commands borrow from here; modules never reach into each other through it.

use std::sync::Mutex;

use crate::dkg::{node, DkgClient};
use crate::kernel::settings::Settings;
use crate::kernel::{DeskError, Result};
use crate::memory::Memory;
use crate::phone::PhoneLink;
use crate::skills::reminders::Scheduler;
use crate::voice::Voice;

pub struct AppState {
    pub settings: Mutex<Settings>,
    memory: Mutex<Option<Memory>>,
    pub voice: Voice,
    pub reminders: Scheduler,
    pub phone: PhoneLink,
}

impl AppState {
    pub fn new(settings: Settings, reminders: Scheduler) -> AppState {
        let voice = Voice::new();
        voice.set_name(&settings.assistant_name);
        let state = AppState { settings: Mutex::new(settings), memory: Mutex::new(None), voice, reminders, phone: PhoneLink::default() };
        state.reconnect();
        state
    }

    pub fn settings(&self) -> Settings {
        self.settings.lock().map(|s| s.clone()).unwrap_or_default()
    }

    pub fn update_settings(&self, change: impl FnOnce(&mut Settings)) -> Result<Settings> {
        let mut s = self.settings.lock().map_err(|_| DeskError::Io("settings are busy".into()))?;
        change(&mut s);
        s.save()?;
        Ok(s.clone())
    }

    /// Rebuild the memory connection from the saved node folder and graph id.
    pub fn reconnect(&self) {
        let s = self.settings();
        let memory = node::locate(std::path::Path::new(&s.node_home))
            .filter(|_| !s.graph_id.is_empty())
            .map(|loc| Memory::new(DkgClient::new(&loc), &s.graph_id));
        if let Ok(mut m) = self.memory.lock() {
            *m = memory;
        }
    }

    pub fn memory(&self) -> Result<Memory> {
        self.memory
            .lock()
            .ok()
            .and_then(|m| m.clone())
            .ok_or_else(|| DeskError::Node("Umoja Desk is not connected to a memory node yet. Finish setup first.".into()))
    }
}
