//! The wardrobe's commands: list the person's wardrobe (every item, which keepers wear it, which
//! bodies offer which slots), put an item on a keeper or take it off, give it to another keeper
//! (move or share), and make a new item of your own (saved to the kit graph on the DKG). The rules
//! live in `kit::wardrobe` (pure); here the items are read from the node and the keepers' outfits
//! saved to settings (only `wearables` changes, so nothing else a keeper holds is touched).

use std::collections::BTreeMap;

use serde::Serialize;
use tauri::State;

use super::kit::packs::{self, Variant};
use super::kit::wardrobe::{self, Give, Item};
use super::kit::{inventory, parts, slots, species};
use crate::kernel::settings::KeeperProfile;
use crate::kernel::{DeskError, Result};
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listed {
    #[serde(flatten)]
    pub item: Item,
    /// Keeper ids wearing it.
    pub worn_by: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperBody {
    pub id: String,
    pub name: String,
    pub species: String,
    /// The slots its body offers.
    pub slots: Vec<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Wardrobe {
    pub slots: &'static [slots::Slot],
    pub items: Vec<Listed>,
    pub keepers: Vec<KeeperBody>,
    /// False when the memory node could not be read: only the built-in items are listed.
    pub complete: bool,
}

/// The person's own items from the kit graph, and whether the node answered.
async fn own_items(state: &AppState) -> (Vec<Variant>, bool) {
    let Ok(client) = state.client() else { return (vec![], false) };
    match inventory::kit(&client, &state.kit_place()).await {
        Ok(graph) => match inventory::variants(&client, &graph).await {
            Ok(v) => (v, true),
            Err(_) => (vec![], false),
        },
        Err(_) => (vec![], false),
    }
}

fn listing(items: Vec<Item>, keepers: &[KeeperProfile], complete: bool) -> Wardrobe {
    let listed = items.iter().map(|i| Listed { item: i.clone(), worn_by: wardrobe::worn_by(i, keepers, &items) }).collect();
    let bodies = keepers
        .iter()
        .map(|k| KeeperBody { id: k.id.clone(), name: k.name.clone(), species: k.skin.clone(), slots: species::get(&k.skin).map(|s| s.slots.to_vec()).unwrap_or_default() })
        .collect();
    Wardrobe { slots: slots::SLOTS, items: listed, keepers: bodies, complete }
}

/// Runs a wardrobe rule over the keepers and saves each keeper's new outfit.
async fn change(state: &AppState, item: &str, rule: impl FnOnce(&mut Vec<KeeperProfile>, &Item, &[Item]) -> std::result::Result<(), String>) -> Result<Wardrobe> {
    let (own, complete) = own_items(state).await;
    let items = wardrobe::items(&own);
    let chosen = items.iter().find(|i| i.id == item).cloned().ok_or_else(|| DeskError::Invalid("That isn't in your wardrobe.".into()))?;
    let mut keepers = state.settings().keepers;
    rule(&mut keepers, &chosen, &items).map_err(DeskError::Invalid)?;
    let saved = state.update_settings(|s| {
        for k in s.keepers.iter_mut() {
            if let Some(changed) = keepers.iter().find(|c| c.id == k.id) {
                k.wearables = changed.wearables.clone();
            }
        }
    })?;
    Ok(listing(items, &saved.keepers, complete))
}

#[tauri::command]
pub async fn wardrobe_list(state: State<'_, AppState>) -> Result<Wardrobe> {
    let (own, complete) = own_items(&state).await;
    Ok(listing(wardrobe::items(&own), &state.settings().keepers, complete))
}

#[tauri::command]
pub async fn wardrobe_wear(state: State<'_, AppState>, keeper: String, item: String) -> Result<Wardrobe> {
    // Rarity is earned: a keeper wears an item only once its level reaches the item's rarity.
    let profile = state.keeper_or_active(&keeper)?;
    let experience = super::kit::levels::experience_or_why(&state.memory_for(&profile)?).await.map_err(|e| super::kit::levels::unread(&profile.name, &e))?;
    change(&state, &item, |keepers, chosen, items| {
        let rarity = super::kit::rarity::get(chosen.rarity).unwrap_or_else(|| super::kit::rarity::of_part(&chosen.part));
        if !experience.may_wear(rarity) {
            return Err(format!("{} is {}: {} needs level {} to wear it (now level {}).", chosen.name, rarity.name.to_lowercase(), profile.name, rarity.level, experience.level));
        }
        wardrobe::wear(keepers, &keeper, chosen, items)
    })
    .await
}

#[tauri::command]
pub async fn wardrobe_take_off(state: State<'_, AppState>, keeper: String, item: String) -> Result<Wardrobe> {
    change(&state, &item, |keepers, chosen, items| wardrobe::take_off(keepers, &keeper, chosen, items)).await
}

/// `mode`: "move" (the giver takes it off) or "share" (both wear it; designs only).
#[tauri::command]
pub async fn wardrobe_give(state: State<'_, AppState>, item: String, from: String, to: String, mode: String) -> Result<Wardrobe> {
    let how = Give::parse(&mode).ok_or_else(|| DeskError::Invalid("Choose to move it or share it.".into()))?;
    change(&state, &item, |keepers, chosen, items| wardrobe::give(keepers, chosen, &from, &to, how, items)).await
}

/// Share one wardrobe item as a `.keeper.json` pack in Downloads (data only: its part and effect
/// values, never who wears it). An official item travels as a plain variant: its rarity stays
/// with Keeper's catalogue and is not claimed by the file. Returns the file path.
#[tauri::command]
pub async fn wardrobe_share(state: State<'_, AppState>, item: String) -> Result<String> {
    let (own, _) = own_items(&state).await;
    let items = wardrobe::items(&own);
    let chosen = items.iter().find(|i| i.id == item).ok_or_else(|| DeskError::Invalid("That item isn't in your wardrobe.".into()))?;
    let variant = Variant { id: packs::slug(&chosen.name), name: chosen.name.clone(), worn: parts::WornPart { part: chosen.part.clone(), effects: chosen.effects.clone(), item: None }, one_of_a_kind: chosen.one_of_a_kind };
    let path = super::kit_commands::downloads_file(&chosen.name);
    std::fs::write(&path, packs::write(&packs::Pack::Variant { format: packs::FORMAT.into(), variant }, packs::clean_maker(&state.settings().maker_name, &state.settings().maker_link).as_ref())?)?;
    crate::platform::reveal(&path);
    Ok(path.display().to_string())
}

/// A wardrobe item designed from words, not yet saved: the Studio previews it on the keeper and
/// saves it with `wardrobe_add` if the person likes it.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Designed {
    pub name: String,
    pub part: String,
    pub effects: BTreeMap<String, serde_json::Value>,
}

/// The helper model's brief: every part with its slot, bodies and effect schema.
fn designer_brief() -> String {
    let list: Vec<String> = parts::PARTS
        .iter()
        .map(|p| {
            let effects: Vec<String> = p.effects.iter().map(|e| if e.kind == "color" { format!("{} (#rrggbb)", e.key) } else { format!("{} ({}..{})", e.key, e.min, e.max) }).collect();
            let bodies = if p.species.is_empty() { "any body".to_string() } else { p.species.join(", ") };
            format!("- {} \"{}\": slot {}, {}; effects: {}", p.id, p.name, p.slot, bodies, effects.join(", "))
        })
        .collect();
    format!(
        "You design wardrobe items for a keeper (a small animated character). Pick the ONE part that best fits the request and \
set its effects; invent a short, charming name (at most 40 characters). Answer ONLY with JSON: \
{{\"part\": string, \"name\": string, \"effects\": object}}. Use only these parts and effect keys, with values in range:\n{}",
        list.join("\n")
    )
}

/// Design an item from words ("a neon jacket with gold trim"), validated like any import:
/// a known part, effects only from its schema and in range, a clean name. Not saved.
#[tauri::command]
pub async fn wardrobe_design(state: State<'_, AppState>, description: String) -> Result<Designed> {
    let model = state.settings().fast_model;
    design(&description, if model.is_empty() { "haiku" } else { &model }).await
}

/// The designer itself (the command's body; tested live).
pub async fn design(description: &str, model: &str) -> Result<Designed> {
    let words: String = description.chars().take(300).collect();
    if words.trim().len() < 3 {
        return Err(DeskError::Invalid("Describe the item in a few words.".into()));
    }
    let raw = crate::brain::engines::claude::ask_json(&designer_brief(), &words, model).await?;
    let part = raw["part"].as_str().unwrap_or_default().to_string();
    let effects: BTreeMap<String, serde_json::Value> = raw["effects"].as_object().map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default();
    let worn = parts::check_effects(&parts::WornPart { part, effects, item: None }).map_err(DeskError::Invalid)?;
    let name = packs::clean_name(raw["name"].as_str().unwrap_or("My item")).unwrap_or_else(|_| "My item".into());
    Ok(Designed { name, part: worn.part, effects: worn.effects })
}

#[cfg(test)]
mod design_tests {
    #[tokio::test]
    #[ignore]
    async fn live_words_become_a_valid_item() {
        let t = std::time::Instant::now();
        let d = super::design("a neon pink jacket with gold trim", "haiku").await.expect("designed");
        println!("{:?} in {:?}", d, t.elapsed());
        assert_eq!(d.part, "ark-jacket");
        assert!(d.effects.get("color").and_then(|c| c.as_str()).is_some_and(|c| c.starts_with('#')));
        assert!(!d.name.is_empty());
    }
}

/// Make a new item of your own from a part and effect values (validated: known part, effects in
/// range, a short name). Saving an existing name again is that item's next version.
#[tauri::command]
pub async fn wardrobe_add(state: State<'_, AppState>, name: String, part: String, effects: BTreeMap<String, serde_json::Value>, one_of_a_kind: bool) -> Result<Wardrobe> {
    let name = packs::clean_name(&name).map_err(DeskError::Invalid)?;
    let worn = parts::check_effects(&parts::WornPart { part, effects, item: None }).map_err(DeskError::Invalid)?;
    let variant = Variant { id: packs::slug(&name), name, worn, one_of_a_kind };
    let client = state.client()?;
    inventory::save_variant(&client, &inventory::kit(&client, &state.kit_place()).await?, &variant).await?;
    let (own, complete) = own_items(&state).await;
    Ok(listing(wardrobe::items(&own), &state.settings().keepers, complete))
}
