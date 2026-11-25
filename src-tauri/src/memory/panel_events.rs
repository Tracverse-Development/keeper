//! What the person did in a panel, kept on the keeper's graph: a ticked checklist item, a quiz
//! answer, a flashcard marked known or not, a submitted form, a fact pinned. One `desk:PanelEvent`
//! asset each. They feed back in: quiz streaks (`streak`), recent practice into the next turn's
//! context (`practice`), and pinned facts ranking first (`pinned`).

use std::collections::HashSet;

use crate::dkg::ontology::{entity, pred, ASSISTANT};
use crate::dkg::{AssetBuilder, Layer, Quad};
use crate::kernel::slug::short_hash;
use crate::kernel::{time, Result};

use super::records::{Fact, Record};
use super::Memory;

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX prov: <http://www.w3.org/ns/prov#> ";

#[derive(Debug, Clone)]
pub struct PanelEvent {
    /// "check", "quiz", "card", "submit", "pin".
    pub kind: String,
    pub panel: String,
    pub item: String,
    /// "yes"/"no" for check, quiz (correct), card (known); the values for submit; the fact id for pin.
    pub value: String,
    pub at: String,
}

impl Record for PanelEvent {
    fn asset_name(&self) -> String {
        format!("desk-panelevent-{}", short_hash(&format!("{}\u{0}{}\u{0}{}\u{0}{}", self.at, self.kind, self.panel, self.item), 16))
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("panelevent", &short_hash(&format!("{}{}{}", self.at, self.kind, self.item), 16)))
            .a("desk:PanelEvent")
            .text("desk:eventKind", &self.kind)
            .text("desk:panel", &self.panel)
            .text("desk:item", &self.item)
            .text("desk:value", &self.value)
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

impl PanelEvent {
    pub fn new(kind: &str, panel: &str, item: &str, value: &str) -> PanelEvent {
        let clip = |s: &str, n: usize| s.chars().take(n).collect::<String>();
        PanelEvent { kind: kind.into(), panel: clip(panel, 160), item: clip(item, 300), value: clip(value, 1200), at: time::now_iso() }
    }
}

impl Memory {
    /// The latest events of one kind (a validated literal from a fixed list), newest first.
    async fn events_of(&self, kind: &'static str, limit: usize) -> Result<Vec<(String, String)>> {
        let sparql = format!("{PREFIXES}SELECT ?item ?value ?at WHERE {{ ?e a desk:PanelEvent ; desk:eventKind \"{kind}\" ; desk:item ?item ; desk:value ?value ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT {limit}");
        let rows = self.client().query(self.graph(), &sparql, Layer::Working).await?;
        Ok(rows.into_iter().map(|r| (r.get("item").cloned().unwrap_or_default(), r.get("value").cloned().unwrap_or_default())).collect())
    }

    /// Right quiz answers in a row, counting back from the latest.
    pub async fn streak(&self) -> u32 {
        let results = self.events_of("quiz", 50).await.unwrap_or_default();
        results.iter().take_while(|(_, v)| v == "yes").count() as u32
    }

    /// Recent practice as facts for the next turn ("You answered 'What is 7 x 8?' wrong").
    pub async fn practice(&self) -> Vec<Fact> {
        let mut out = Vec::new();
        for (kind, words_yes, words_no) in [("quiz", "right", "wrong"), ("card", "knew", "didn't know yet")] {
            for (item, value) in self.events_of(if kind == "quiz" { "quiz" } else { "card" }, 6).await.unwrap_or_default() {
                let verdict = if value == "yes" { words_yes } else { words_no };
                let text = if kind == "quiz" { format!("You answered \"{item}\" {verdict}") } else { format!("You {verdict} the flashcard \"{item}\"") };
                out.push(Fact::new(&text, "practice", &time::now_iso()));
            }
        }
        out
    }

    /// Fact ids the person pinned.
    pub async fn pinned(&self) -> HashSet<String> {
        self.events_of("pin", 200).await.unwrap_or_default().into_iter().map(|(_, v)| v).collect()
    }
}
