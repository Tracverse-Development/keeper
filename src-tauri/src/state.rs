//! The composition root's state: the one place that holds each module's live object.
//! Commands borrow from here; modules never reach into each other through it.

use std::sync::Mutex;

use crate::dkg::{node, DkgClient};
use crate::kernel::settings::{KeeperProfile, Settings};
use crate::kernel::{DeskError, Result};
use crate::memory::Memory;
use crate::phone::PhoneLink;
use crate::skills::reminders::Scheduler;
use crate::voice::Voice;

pub struct AppState {
    pub settings: Mutex<Settings>,
    pub voice: Voice,
    pub reminders: Scheduler,
    pub phone: PhoneLink,
}

impl AppState {
    pub fn new(settings: Settings, reminders: Scheduler) -> AppState {
        let voice = Voice::new();
        voice.set_wake_required(settings.wake_word);
        let state = AppState { settings: Mutex::new(settings), voice, reminders, phone: PhoneLink::default() };
        state.refresh_voice_names();
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

    /// The wake words: every keeper's name, so "Hey <name>" reaches that keeper.
    pub fn refresh_voice_names(&self) {
        let s = self.settings();
        self.voice.set_keepers(s.keepers.iter().map(|k| (k.id.clone(), k.name.clone())).collect(), s.active().map(|k| k.id.clone()).unwrap_or_default());
    }

    /// The DKG client for the node chosen at setup.
    pub fn client(&self) -> Result<DkgClient> {
        node::locate(std::path::Path::new(&self.settings().node_home))
            .map(|loc| DkgClient::new(&loc))
            .ok_or_else(|| DeskError::Node("Keeper is not connected to a memory node yet. Finish setup first.".into()))
    }

    /// A keeper's memory: its own Context Graph.
    pub fn memory_for(&self, keeper: &KeeperProfile) -> Result<Memory> {
        Ok(Memory::new(self.client()?, &keeper.graph_id))
    }

    pub fn active_keeper(&self) -> Result<KeeperProfile> {
        self.settings().active().cloned().ok_or_else(|| DeskError::Invalid("There is no keeper yet. Finish setup first.".into()))
    }

    /// The keeper with this id, or the active one when the id is empty.
    pub fn keeper_or_active(&self, id: &str) -> Result<KeeperProfile> {
        if id.is_empty() {
            return self.active_keeper();
        }
        self.settings().keeper(id).cloned().ok_or_else(|| DeskError::Invalid("There is no such keeper.".into()))
    }

    /// The active keeper's memory.
    pub fn memory(&self) -> Result<Memory> {
        self.memory_for(&self.active_keeper()?)
    }
}
