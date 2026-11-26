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

/// The level each keeper was last seen at (this run of Keeper), to notice a level up.
static SEEN: std::sync::Mutex<Option<std::collections::HashMap<String, u32>>> = std::sync::Mutex::new(None);

/// Remember `level` for `keeper`; returns the previous level when this is a level UP (the first
/// look at a keeper only records it, so opening Keeper never "levels up").
pub fn record_level(keeper: &str, level: u32) -> Option<u32> {
    let mut seen = SEEN.lock().ok()?;
    let map = seen.get_or_insert_with(std::collections::HashMap::new);
    let before = map.insert(keeper.to_string(), level)?;
    (level > before).then_some(before)
}

/// After a turn is written: read the keeper's experience and, on a new level, tell the window
/// what opened (`events::LEVEL_UP`), so it can celebrate. Runs off the reply path.
pub fn check_level_up(app: &tauri::AppHandle, keeper: String, memory: Memory) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Some(e) = experience(&memory).await else { return };
        if let Some(before) = record_level(&keeper, e.level) {
            let unlocked: Vec<&Unlock> = UNLOCKS.iter().filter(|u| u.level > before && u.level <= e.level).collect();
            use tauri::Emitter;
            let _ = app.emit(crate::kernel::events::LEVEL_UP, serde_json::json!({ "keeper": keeper, "level": e.level, "unlocked": unlocked }));
        }
    });
}

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> ";

/// One bounded count over the keeper's own place (one class per query: LES-001).
async fn count(memory: &Memory, body: &str) -> crate::kernel::Result<u64> {
    let sparql = format!("{PREFIXES}SELECT (COUNT(?s) AS ?n) WHERE {{ {body} }}");
    let rows = memory.client().query(memory.place(), &sparql, Layer::Working).await?;
    Ok(rows.first().and_then(|r| r.get("n").and_then(|n| n.parse().ok())).unwrap_or(0))
}

/// The keeper's experience, read from its graph (four small counts, run together), only when
/// every count was answered: a node that is down must never look like level 0 (the next
/// message would "level up", and items would lock). The error is the node's real one, so what
/// is shown says what actually failed.
pub async fn experience_or_why(memory: &Memory) -> crate::kernel::Result<Experience> {
    let (turns, lessons, quiz_right, actions) = tokio::join!(
        count(memory, "?s a desk:Turn"),
        count(memory, "?s a desk:Turn ; desk:panels ?p . FILTER(STRLEN(?p) > 2)"),
        count(memory, "?s a desk:PanelEvent ; desk:eventKind \"quiz\" ; desk:value \"yes\""),
        count(memory, "?s a desk:Action"),
    );
    Ok(Experience::from_done(Done { turns: turns?, lessons: lessons?, quiz_right: quiz_right?, actions: actions? }))
}

/// `experience_or_why` where only "could it be read" matters.
pub async fn experience(memory: &Memory) -> Option<Experience> {
    experience_or_why(memory).await.ok()
}

/// The sentence shown when a keeper's level could not be read: what was wanted, then why.
pub fn unread(keeper_name: &str, why: &crate::kernel::DeskError) -> crate::kernel::DeskError {
    crate::kernel::DeskError::Node(format!("I couldn't read {keeper_name}'s level. {why}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_level_up_is_noticed_once_and_never_on_first_sight() {
        assert_eq!(record_level("lvl-test", 3), None, "first sight only records");
        assert_eq!(record_level("lvl-test", 3), None);
        assert_eq!(record_level("lvl-test", 4), Some(3));
        assert_eq!(record_level("lvl-test", 4), None);
    }

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
