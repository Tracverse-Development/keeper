//! The scene cache: a Stage answer kept on the DKG under its question, so asking again (or
//! clicking a card whose scene was pre-built in the background) opens instantly. One
//! `desk:CachedScene` asset per normalised question, keyed by a hash of it; looking one up is a
//! single bounded query on that key (a validated hex id, never the person's words).

use crate::dkg::ontology::{entity, pred, ASSISTANT};
use crate::dkg::{AssetBuilder, Layer, Quad};
use crate::kernel::slug::short_hash;
use crate::kernel::Result;
use crate::stage::Panel;

use super::records::Record;
use super::Memory;

/// Case, spacing and final punctuation don't make a different question.
pub fn key(question: &str) -> String {
    let norm = question.split_whitespace().collect::<Vec<_>>().join(" ").trim_end_matches(['.', '!', '?']).to_lowercase();
    short_hash(&norm, 16)
}

/// Only lessons and panel follow-ups are kept and replayed: the same explanation is right next
/// week too, while "what's on today" or "how's my computer" must be answered fresh.
pub fn cacheable(question: &str) -> bool {
    let q = question.trim_start().to_lowercase();
    const LESSONS: [&str; 9] = ["about \"", "explain", "teach me", "what is ", "what are ", "how does ", "how do ", "show me how", "why does "];
    const FRESH: [&str; 8] = ["today", "tomorrow", "now", "latest", "this week", "my ", "weather", "news"];
    LESSONS.iter().any(|p| q.starts_with(p)) && (q.starts_with("about \"") || !FRESH.iter().any(|w| q.contains(w)))
}

/// The follow-up the window sends when a card is clicked (`focusQuestion(cardWhat(..))` in
/// `src/kernel/panel-spec.ts` and `src/stage/focus.ts`; `structure.test.ts` keeps them equal).
pub fn card_question(panel_title: &str, card_title: &str) -> String {
    format!("About \"{panel_title}\": explain the card {card_title}. Show it step by step in a panel if that helps.")
}

#[derive(Debug, Clone)]
pub struct CachedScene {
    pub key: String,
    pub question: String,
    pub reply: String,
    pub panels: Vec<Panel>,
    pub at: String,
}

impl CachedScene {
    /// The scene to keep for this question (None when it showed nothing).
    pub fn new(question: &str, reply: &str, panels: &[Panel]) -> Option<CachedScene> {
        (!panels.is_empty()).then(|| CachedScene { key: key(question), question: question.to_string(), reply: reply.to_string(), panels: panels.to_vec(), at: crate::kernel::time::now_iso() })
    }
}

impl Record for CachedScene {
    fn asset_name(&self) -> String {
        // A new version each time (finalized assets never change); the lookup takes the newest.
        format!("desk-scene-{}-{}", self.key, short_hash(&self.at, 10))
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("scene", &self.key))
            .a("desk:CachedScene")
            .text("desk:key", &self.key)
            .text(pred::SAID, &self.question)
            .text(pred::REPLIED, &self.reply)
            .text(pred::PANELS, &serde_json::to_string(&self.panels).unwrap_or_default())
            .link(pred::BY, ASSISTANT)
            .time(pred::AT, &self.at)
            .build()
    }
}

impl Memory {
    /// The cached scene for this exact question, if one was kept.
    pub async fn cached_scene(&self, question: &str) -> Result<Option<CachedScene>> {
        let k = key(question);
        let sparql = format!(
            "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX prov: <http://www.w3.org/ns/prov#> \
             SELECT ?replied ?panels ?at WHERE {{ ?s a desk:CachedScene ; desk:key \"{k}\" ; desk:replied ?replied ; desk:panels ?panels ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT 1"
        );
        let rows = self.client().query(self.graph(), &sparql, Layer::Working).await?;
        Ok(rows.into_iter().next().and_then(|r| {
            let panels = serde_json::from_str::<serde_json::Value>(r.get("panels")?).ok().map(|v| crate::stage::read(&v))?;
            (!panels.is_empty()).then(|| CachedScene { key: k.clone(), question: question.to_string(), reply: r.get("replied").cloned().unwrap_or_default(), panels, at: r.get("at").cloned().unwrap_or_default() })
        }))
    }

    /// Keep a scene under its question.
    pub async fn cache_scene(&self, question: &str, reply: &str, panels: &[Panel]) {
        if let Some(scene) = CachedScene::new(question, reply, panels) {
            self.write(&scene).await;
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_same_question_is_the_same_key() {
        assert_eq!(super::key("Explain addition."), super::key("  explain   ADDITION "));
        assert_ne!(super::key("explain addition"), super::key("explain subtraction"));
        assert_eq!(super::key(&super::card_question("The four building blocks", "Addition")).len(), 16);
    }

    #[test]
    fn only_lessons_are_replayed() {
        assert!(super::cacheable("Explain fractions visually"));
        assert!(super::cacheable(&super::card_question("Blocks", "Addition")));
        assert!(!super::cacheable("What is on today?"));
        assert!(!super::cacheable("Explain my calendar"));
        assert!(!super::cacheable("Brief me"));
    }
}
