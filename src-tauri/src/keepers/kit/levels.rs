//! Experience and levels: a keeper grows by being used. XP is DERIVED from its own graph (turns,
//! lessons, quiz answers right, actions done on the computer), never stored as a counter, so it
//! cannot be bought or edited by hand. Levels unlock items by rarity (`rarity.rs`) and features
//! (`UNLOCKS`). Design: `docs/design/keeper-ecosystem.md`.

use serde::Serialize;

use crate::dkg::Layer;
use crate::memory::Memory;

/// XP per thing done.
pub const XP_TURN: u64 = 10;
pub const XP_LESSON: u64 = 25;
pub const XP_QUIZ_RIGHT: u64 = 15;
pub const XP_ACTION: u64 = 20;

/// A feature a level opens.
#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
pub struct Unlock {
    pub level: u32,
    pub id: &'static str,
    pub name: &'static str,
}

pub const UNLOCKS: &[Unlock] = &[
    Unlock { level: 2, id: "uncommon-items", name: "Uncommon items" },
    Unlock { level: 3, id: "idle-effects", name: "Idle effects" },
    Unlock { level: 4, id: "rare-items", name: "Rare items" },
    Unlock { level: 5, id: "photo-pendant", name: "A pendant with your own photo" },
    Unlock { level: 6, id: "celebrate-effects", name: "Celebration effects" },
    Unlock { level: 8, id: "photo-shirt", name: "A T-shirt printed with your own image" },
    Unlock { level: 10, id: "legendary-items", name: "Legendary items" },
    Unlock { level: 15, id: "mythical-items", name: "Mythical items" },
];

/// XP needed to REACH level `n` (level 1 at 100, 5 at 1,500, 10 at 5,500).
pub fn xp_for_level(n: u32) -> u64 {
    50 * u64::from(n) * (u64::from(n) + 1)
}

/// The level `xp` has reached (0 before the first 100 XP).
pub fn level_for(xp: u64) -> u32 {
    let mut n = 0;
    while xp >= xp_for_level(n + 1) {
        n += 1;
    }
    n
}

/// What counts towards XP, read from the keeper's graph.
#[derive(Debug, Serialize, Default, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Done {
    pub turns: u64,
    pub lessons: u64,
    pub quiz_right: u64,
    pub actions: u64,
}

impl Done {
    pub fn xp(&self) -> u64 {
        self.turns * XP_TURN + self.lessons * XP_LESSON + self.quiz_right * XP_QUIZ_RIGHT + self.actions * XP_ACTION
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    pub xp: u64,
    pub level: u32,
    /// XP where this level started and where the next begins (for a progress bar).
    pub level_xp: u64,
    pub next_xp: u64,
    pub done: Done,
    /// Everything opened so far, and what the next level opens.
    pub unlocked: Vec<Unlock>,
    pub next_unlocks: Vec<Unlock>,
}

impl Experience {
    pub fn from_done(done: Done) -> Experience {
        let xp = done.xp();
        let level = level_for(xp);
        let next = UNLOCKS.iter().map(|u| u.level).find(|l| *l > level);
        Experience {
            xp,
            level,
            level_xp: xp_for_level(level),
            next_xp: xp_for_level(level + 1),
            done,
            unlocked: UNLOCKS.iter().filter(|u| u.level <= level).copied().collect(),
            next_unlocks: UNLOCKS.iter().filter(|u| Some(u.level) == next).copied().collect(),
        }
    }

    /// May this keeper wear an item of `rarity` (its level is high enough)?
    pub fn may_wear(&self, rarity: &super::rarity::Rarity) -> bool {
        self.level.max(1) >= rarity.level
    }
}

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> ";

/// One bounded count over the keeper's graph (one class per query: LES-001).
async fn count(memory: &Memory, body: &str) -> u64 {
    let sparql = format!("{PREFIXES}SELECT (COUNT(?s) AS ?n) WHERE {{ {body} }}");
    memory
        .client()
        .query(memory.graph(), &sparql, Layer::Working)
        .await
        .ok()
        .and_then(|rows| rows.first().and_then(|r| r.get("n").and_then(|n| n.parse().ok())))
        .unwrap_or(0)
}

/// The keeper's experience, read from its graph (four small counts, run together).
pub async fn experience(memory: &Memory) -> Experience {
    let (turns, lessons, quiz_right, actions) = tokio::join!(
        count(memory, "?s a desk:Turn"),
        count(memory, "?s a desk:Turn ; desk:panels ?p . FILTER(STRLEN(?p) > 2)"),
        count(memory, "?s a desk:PanelEvent ; desk:eventKind \"quiz\" ; desk:value \"yes\""),
        count(memory, "?s a desk:Action"),
    );
    Experience::from_done(Done { turns, lessons, quiz_right, actions })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_follow_the_curve() {
        assert_eq!(level_for(0), 0);
        assert_eq!(level_for(99), 0);
        assert_eq!(level_for(100), 1);
        assert_eq!(level_for(1_499), 4);
        assert_eq!(level_for(1_500), 5);
        assert_eq!(level_for(5_500), 10);
    }

    #[test]
    fn experience_counts_what_was_done_and_opens_by_level() {
        let e = Experience::from_done(Done { turns: 100, lessons: 10, quiz_right: 6, actions: 5 });
        assert_eq!(e.xp, 100 * 10 + 10 * 25 + 6 * 15 + 5 * 20);
        assert_eq!(e.level, 4);
        let has = |id: &str| e.unlocked.iter().any(|u| u.id == id);
        assert!(has("rare-items") && !has("photo-pendant"));
        assert_eq!(e.next_unlocks.iter().map(|u| u.id).collect::<Vec<_>>(), ["photo-pendant"]);
        assert!(e.may_wear(super::super::rarity::get("rare").unwrap()));
        assert!(!e.may_wear(super::super::rarity::get("legendary").unwrap()));
        let new = Experience::from_done(Done::default());
        assert!(new.may_wear(super::super::rarity::get("common").unwrap()), "a brand-new keeper wears common items");
        assert!(UNLOCKS.windows(2).all(|w| w[0].level <= w[1].level));
    }
}
