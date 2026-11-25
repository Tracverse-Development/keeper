//! Writes after the reply (Unit of Work): a turn adds its records here as it goes; each one is
//! applied to hot memory at once (the next turn already sees it) and queued, and `send` hands
//! the queue to one background task that writes it to the DKG in order and reports each receipt.
//! The person gets the reply without waiting ~55 ms per record (measured 2026-11-25); a write the
//! node cannot take still waits in the outbox, as with `Memory::write`.

use crate::dkg::Quad;

use super::records::Record;
use super::{hot, Memory, WriteReceipt};

pub struct Later {
    memory: Memory,
    jobs: Vec<(String, &'static str, Vec<Quad>)>,
}

impl Later {
    pub fn new(memory: &Memory) -> Later {
        Later { memory: memory.clone(), jobs: Vec::new() }
    }

    /// Queue a record (`kind` labels it for the window: "fact", "turn", "action"…); returns its
    /// receipt as it stands now ("writing").
    pub fn add(&mut self, record: &impl Record, kind: &'static str) -> WriteReceipt {
        if let Some(change) = record.hot() {
            hot::apply(self.memory.graph(), change);
        }
        let name = record.asset_name();
        self.jobs.push((name.clone(), kind, record.quads()));
        WriteReceipt { name, ual: String::new(), status: "writing".into(), queued: false }
    }

    /// Write the queue to the DKG in the background, in order; `on_written` hears each receipt.
    pub fn send(self, on_written: impl Fn(&WriteReceipt, &str) + Send + 'static) {
        if self.jobs.is_empty() {
            return;
        }
        let Later { memory, jobs } = self;
        tauri::async_runtime::spawn(async move {
            for (name, kind, quads) in jobs {
                let receipt = memory.write_quads(name, &quads).await;
                on_written(&receipt, kind);
            }
        });
    }
}
