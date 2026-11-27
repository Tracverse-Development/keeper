//! Seasons: a small official set that is open for a few weeks. Each item has a QUEST tied to
//! something useful the person did with their keeper during the season (focus sessions finished,
//! quiz answers right, lessons taken), counted from the keeper's own graph. A finished quest lets
//! the person claim the item; a claimed item is theirs to keep (it is saved to their kit like any
//! item they made) after the season closes.
//!
//! Never a quest about time spent, opening the app, streaks or anything bought: the feelings
//! safety rules ("nothing is tuned to increase time spent") bind seasons too, and a test holds
//! the list of quest kinds to that.

use chrono::NaiveDate;
use serde::Serialize;

use crate::dkg::Layer;
use crate::memory::Memory;

/// What a quest counts (each a finished, useful thing; see the module note).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum QuestKind {
    /// Focus sessions that ran to their end (`focus`).
    FocusSessions,
    /// Quiz answers that were right.
    QuizRight,
    /// Lessons: answers shown as panels on the Stage.
    Lessons,
}

pub struct Quest {
    pub kind: QuestKind,
    pub goal: u64,
    /// What to do, as a short instruction ("Finish 3 focus sessions").
    pub words: &'static str,
}

pub struct SeasonItem {
    pub id: &'static str,
    pub name: &'static str,
    pub part: &'static str,
    /// Effect values as JSON (validated against the part's schema like any item).
    pub effects: &'static str,
    pub blurb: &'static str,
    pub quest: Quest,
}

pub struct Season {
    pub id: &'static str,
    pub name: &'static str,
    /// The first and the last day it is open (the person's own calendar days, YYYY-MM-DD).
    pub opens: &'static str,
    pub closes: &'static str,
    pub items: &'static [SeasonItem],
}

