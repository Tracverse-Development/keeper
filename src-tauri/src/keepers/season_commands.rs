//! The season's commands (`kit::seasons`): what is open now with this keeper's progress on each
//! quest, and claiming an item whose quest is finished. Progress is counted here, from the
//! keeper's graph, every time: the window never says what was earned. A claimed item is saved to
//! the person's kit as an ordinary item (`season-<season>-<item>`), theirs after the season ends.

use std::collections::BTreeMap;

use serde::Serialize;
use tauri::State;

use super::kit::packs::Variant;
use super::kit::seasons::{self, Season, SeasonItem};
use super::kit::{inventory, parts};
use crate::kernel::{DeskError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonQuest {
    pub id: &'static str,
    pub name: &'static str,
    pub part: &'static str,
    pub slot: &'static str,
    pub effects: BTreeMap<String, serde_json::Value>,
    pub blurb: &'static str,
    /// What to do ("Finish 3 focus sessions"), how far along, and the goal.
    pub quest: &'static str,
    pub done: u64,
    pub goal: u64,
    pub earned: bool,
    /// Already in the person's kit.
    pub claimed: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonNow {
    pub id: &'static str,
    pub name: &'static str,
    /// The last day it is open (YYYY-MM-DD) and the days left, today included.
    pub closes: &'static str,
    pub days_left: i64,
    pub items: Vec<SeasonQuest>,
}

fn today() -> chrono::NaiveDate {
    chrono::Local::now().date_naive()
}

fn worn(item: &SeasonItem) -> Option<parts::WornPart> {
    let effects: BTreeMap<String, serde_json::Value> = serde_json::from_str(item.effects).ok()?;
    parts::check_effects(&parts::WornPart { part: item.part.into(), effects, item: None }).ok()
}

/// One item with the keeper's progress; `claimed_ids` are the season items already in the kit.
fn quest(season: &Season, item: &SeasonItem, done: u64, claimed_ids: &[String]) -> Option<SeasonQuest> {
    let worn = worn(item)?;
    Some(SeasonQuest {
        id: item.id,
        name: item.name,
        part: item.part,
        slot: parts::get(item.part)?.slot,
        effects: worn.effects,
        blurb: item.blurb,
        quest: item.quest.words,
        done: done.min(item.quest.goal),
        goal: item.quest.goal,
        earned: done >= item.quest.goal,
        claimed: claimed_ids.contains(&seasons::kit_id(season, item)),
    })
}

async fn view(state: &AppState, keeper: &str, season: &'static Season) -> Result<SeasonNow> {
    let unread = || DeskError::Io("I couldn't read your progress just now. Try again in a moment.".into());
    let memory = state.memory_for(&state.keeper_or_active(keeper)?)?;
    let client = state.client()?;
    let kit = inventory::kit(&client, &state.kit_place()).await?;
    let claimed: Vec<String> = inventory::variants(&client, &kit).await.map_err(|_| unread())?.into_iter().map(|v| v.id).collect();
    let mut items = Vec::new();
    for item in season.items {
        let done = seasons::done(&memory, season, item.quest.kind).await.ok_or_else(unread)?;
        items.extend(quest(season, item, done, &claimed));
    }
    Ok(SeasonNow { id: season.id, name: season.name, closes: season.closes, days_left: seasons::days_left(season, today()), items })
}

/// The season open today with this keeper's progress, or None when none is open.
#[tauri::command]
pub async fn season_now(state: State<'_, AppState>, keeper: Option<String>) -> Result<Option<SeasonNow>> {
    match seasons::open_on(today()) {
        Some(season) => Ok(Some(view(&state, keeper.as_deref().unwrap_or(""), season).await?)),
        None => Ok(None),
    }
}

/// Claim a season item whose quest this keeper finished: it is saved to the person's kit.
#[tauri::command]
pub async fn season_claim(state: State<'_, AppState>, keeper: Option<String>, item: String) -> Result<SeasonNow> {
    let keeper = keeper.unwrap_or_default();
    let season = seasons::open_on(today()).ok_or_else(|| DeskError::Invalid("No season is open right now.".into()))?;
    let now = view(&state, &keeper, season).await?;
    let wanted = season.items.iter().find(|i| i.id == item).ok_or_else(|| DeskError::Invalid("That item isn't part of this season.".into()))?;
    let progress = now.items.iter().find(|q| q.id == wanted.id).ok_or_else(|| DeskError::Invalid("That item can't be claimed.".into()))?;
    if progress.claimed {
        return Ok(now);
    }
    if !progress.earned {
        return Err(DeskError::Invalid(format!("Not yet: {} ({} of {}).", wanted.quest.words, progress.done, progress.goal)));
    }
    let worn = worn(wanted).ok_or_else(|| DeskError::Invalid("That item can't be claimed.".into()))?;
    let client = state.client()?;
    let kit = inventory::kit(&client, &state.kit_place()).await?;
    inventory::save_variant(&client, &kit, &Variant { id: seasons::kit_id(season, wanted), name: wanted.name.into(), worn, one_of_a_kind: false }).await?;
    view(&state, &keeper, season).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_item_is_earned_at_its_goal_and_claimed_only_when_it_is_in_the_kit() {
        let season = &seasons::SEASONS[0];
        let item = &season.items[0];
        let short = quest(season, item, item.quest.goal - 1, &[]).unwrap();
        assert!(!short.earned && !short.claimed && short.done == item.quest.goal - 1);
        let over = quest(season, item, item.quest.goal + 40, &[seasons::kit_id(season, item)]).unwrap();
        assert!(over.earned && over.claimed);
        assert_eq!(over.done, item.quest.goal, "progress is shown up to the goal");
        assert_eq!(over.slot, "halo");
        assert!(!quest(season, item, 99, &["season-other-thing".into()]).unwrap().claimed);
    }
}
