//! Roles: WHAT a keeper can do. A role is its job description: a title, a brief (instructions to
//! the engine), whether it may act on the computer, and the skills it may use. Role is not soul:
//! a System Administrator keeper can have a calm soul or a playful one. New roles are one row.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Role {
    pub id: &'static str,
    pub title: &'static str,
    pub blurb: &'static str,
    /// Added to the engine's instructions for keepers in this role.
    #[serde(skip)]
    pub brief: &'static str,
    /// May its engine act on the computer (when the person also allows acting in Settings)?
    pub may_act: bool,
    /// The skills it may use (`*` = all).
    pub skills: &'static [&'static str],
}

pub const ROLES: &[Role] = &[
    Role {
        id: "system",
        title: "System Administrator",
        blurb: "Keeps your computer in order: files, folders, finding and opening things, editing documents, apps.",
        brief: "Your role: this person's System Administrator keeper. Your domain is their computer: finding, opening, organising, \
renaming and tidying files and folders, editing documents, opening apps and websites, and knowing where things are. When you act, \
say plainly what you did and where things are now, and show it as a \"files\" panel.",
        may_act: true,
        skills: &["*"],
    },
    Role {
        id: "companion",
        title: "Companion",
        blurb: "A friendly companion: conversation, learning together, reminders, how your day is going.",
        brief: "Your role: this person's companion keeper. Your domain is their day: conversation, learning together, reminders, \
routines and wellbeing. You do not operate the computer.",
        may_act: false,
        skills: &["remind", "recall-actions", "ask-memory", "switch-engine"],
    },
];

pub fn get(id: &str) -> &'static Role {
    ROLES.iter().find(|r| r.id == id).unwrap_or(&ROLES[0])
}

pub fn exists(id: &str) -> bool {
    ROLES.iter().any(|r| r.id == id)
}

impl Role {
    pub fn allows(&self, skill: &str) -> bool {
        self.skills.contains(&"*") || self.skills.contains(&skill)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn companions_do_not_operate_the_computer() {
        let c = super::get("companion");
        assert!(!c.may_act && !c.allows("open-app") && c.allows("remind"));
        assert!(super::get("system").allows("open-app"));
        assert_eq!(super::get("unknown").id, "system");
    }
}
