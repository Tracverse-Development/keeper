//! Modes (stored as `role` on a keeper; docs/design/keeper-modes.md): WHAT job a keeper is doing.
//! A mode is a job description: a title, instructions (its brief), the TOOLS it may use and the
//! SKILLS it may use. In a mode the keeper knows only that mode's skills and tools, so a
//! Researcher never thinks it is a System Administrator. Mode is not soul (who it is) and not
//! style (how it shows answers). A chat can be in any mode the person picks; the keeper's `role`
//! is its default for new chats. New modes are one row.

use serde::Serialize;

/// What a mode may touch.
#[derive(Debug, Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Tools {
    /// Talk only.
    None,
    /// Search and read the web, never the computer.
    Web,
    /// Look at the computer (read only, no approval needed; the read-only guard holds it).
    Look,
    /// Change the computer, under the approval plan.
    Act,
}

#[derive(Debug, Serialize)]
pub struct Role {
    pub id: &'static str,
    pub title: &'static str,
    pub blurb: &'static str,
    /// Added to the engine's instructions for keepers in this mode.
    #[serde(skip)]
    pub brief: &'static str,
    pub tools: Tools,
    /// The skills it may use (`*` = all); the engine is told about these only.
    pub skills: &'static [&'static str],
}

pub const ROLES: &[Role] = &[
    Role {
        id: "system",
        title: "System Administrator",
        blurb: "Keeps your computer in order: files, folders, finding and opening things, editing documents, apps.",
        brief: "Your mode: this person's System Administrator. Your domain is their computer: finding, opening, organising, \
renaming and tidying files and folders, editing documents, opening apps and websites, and knowing where things are. When you act, \
say plainly what you did and where things are now, and show it as a \"files\" panel.",
        tools: Tools::Act,
        skills: &["*"],
    },
    Role {
        id: "assistant",
        title: "Assistant",
        blurb: "Your everyday personal assistant: your day, reminders, calendar, contacts, finding things, questions.",
        brief: "Your mode: this person's personal assistant. You help with their day: plans, reminders, their calendar and contacts, \
finding things on their computer (you can look, never change), opening apps and websites, and answering questions. If they want \
files changed, tell them to switch to System Administrator mode.",
        tools: Tools::Look,
        skills: &["remind", "add-event", "find-contact", "open-app", "open-website", "recall-actions", "ask-memory", "switch-engine"],
    },
    Role {
        id: "researcher",
        title: "Researcher",
        blurb: "Searches the web and answers with real, cited sources.",
        brief: "Your mode: this person's Researcher. Work like a careful researcher. Use WebSearch to find current, authoritative sources \
(official bodies, peer-reviewed or primary sources first) and WebFetch to read the ones you rely on. Every factual claim in your panels must \
come from a source you actually read; mark it with the source number in brackets, like [1]. Say plainly where sources disagree or evidence \
is weak, and give dates for anything that changes over time. ALWAYS end with a sources panel: \
{\"kind\":\"sources\",\"title\":\"Sources\",\"items\":[{\"title\",\"url\",\"note\"}]} listing each source you cited, in order, with its real URL \
and one line on what it supports. Never invent a source or a URL. You do not operate the computer.",
        tools: Tools::Web,
        skills: &["recall-actions", "ask-memory"],
    },
    Role {
        id: "tutor",
        title: "Tutor",
        blurb: "Teaches by guiding you: hints, questions, practice.",
        brief: "Your mode: this person's Tutor. Teach the way a good tutor does: do not hand over the full answer at once. Find out what \
the person already knows, give one small step or hint at a time, and ask a question back. Use a quiz or flashcards panel to practise, and \
praise effort. Give the full answer only when the person asks for it or has tried. You do not operate the computer.",
        tools: Tools::None,
        skills: &["remind", "ask-memory"],
    },
    Role {
        id: "companion",
        title: "Companion",
        blurb: "A friendly companion: conversation, learning together, reminders, how your day is going.",
        brief: "Your mode: this person's companion. Your domain is their day: conversation, learning together, reminders, \
routines and wellbeing. You do not operate the computer.",
        tools: Tools::None,
        skills: &["remind", "recall-actions", "ask-memory", "switch-engine", "add-event", "find-contact"],
    },
];

pub fn get(id: &str) -> &'static Role {
    ROLES.iter().find(|r| r.id == id).unwrap_or(&ROLES[0])
}

pub fn exists(id: &str) -> bool {
    ROLES.iter().any(|r| r.id == id)
}

impl Role {
    /// May change the computer (under the approval plan).
    pub fn may_act(&self) -> bool {
        self.tools == Tools::Act
    }

    /// May use the computer at all (change it, or only look).
    pub fn uses_computer(&self) -> bool {
        matches!(self.tools, Tools::Act | Tools::Look)
    }

    pub fn allows(&self, skill: &str) -> bool {
        self.skills.contains(&"*") || self.skills.contains(&skill)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn companions_do_not_operate_the_computer() {
        let c = super::get("companion");
        assert!(!c.may_act() && !c.uses_computer() && !c.allows("open-app") && c.allows("remind"));
        let r = super::get("researcher");
        assert!(r.tools == super::Tools::Web && !r.allows("open-app") && r.brief.contains("\"kind\":\"sources\""));
        let a = super::get("assistant");
        assert!(a.uses_computer() && !a.may_act(), "the assistant looks, never changes");
        assert!(super::get("system").allows("open-app"));
        assert_eq!(super::get("unknown").id, "system");
    }
}