pub const SEASONS: &[Season] = &[Season {
    id: "first-light",
    name: "First Light",
    opens: "2026-11-27",
    closes: "2027-01-04",
    items: &[
        SeasonItem { id: "lantern-halo", name: "Lantern Halo", part: "memory-halo", effects: r##"{"color":"#ffb347","spinIdle":0.8,"spinWork":3.5,"nodes":90}"##, blurb: "A warm amber orbit, lit by steady work.", quest: Quest { kind: QuestKind::FocusSessions, goal: 3, words: "Finish 3 focus sessions" } },
        SeasonItem { id: "evergreen-scarf", name: "Evergreen Scarf", part: "knit-scarf", effects: r##"{"color":"#1f6f4a","stripe":"#f4eee2","sway":1}"##, blurb: "Deep green with a cream stripe.", quest: Quest { kind: QuestKind::QuizRight, goal: 10, words: "Get 10 quiz answers right" } },
        SeasonItem { id: "starlit-cap", name: "Starlit Cap", part: "crew-cap", effects: r##"{"color":"#151c33","trim":"#f0c98a"}"##, blurb: "Night blue with a gold edge.", quest: Quest { kind: QuestKind::Lessons, goal: 5, words: "Take 5 lessons" } },
    ],
}];

fn day(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// The season open on `today`, if any.
pub fn open_on(today: NaiveDate) -> Option<&'static Season> {
    SEASONS.iter().find(|s| matches!((day(s.opens), day(s.closes)), (Some(a), Some(b)) if a <= today && today <= b))
}

/// Whole days left including today (1 on the last day).
pub fn days_left(season: &Season, today: NaiveDate) -> i64 {
    day(season.closes).map(|end| (end - today).num_days() + 1).unwrap_or(0).max(0)
}

/// The id a claimed item has in the person's kit (its own namespace, so it can never collide
/// with something they named themselves by accident).
pub fn kit_id(season: &Season, item: &SeasonItem) -> String {
    format!("season-{}-{}", season.id, item.id)
}

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX prov: <http://www.w3.org/ns/prov#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> ";

/// How many of a quest's things the keeper's graph holds since the season opened (one bounded
/// count naming its class); None when the node did not answer (never read as zero progress
/// that could un-earn something, nor as progress).
pub async fn done(memory: &Memory, season: &Season, kind: QuestKind) -> Option<u64> {
    let since = format!("{}T00:00:00Z", season.opens);
    let what = match kind {
        QuestKind::FocusSessions => "?s a desk:Action ; desk:skill \"focus\" ; prov:generatedAtTime ?at .".to_string(),
        QuestKind::QuizRight => "?s a desk:PanelEvent ; desk:eventKind \"quiz\" ; desk:value \"yes\" ; prov:generatedAtTime ?at .".to_string(),
        QuestKind::Lessons => "?s a desk:Turn ; desk:panels ?p ; prov:generatedAtTime ?at . FILTER(STRLEN(?p) > 2)".to_string(),
    };
    let sparql = format!("{PREFIXES}SELECT (COUNT(?s) AS ?n) WHERE {{ {what} FILTER(?at >= \"{since}\"^^xsd:dateTime) }}");
    memory.client().query(memory.place(), &sparql, Layer::Working).await.ok().map(|rows| rows.first().and_then(|r| r.get("n").and_then(|n| n.parse().ok())).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_season_is_valid_and_its_quests_are_about_useful_things_done() {
        for s in SEASONS {
            let (opens, closes) = (day(s.opens).expect(s.id), day(s.closes).expect(s.id));
            assert!(opens <= closes && (closes - opens).num_days() <= 60, "{}: a few weeks, not forever", s.id);
            assert!(!s.items.is_empty());
            for i in s.items {
                let effects: std::collections::BTreeMap<String, serde_json::Value> = serde_json::from_str(i.effects).expect(i.id);
                let worn = super::super::parts::check_effects(&super::super::parts::WornPart { part: i.part.into(), effects: effects.clone(), item: None, rarity: None, set: None }).expect(i.id);
                assert_eq!(worn.effects.len(), effects.len(), "{}: every effect is in its part's schema and range", i.id);
                assert!(i.quest.goal >= 1 && i.quest.goal <= 30, "{}: a quest a person can finish in the season", i.id);
                // The only things a quest may count: finished, useful things. Adding a kind
                // (time spent, days opened, a streak) must be a deliberate change here.
                assert!(matches!(i.quest.kind, QuestKind::FocusSessions | QuizRight | Lessons));
            }
        }
    }

    #[test]
    fn a_season_is_open_only_between_its_days() {
        let s = &SEASONS[0];
        let d = |x: &str| day(x).unwrap();
        assert!(open_on(d("2026-11-26")).is_none());
        assert_eq!(open_on(d("2026-11-27")).map(|s| s.id), Some("first-light"));
        assert_eq!(open_on(d("2027-01-04")).map(|s| s.id), Some("first-light"));
        assert!(open_on(d("2027-01-05")).is_none());
        assert_eq!((days_left(s, d("2027-01-04")), days_left(s, d("2027-01-03")), days_left(s, d("2027-02-01"))), (1, 2, 0));
        assert_eq!(kit_id(s, &s.items[0]), "season-first-light-lantern-halo");
    }

    use QuestKind::{Lessons, QuizRight};
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::{node, DkgClient, Place};
    use crate::memory::ActionRecord;

    /// The real node: a finished focus session counts for a season that is open, and not for
    /// one that opens later. `cargo test --lib live_season -- --ignored --nocapture`
    /// (writes only to `umoja-desk-seasontest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_season_counts_only_what_was_done_since_it_opened() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = format!("umoja-desk-seasontest-{}", chrono::Utc::now().timestamp_millis());
        client.ensure_graph(&graph, "season test").await.unwrap();
        // In a SUB-GRAPH, the way a real keeper's memory is kept (FIX-0026).
        client.ensure_sub_graph(&graph, "keeper-t").await.unwrap();
        let memory = Memory::at(client, Place::new(&graph, Some("keeper-t")));
        for i in 0..2 {
            let at = crate::kernel::time::iso(crate::kernel::time::now() - chrono::Duration::minutes(i));
            memory.write(&ActionRecord::new("focus", "25 minutes", "Focused for 25 minutes.", true, &at, "")).await;
        }
        memory.write(&ActionRecord::new("open-app", "Notes", "Opened Notes", true, &crate::kernel::time::now_iso(), "")).await;
        let open = Season { id: "t", name: "T", opens: "2026-01-01", closes: "2099-01-01", items: &[] };
        let later = Season { id: "t", name: "T", opens: "2099-01-01", closes: "2099-02-01", items: &[] };
        assert_eq!(done(&memory, &open, QuestKind::FocusSessions).await, Some(2), "two focus sessions, not the other action");
        assert_eq!(done(&memory, &later, QuestKind::FocusSessions).await, Some(0), "nothing counts before a season opens");
        assert_eq!(done(&memory, &open, QuestKind::QuizRight).await, Some(0));
        // FIX-0026: the level is read from the keeper's own sub-graph (it could not be read at
        // all once memory lived in one), and counts only what is in it.
        let level = crate::keepers::kit::levels::experience(&memory).await.expect("the level reads in a sub-graph");
        assert_eq!(level.done.actions, 3, "{level:?}");
        assert!(memory.pinned_scenes().await.is_ok(), "pins read there too");
    }
}
