//! Replies: request/response over the helper's one-way event stream. A command sent with
//! `Voice::ask` carries a fresh `id`; the helper answers with ONE event carrying the same `id`,
//! and the reader hands that event to the waiting caller instead of the window. Events without
//! a waiting id (levels, partials, speech) are untouched and still go to the window.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde_json::Value;
use tokio::sync::oneshot;

#[derive(Default)]
pub struct Replies {
    next: AtomicU64,
    waiting: Mutex<HashMap<String, oneshot::Sender<Value>>>,
}

impl Replies {
    /// A fresh id and the receiver its reply will arrive on.
    pub fn open(&self) -> (String, oneshot::Receiver<Value>) {
        let id = format!("ask-{}", self.next.fetch_add(1, Ordering::Relaxed) + 1);
        let (tx, rx) = oneshot::channel();
        if let Ok(mut w) = self.waiting.lock() {
            w.insert(id.clone(), tx);
        }
        (id, rx)
    }

    /// Hand `event` to its waiter when its `id` is one we wait for. True = consumed (do not
    /// forward it to the window).
    pub fn deliver(&self, event: &Value) -> bool {
        let Some(id) = event.get("id").and_then(Value::as_str) else { return false };
        let Some(tx) = self.waiting.lock().ok().and_then(|mut w| w.remove(id)) else { return false };
        let _ = tx.send(event.clone());
        true
    }

    /// Stop waiting for `id` (timed out, or the command was never sent).
    pub fn forget(&self, id: &str) {
        if let Ok(mut w) = self.waiting.lock() {
            w.remove(id);
        }
    }

    /// The helper ended: every waiter hears at once instead of waiting out its timeout.
    pub fn clear(&self) {
        if let Ok(mut w) = self.waiting.lock() {
            w.clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_reply_reaches_only_the_caller_with_its_id() {
        let replies = Replies::default();
        let (a, mut rx_a) = replies.open();
        let (b, mut rx_b) = replies.open();
        assert_ne!(a, b);
        assert!(replies.deliver(&json!({ "type": "pim", "id": b, "ok": true })));
        assert_eq!(rx_b.try_recv().unwrap()["id"], b);
        assert!(rx_a.try_recv().is_err(), "a is still waiting");
        // Delivered once: a second copy of b's reply goes to the window as a normal event.
        assert!(!replies.deliver(&json!({ "type": "pim", "id": b })));
    }

    #[test]
    fn events_without_a_waiting_id_pass_through() {
        let replies = Replies::default();
        let _ = replies.open();
        assert!(!replies.deliver(&json!({ "type": "level", "value": 0.3 })));
        assert!(!replies.deliver(&json!({ "type": "pim", "id": "someone-else" })));
        assert!(!replies.deliver(&json!({ "type": "pim", "id": 7 })));
    }

    #[test]
    fn forgotten_and_cleared_waiters_are_gone() {
        let replies = Replies::default();
        let (a, _rx) = replies.open();
        replies.forget(&a);
        assert!(!replies.deliver(&json!({ "id": a })));
        let (_b, mut rx_b) = replies.open();
        replies.clear();
        assert!(rx_b.try_recv().is_err());
    }
}
