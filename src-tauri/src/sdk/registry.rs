//! The registry: the one list of packs, and every question asked of the abilities (Registry
//! pattern). Only abilities for the system this build runs on are offered or run.

use super::{packs, this_platform, Ability, ActionRequest, Cx, Outcome};
use crate::keepers::kit::roles::Role;

/// Every pack, in the order the mind hears them. A new pack is one line here.
const PACKS: &[&[Ability]] = &[packs::reminders::ABILITIES, packs::calendar::ABILITIES, packs::personal::ABILITIES, packs::desktop::ABILITIES, packs::core::ABILITIES];

/// Every watch (what keepers check on their own, `sdk::watch`). A new watch is one line here.
pub const WATCHES: &[&super::watch::Watch] = &[&packs::calendar::heads_up::HEADS_UP];

/// Every ability this system offers.
pub fn all() -> impl Iterator<Item = &'static Ability> {
    PACKS.iter().flat_map(|pack| pack.iter()).filter(|a| a.platforms.contains(&this_platform()))
}

/// The ability called `id`, if this system offers it.
pub fn find(id: &str) -> Option<&'static Ability> {
    all().find(|a| a.id == id)
}

/// Every ability's name (what a mode may list).
pub fn names() -> Vec<&'static str> {
    all().map(|a| a.id).collect()
}

/// The abilities a mode may use, as the mind is told them (it never hears of the others).
pub fn catalogue_for(mode: &Role) -> String {
    let list: Vec<String> = all().filter(|a| mode.allows(a.id)).map(|a| format!("- {}: {}", a.id, a.how)).collect();
    if list.is_empty() { "(none in this mode)".into() } else { list.join("\n") }
}

/// Runs what the mind asked for; any failure becomes an [`Outcome`] the keeper can say.
pub async fn run(req: &ActionRequest, cx: &Cx<'_>) -> Outcome {
    let input = req.input.to_string();
    let result = match find(&req.skill) {
        Some(ability) => (ability.run)(&req.input, cx).await,
        None => Err(crate::kernel::DeskError::Invalid(format!("I don't have a skill called {} yet.", req.skill))),
    };
    match result {
        Ok(done) => Outcome { skill: req.skill.clone(), input, summary: done.summary, succeeded: true, effect: done.effect, panels: done.panels, answers: done.answers },
        Err(e) => Outcome { skill: req.skill.clone(), input, summary: e.to_string(), succeeded: false, effect: None, panels: Vec::new(), answers: false },
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    #[test]
    fn every_ability_has_its_own_name_and_says_how_to_call_it() {
        let mut seen = HashSet::new();
        for pack in super::PACKS {
            for a in pack.iter() {
                assert!(seen.insert(a.id), "two abilities are called {}", a.id);
                assert!(a.id.chars().all(|c| c.is_ascii_lowercase() || c == '-'), "{} is not a kebab-case name", a.id);
                assert!(!a.how.trim().is_empty() && !a.platforms.is_empty(), "{} needs how and platforms", a.id);
            }
        }
    }

    #[test]
    fn the_skills_modes_name_still_exist() {
        // The built-in modes list skills by name: a rename would silently take one away.
        for id in ["remind", "add-event", "find-contact", "open-app", "open-website", "recall-actions", "ask-memory", "switch-engine", "list-reminders", "upcoming"] {
            assert!(super::PACKS.iter().flat_map(|p| p.iter()).any(|a| a.id == id), "{id} is missing");
        }
    }
}
