//! Pinned scenes: a Stage scene the person wants on hand in every chat (a times table, a
//! packing checklist). One `desk:PinnedScene` asset per pin (its panels as JSON) and one
//! `desk:SceneUnpinned` per unpin; the list is pins minus unpins, worked out in Rust because
//! Working Memory cannot join across assets (LES-001). Commands: `scenes_pinned`, `scene_pin`,
//! `scene_unpin`.

use serde::Serialize;
use tauri::State;

use crate::dkg::ontology::{entity, pred, ASSISTANT};
use crate::dkg::{AssetBuilder, Layer, Quad};
use crate::kernel::slug::short_hash;
use crate::kernel::{time, DeskError, Result};
use crate::stage::Panel;
use crate::state::AppState;

use super::records::Record;
use super::Memory;

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> ";
const MOST_PINS: usize = 30;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedScene {
    pub id: String,
    pub title: String,
    pub panels: Vec<Panel>,
    pub at: String,
}

impl Record for PinnedScene {
    fn asset_name(&self) -> String {
        format!("desk-pinscene-{}-{}", self.id, short_hash(&self.at, 10))
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("pinscene", &self.id))
            .a("desk:PinnedScene")
            .text("desk:pinId", &self.id)
            .text(pred::NAME, &self.title)
            .text(pred::PANELS, &serde_json::to_string(&self.panels).unwrap_or_default())
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

struct Unpinned {
    id: String,
    at: String,
}

impl Record for Unpinned {
    fn asset_name(&self) -> String {
        format!("desk-unpin-{}-{}", self.id, short_hash(&self.at, 10))
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("unpin", &short_hash(&format!("{}{}", self.id, self.at), 16)))
            .a("desk:SceneUnpinned")
            .text("desk:pinId", &self.id)
            .time(pred::AT, &self.at)
            .build()
    }
}

/// The same scene pinned twice is one pin.
pub fn pin_id(title: &str, panels: &[Panel]) -> String {
    short_hash(&format!("{title}\u{0}{}", serde_json::to_string(panels).unwrap_or_default()), 16)
}

impl Memory {
    /// Pins newest first: the latest pin or unpin of each id decides.
    pub async fn pinned_scenes(&self) -> Result<Vec<PinnedScene>> {
        let pins = format!("{PREFIXES}SELECT ?id ?title ?panels ?at WHERE {{ ?s a desk:PinnedScene ; desk:pinId ?id ; schema:name ?title ; desk:panels ?panels ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT 200");
        let unpins = format!("{PREFIXES}SELECT ?id ?at WHERE {{ ?s a desk:SceneUnpinned ; desk:pinId ?id ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT 400");
        let (pins, unpins) = (self.client().query(self.graph(), &pins, Layer::Working).await?, self.client().query(self.graph(), &unpins, Layer::Working).await?);
        let last_unpin = |id: &str| unpins.iter().filter(|u| u.get("id").map(String::as_str) == Some(id)).filter_map(|u| u.get("at").cloned()).max();
        let mut out: Vec<PinnedScene> = Vec::new();
        for row in pins {
            let (Some(id), Some(at)) = (row.get("id"), row.get("at")) else { continue };
            if out.iter().any(|p| &p.id == id) || last_unpin(id).is_some_and(|u| &u >= at) {
                continue;
            }
            let panels = serde_json::from_str::<serde_json::Value>(row.get("panels").map(String::as_str).unwrap_or("[]")).map(|v| crate::stage::read(&v)).unwrap_or_default();
            if !panels.is_empty() {
                out.push(PinnedScene { id: id.clone(), title: row.get("title").cloned().unwrap_or_default(), panels, at: at.clone() });
            }
            if out.len() == MOST_PINS {
                break;
            }
        }
        Ok(out)
    }

    /// Take a scene off the pinned list (the pin itself stays in the graph's history).
    pub async fn unpin_scene(&self, id: &str) {
        self.write(&Unpinned { id: id.to_string(), at: time::now_iso() }).await;
    }
}

fn memory(state: &AppState, keeper: Option<String>) -> Result<Memory> {
    state.memory_for(&state.keeper_or_active(keeper.as_deref().unwrap_or(""))?)
}

#[tauri::command]
pub async fn scenes_pinned(state: State<'_, AppState>, keeper: Option<String>) -> Result<Vec<PinnedScene>> {
    memory(&state, keeper)?.pinned_scenes().await
}

/// Pin a scene (its panels are re-read and capped like any engine output).
#[tauri::command]
pub async fn scene_pin(state: State<'_, AppState>, keeper: Option<String>, title: String, panels: serde_json::Value) -> Result<PinnedScene> {
    let panels = crate::stage::read(&panels);
    if panels.is_empty() {
        return Err(DeskError::Invalid("There's nothing on this scene to pin.".into()));
    }
    let title: String = title.trim().chars().take(80).collect();
    let pin = PinnedScene { id: pin_id(&title, &panels), title, panels, at: time::now_iso() };
    memory(&state, keeper)?.write(&pin).await;
    Ok(pin)
}

#[tauri::command]
pub async fn scene_unpin(state: State<'_, AppState>, keeper: Option<String>, id: String) -> Result<()> {
    if id.len() != 16 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(DeskError::Invalid("That isn't a pinned scene.".into()));
    }
    memory(&state, keeper)?.unpin_scene(&id).await;
    Ok(())
}
