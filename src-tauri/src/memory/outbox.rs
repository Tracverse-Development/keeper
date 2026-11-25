//! No silent failures (LES-014): a write the node could not take right now waits here
//! (`outbox.jsonl`, 0600, this computer only) and is sent again on the next successful write.

use serde::{Deserialize, Serialize};

use crate::dkg::{DkgClient, Quad};
use crate::kernel::paths;

#[derive(Serialize, Deserialize)]
struct Pending {
    graph: String,
    name: String,
    quads: Vec<PendingQuad>,
}

#[derive(Serialize, Deserialize)]
struct PendingQuad {
    subject: String,
    predicate: String,
    object: String,
}

pub fn hold(graph: &str, name: &str, quads: &[Quad]) {
    let pending = Pending {
        graph: graph.into(),
        name: name.into(),
        quads: quads.iter().map(|q| PendingQuad { subject: q.subject.clone(), predicate: q.predicate.clone(), object: q.object.clone() }).collect(),
    };
    let Ok(line) = serde_json::to_string(&pending) else { return };
    let path = paths::outbox_file();
    let mut text = std::fs::read_to_string(&path).unwrap_or_default();
    text.push_str(&line);
    text.push('\n');
    let _ = paths::write_private(&path, text.as_bytes());
}

pub fn waiting() -> usize {
    std::fs::read_to_string(paths::outbox_file()).map(|t| t.lines().filter(|l| !l.trim().is_empty()).count()).unwrap_or(0)
}

/// Send what is waiting; what fails again stays.
pub async fn flush(client: &DkgClient) {
    let path = paths::outbox_file();
    let Ok(text) = std::fs::read_to_string(&path) else { return };
    let mut kept = String::new();
    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let Ok(p) = serde_json::from_str::<Pending>(line) else { continue };
        let quads: Vec<Quad> = p.quads.iter().map(|q| Quad { subject: q.subject.clone(), predicate: q.predicate.clone(), object: q.object.clone() }).collect();
        // Kept already (a 409) counts as sent: retrying it forever would never succeed.
        if let Err(e) = client.write_asset(&p.graph, &p.name, &quads).await {
            if matches!(e, crate::kernel::DeskError::Exists(_)) {
                continue;
            }
            kept.push_str(line);
            kept.push('\n');
        }
    }
    let _ = paths::write_private(&path, kept.as_bytes());
}
