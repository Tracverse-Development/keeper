//! The composition root's state: the one place that holds each module's live object.
//! Commands borrow from here; modules never reach into each other through it.

use std::sync::Mutex;

use crate::dkg::{node, DkgClient};
use crate::keepers::kit::souls::{self, Soul};
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
    /// Plans waiting for Approve (`assistant::approval`).
    pub plans: crate::assistant::approval::Plans,
    /// The person's own souls (from their kit graph on the DKG), refreshed at launch and on change.
    souls: Mutex<Vec<Soul>>,
}

impl AppState {
    pub fn new(settings: Settings, reminders: Scheduler) -> AppState {
        let voice = Voice::new();
        voice.set_wake_required(settings.wake_word);
        let state = AppState { settings: Mutex::new(settings), voice, reminders, phone: PhoneLink::default(), plans: Default::default(), souls: Mutex::new(Vec::new()) };
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

    /// A keeper's memory: its sub-graph of the home context graph (its old graph before the move),
    /// erasing from the backup of its old place too.
    pub fn memory_for(&self, keeper: &KeeperProfile) -> Result<Memory> {
        Ok(Memory::at(self.client()?, crate::keepers::place_of(keeper)).with_legacy(crate::keepers::legacy_place_of(keeper)))
    }

    /// Where the kit lives: the home graph's `kit` sub-graph once moved (its own graph before).
    pub fn kit_place(&self) -> crate::dkg::Place {
        if self.settings().kit_moved {
            crate::dkg::Place::new(&crate::keepers::graph_id_for("", true), Some(crate::keepers::kit::inventory::KIT_SUB))
        } else {
            crate::dkg::Place::from(crate::keepers::kit::inventory::graph_id().as_str())
        }
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

    /// A soul by id: built in, or one of the person's own; None when unknown.
    pub fn soul_known(&self, id: &str) -> Option<Soul> {
        souls::builtin().into_iter().find(|s| s.id == id).or_else(|| self.souls.lock().ok()?.iter().find(|s| s.id == id).cloned())
    }

    /// A soul by id, falling back to Steady (a keeper is never without a personality).
    pub fn soul(&self, id: &str) -> Soul {
        self.soul_known(id).unwrap_or_else(|| souls::builtin().remove(0))
    }

    pub fn custom_souls(&self) -> Vec<Soul> {
        self.souls.lock().map(|s| s.clone()).unwrap_or_default()
    }

    /// Reload the person's souls and modes from their kit graph.
    pub async fn refresh_souls(&self) {
        let Ok(client) = self.client() else { return };
        let Ok(graph) = crate::keepers::kit::inventory::kit(&client, &self.kit_place()).await else { return };
        if let Ok(modes) = crate::keepers::kit::inventory::modes(&client, &graph, &crate::skills::names()).await {
            crate::keepers::kit::roles::set_personal(modes);
        }
        if let Ok(list) = crate::keepers::kit::inventory::souls(&client, &graph).await {
            if let Ok(mut s) = self.souls.lock() {
                *s = list;
            }
        }
    }
}
