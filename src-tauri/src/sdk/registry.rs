//! The registry: the one list of packs, and every question asked of the abilities (Registry
//! pattern). Only abilities for the system this build runs on are offered or run.

use super::{packs, this_platform, Ability, Access, ActionRequest, Cx, Outcome};
use crate::keepers::kit::roles::Role;

/// Every pack, in the order the mind hears them. A new pack is one line here.
const PACKS: &[&[Ability]] = &[
    packs::reminders::ABILITIES,
    packs::calendar::ABILITIES,
    // Before `core`: "Good morning! What do you know about me?" is the brief.
    packs::day::ABILITIES,
    packs::personal::ABILITIES,
    packs::desktop::ABILITIES,
    packs::files::ABILITIES,
    packs::files::find::ABILITIES,
    packs::video::ABILITIES,
    packs::core::ABILITIES,
    packs::computer::look::ABILITIES,
    packs::computer::open::ABILITIES,
    packs::computer::change::ABILITIES,
    packs::everyday::ABILITIES,
];

/// Every watch (what keepers check on their own, `sdk::watch`). A new watch is one line here.
pub const WATCHES: &[&super::watch::Watch] = &[&packs::calendar::heads_up::HEADS_UP];

/// Every ability this system offers.
pub fn all() -> impl Iterator<Item = &'static Ability> {
    PACKS.iter().flat_map(|pack| pack.iter()).filter(|a| a.platforms.contains(&this_platform()))
}

/// Every ability the mind can be offered: all but the instant-only ones (`Instant::Only`,
/// which only the person's own words run). Modes, the Studio and the catalogue read this.
pub fn for_the_mind() -> impl Iterator<Item = &'static Ability> {
    all().filter(|a| !a.instant.only())
}

/// The ability called `id`, if this system offers it.
pub fn find(id: &str) -> Option<&'static Ability> {
    all().find(|a| a.id == id)
}

/// The abilities a built-in mode offers by default (each ability names its modes).
pub fn defaults_for(mode: &str) -> Vec<&'static str> {
    all().filter(|a| a.modes.contains(&mode)).map(|a| a.id).collect()
}

/// Every ability's name a mode may list (instant-only ones need no listing: every mode has them).
pub fn names() -> Vec<&'static str> {
    for_the_mind().map(|a| a.id).collect()
}

/// The abilities a mode may use, as the mind is told them (it never hears of the others).
pub fn catalogue_for(mode: &Role) -> String {
    let list: Vec<String> = for_the_mind().filter(|a| mode.allows(a.id)).map(|a| format!("- {}: {}", a.id, a.how)).collect();
    if list.is_empty() { "(none in this mode)".into() } else { list.join("\n") }
}

/// Whether an ability with this access may run for a request made at the Mac (`at_the_mac`) or
/// over the phone link: a phone can ask and look, never change this Mac.
pub fn may_run_from(access: Access, at_the_mac: bool) -> bool {
    at_the_mac || access != Access::Change
}

/// Runs what the mind asked for; any failure becomes an [`Outcome`] the keeper can say.
pub async fn run(req: &ActionRequest, cx: &Cx<'_>) -> Outcome {
    let input = req.input.to_string();
    let result = match find(&req.skill) {
        // A phone on the Wi-Fi can ask and look, but never change this Mac (lock it, turn the volume up).
        Some(ability) if !may_run_from(ability.access, cx.at_the_mac) => Err(crate::kernel::DeskError::Invalid("That changes this Mac, so it can only be asked for at the Mac itself.".into())),
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

    use crate::sdk::Access;

    #[test]
    fn an_ability_names_only_real_built_in_modes() {
        let modes: Vec<String> = crate::keepers::kit::roles::builtins().into_iter().map(|r| r.id).collect();
        for a in super::PACKS.iter().flat_map(|p| p.iter()) {
            for m in a.modes {
                assert!(modes.iter().any(|id| id == m) && *m != "system", "{} names a mode {m} that is not a built-in (System offers everything)", a.id);
            }
        }
    }

    #[test]
    fn instant_only_abilities_are_never_offered_to_the_mind_or_named_for_a_mode() {
        for a in super::all().filter(|a| a.instant.only()) {
            assert!(a.modes.is_empty(), "{} runs only by its words, in every mode: it names no modes", a.id);
            assert!(!super::names().contains(&a.id), "{} is not a skill a mode lists", a.id);
            for mode in crate::keepers::kit::roles::builtins() {
                assert!(!super::catalogue_for(&mode).contains(&format!("- {}:", a.id)), "the mind in {} is told of {}", mode.id, a.id);
            }
        }
    }

    #[test]
    fn a_phone_can_look_but_never_change_this_mac() {
        assert!(super::may_run_from(Access::Change, true));
        assert!(!super::may_run_from(Access::Change, false));
        for access in [Access::Memory, Access::Look, Access::Personal, Access::Open] {
            assert!(super::may_run_from(access, false), "{access:?}");
        }
    }

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
        for id in ["remind", "add-event", "find-contact", "open-app", "open-website", "recall-actions", "ask-memory", "switch-engine", "show-file", "edit-file", "list-reminders", "upcoming", "find-video", "play-file", "find-movies"] {
            assert!(super::PACKS.iter().flat_map(|p| p.iter()).any(|a| a.id == id), "{id} is missing");
        }
    }

    #[test]
    fn every_skill_a_built_in_mode_lists_exists() {
        for mode in crate::keepers::kit::roles::builtins() {
            for id in mode.skills.iter().filter(|s| s.as_str() != "*") {
                assert!(super::PACKS.iter().flat_map(|p| p.iter()).any(|a| a.id == id), "{} lists {id}, which no pack has", mode.id);
            }
        }
    }

    #[test]
    fn modes_that_do_not_operate_the_computer_change_nothing_on_it() {
        use super::super::Access;
        for mode in crate::keepers::kit::roles::builtins().into_iter().filter(|m| !m.uses_computer()) {
            for a in super::PACKS.iter().flat_map(|p| p.iter()).filter(|a| mode.allows(a.id)) {
                assert!(a.access < Access::Open, "{} may use {}, which opens or changes things", mode.id, a.id);
            }
        }
    }
}
