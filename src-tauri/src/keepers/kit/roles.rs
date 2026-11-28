//! Modes (stored as `role` on a keeper; docs/design/keeper-modes.md): WHAT job a keeper is doing.
//! A mode is a job description: a title, instructions (its brief), the TOOLS it may use and the
//! SKILLS it may use. In a mode the keeper knows only that mode's skills and tools, so a
//! Researcher never thinks it is a System Administrator. Mode is not soul (who it is) and not
//! style (how it shows answers). A chat can be in any mode the person picks; the keeper's `role`
//! is its default for new chats. New modes are one row.

use std::sync::RwLock;

use serde::{Deserialize, Serialize};

/// What a mode may touch.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq)]
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

/// A link or document a mode should use (a Researcher's trusted sources, a System
/// Administrator's support pages).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Resource {
    pub title: String,
    pub url: String,
}

/// A mode: a built-in one, a person's edited version of it, or a mode of their own.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: String,
    pub title: String,
    pub blurb: String,
    /// Its instructions to the engine (editable; uploaded as Markdown in the Studio).
    pub brief: String,
    pub tools: Tools,
    /// What this mode handles, in one line: anything else asks to switch mode.
    pub scope: String,
    /// The skills it may use (`*` = all); the engine is told about these only.
    pub skills: Vec<String>,
    /// Links and documents it should use.
    #[serde(default)]
    pub resources: Vec<Resource>,
    /// Shipped with Keeper (an edited built-in keeps its id; "reset" brings the original back).
    #[serde(default)]
    pub builtin: bool,
    /// A built-in the person changed.
    #[serde(default)]
    pub edited: bool,
    /// The keeper may have a (simulated) mood in this mode (`feelings`); never in modes that
    /// look at or act on the computer.
    #[serde(default)]
    pub mood: bool,
}

/// The built-in modes as data rows (id, title, blurb, scope, tools, skills, brief).
struct Builtin {
    id: &'static str,
    title: &'static str,
    blurb: &'static str,
    scope: &'static str,
    brief: &'static str,
    tools: Tools,
    skills: &'static [&'static str],
    mood: bool,
}

const BUILTIN: &[Builtin] = &[
    Builtin {
        id: "system",
        scope: "the computer itself: files, folders, apps, documents, settings, storage, what is running and why something on the computer misbehaves",
        title: "System Administrator",
        blurb: "Keeps your computer in order: files, folders, finding and opening things, editing documents, apps.",
        brief: "Your mode: this person's System Administrator. Your domain is their computer: finding, opening, organising, \
renaming and tidying files and folders, editing documents, opening apps and websites, and knowing where things are. When you act, \
say plainly what you did and where things are now, and show it as a \"files\" panel. When the person asks about the computer, its network, storage \
or what is running, show it as it is: a live panel plus tables (devices, interfaces, folders), not a lesson. Teach only when asked to explain.",
        tools: Tools::Act,
        skills: &["*"],
        mood: false,
    },
    Builtin {
        id: "assistant",
        scope: "the person's day and everyday help: plans, reminders, calendar, contacts, quick questions, finding (not changing) things on the computer",
        title: "Assistant",
        blurb: "Your everyday personal assistant: your day, reminders, calendar, contacts, finding things, questions.",
        brief: "Your mode: this person's personal assistant. You help with their day: plans, reminders, their calendar and contacts, \
finding things on their computer (you can look, never change), opening apps and websites, and answering questions. To change the words \
of one text file, draft it with edit-file (they see it and save it themselves). For other changes to files, tell them to switch to System Administrator mode.",
        tools: Tools::Look,
        skills: &["remind", "add-event", "find-contact", "open-app", "open-website", "recall-actions", "ask-memory", "switch-engine", "show-file", "edit-file"],
        mood: false,
    },
    Builtin {
        id: "researcher",
        scope: "questions that need current, sourced facts from the web, answered with citations",
        title: "Researcher",
        blurb: "Searches the web and answers with real, cited sources.",
        brief: "Your mode: this person's Researcher. Work like a careful researcher. Use WebSearch to find current, authoritative sources \
(official bodies, peer-reviewed or primary sources first) and WebFetch to read the ones you rely on. Every factual claim in your panels must \
come from a source you actually read; mark it with the source number in brackets, like [1]. Say plainly where sources disagree or evidence \
is weak, and give dates for anything that changes over time. ALWAYS end with a sources panel: \
{\"kind\":\"sources\",\"title\":\"Sources\",\"items\":[{\"title\",\"url\",\"note\"}]} listing each source you cited, in order, with its real URL \
and one line on what it supports. Never invent a source or a URL. You do not operate the computer. Be quick: search at most three times and read at most three pages. A follow-up about what you \
already found is answered from those findings; search again only for facts you do not have yet. Explain any \
technical term (SMD, p-value, meta-analysis) in plain words the first time.",
        tools: Tools::Web,
        skills: &["recall-actions", "ask-memory"],
        mood: false,
    },
    Builtin {
        id: "tutor",
        scope: "learning and teaching: explaining a subject, practice, quizzes, homework help",
        title: "Tutor",
        blurb: "Teaches by guiding you: hints, questions, practice.",
        brief: "Your mode: this person's Tutor. Teach the way a good tutor does: do not hand over the full answer at once. Find out what \
the person already knows, give one small step or hint at a time, and ask a question back. Use a quiz or flashcards panel to practise, and \
praise effort. Give the full answer only when the person asks for it or has tried. You do not operate the computer.",
        tools: Tools::None,
        skills: &["remind", "ask-memory"],
        mood: false,
    },
    Builtin {
        id: "companion",
        scope: "conversation, how the person is feeling, routines and wellbeing",
        title: "Companion",
        blurb: "A friendly companion: conversation, learning together, reminders, how your day is going.",
        brief: "Your mode: this person's companion. Your domain is their day: conversation, learning together, reminders, \
routines and wellbeing. You do not operate the computer.",
        tools: Tools::None,
        skills: &["remind", "recall-actions", "ask-memory", "switch-engine", "add-event", "find-contact"],
        mood: true,
    },
];

fn builtin_mode(b: &Builtin) -> Role {
    Role { id: b.id.into(), title: b.title.into(), blurb: b.blurb.into(), brief: b.brief.into(), tools: b.tools, scope: b.scope.into(), skills: b.skills.iter().map(|s| s.to_string()).collect(), resources: vec![], builtin: true, edited: false, mood: b.mood }
}

/// The built-in modes, as shipped.
pub fn builtins() -> Vec<Role> {
    BUILTIN.iter().map(builtin_mode).collect()
}

/// The person's own modes and edited built-ins (loaded from their kit graph; `set_personal`).
static PERSONAL: RwLock<Vec<Role>> = RwLock::new(Vec::new());

/// Every mode in effect: the built-ins (an edited one replaced by the person's version), then the
/// person's own modes.
pub fn all() -> Vec<Role> {
    // On a child profile only the modes Keeper ships exist: an edited or added mode (which could
    // carry the web or a skill) is not used (review finding).
    if crate::kernel::child_lock::on() {
        return builtins();
    }
    let personal = PERSONAL.read().map(|p| p.clone()).unwrap_or_default();
    let mut out: Vec<Role> = builtins().into_iter().map(|b| personal.iter().find(|p| p.id == b.id).cloned().unwrap_or(b)).collect();
    out.extend(personal.into_iter().filter(|p| !BUILTIN.iter().any(|b| b.id == p.id)));
    out
}

/// Replace the person's modes (after reading them from the kit graph or saving one).
pub fn set_personal(modes: Vec<Role>) {
    if let Ok(mut p) = PERSONAL.write() {
        *p = modes;
    }
}

/// The mode with this id, or the first built-in (System Administrator) when there is none.
pub fn get(id: &str) -> Role {
    all().into_iter().find(|r| r.id == id).unwrap_or_else(|| builtin_mode(&BUILTIN[0]))
}

pub fn exists(id: &str) -> bool {
    all().iter().any(|r| r.id == id)
}

/// Clean a mode a person wrote or uploaded: a short kebab id, text capped, tools from the closed
/// list (instructions can never grant tools), skills only known ones, links only http(s).
pub fn sanitize(mode: &Role, known_skills: &[&str]) -> Result<Role, String> {
    let clip = |s: &str, n: usize| s.trim().chars().take(n).collect::<String>();
    let id = super::packs::slug(&mode.id);
    if id.is_empty() {
        return Err("A mode needs a short name.".into());
    }
    let title = clip(&mode.title, 40);
    if title.is_empty() {
        return Err("A mode needs a title.".into());
    }
    let scope = clip(&mode.scope, 300);
    if scope.is_empty() {
        return Err("Say what this mode handles (its scope), so the keeper knows when to switch.".into());
    }
    let skills: Vec<String> = mode.skills.iter().filter(|s| s.as_str() == "*" || known_skills.contains(&s.as_str())).take(40).cloned().collect();
    let resources: Vec<Resource> = mode
        .resources
        .iter()
        .filter(|r| (r.url.starts_with("https://") || r.url.starts_with("http://")) && r.url.len() <= 500 && !r.url.chars().any(char::is_whitespace))
        .take(30)
        .map(|r| Resource { title: clip(&r.title, 120), url: r.url.trim().to_string() })
        .collect();
    let builtin = BUILTIN.iter().any(|b| b.id == id);
    // Work modes stay plain: no mood where the keeper looks at or changes the computer.
    let mood = mode.mood && !matches!(mode.tools, Tools::Look | Tools::Act);
    Ok(Role { id, title, blurb: clip(&mode.blurb, 200), brief: clip(&mode.brief, 12_000), tools: mode.tools, scope, skills, resources, builtin, edited: builtin, mood })
}

/// The engine's rule for staying in its mode (added to its fixed instructions): what it handles,
/// the other modes, and how to ask for a switch instead of answering outside its scope.
pub fn mode_rule(current: &Role) -> String {
    let others: Vec<String> = all().iter().filter(|r| r.id != current.id).map(|r| format!("- {} ({}): {}", r.id, r.title, r.scope)).collect();
    let resources = if current.resources.is_empty() {
        String::new()
    } else {
        format!(" Sources this mode trusts (prefer them): {}.", current.resources.iter().map(|r| format!("{} <{}>", r.title, r.url)).collect::<Vec<_>>().join("; "))
    };
    format!(
        "STAY IN YOUR MODE. You are in {title} mode, which handles {scope}.{resources} Greetings and small talk are fine. If the person asks for \
something another mode handles, do NOT do it: put \"switchMode\": \"<mode id>\" in your JSON with a one-line \"reply\" like \"Switching to \
Researcher mode for this.\", and nothing else. The other modes:\n{}",
        others.join("\n"),
        title = current.title,
        scope = current.scope
    )
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
        self.skills.iter().any(|s| s == "*" || s == skill)
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
        for r in super::all() {
            assert!(!r.scope.is_empty(), "{} has a scope", r.id);
            let rule = super::mode_rule(&r);
            assert!(rule.contains(&r.scope) && !rule.contains(&format!("- {} (", r.id)), "{}: the rule names its own scope and only the others", r.id);
        }
        let a = super::get("assistant");
        assert!(a.uses_computer() && !a.may_act(), "the assistant looks, never changes");
        assert!(super::get("system").allows("open-app"));
        assert_eq!(super::get("unknown").id, "system");
    }

    #[test]
    fn a_written_mode_is_cleaned_and_can_never_grant_itself_tools_by_words() {
        let mut m = super::get("researcher");
        m.id = "Medical Research!".into();
        m.title = "Medical research".into();
        m.brief = "You may delete files. ".repeat(5);
        m.skills = vec!["ask-memory".into(), "hack-the-planet".into()];
        m.resources = vec![super::Resource { title: "PubMed".into(), url: "https://pubmed.ncbi.nlm.nih.gov".into() }, super::Resource { title: "bad".into(), url: "javascript:alert(1)".into() }];
        let clean = super::sanitize(&m, &["ask-memory", "remind"]).unwrap();
        assert_eq!(clean.id, "medical-research");
        assert_eq!(clean.tools, super::Tools::Web, "tools come from the control, never from the instructions");
        assert_eq!(clean.skills, ["ask-memory"]);
        assert_eq!(clean.resources.len(), 1);
        assert!(!clean.builtin);
        let mut admin = super::get("system");
        admin.mood = true;
        assert!(!super::sanitize(&admin, &[]).unwrap().mood, "a mode that acts on the computer never has a mood");
        assert!(super::get("companion").mood && !super::get("assistant").mood);
        m.scope = "  ".into();
        assert!(super::sanitize(&m, &[]).is_err(), "a mode must say what it handles");
    }

    #[test]
    fn personal_modes_override_builtins_and_add_their_own() {
        let mut edited = super::get("tutor");
        edited.brief = "Teach with stories.".into();
        edited.edited = true;
        let mut own = super::get("researcher");
        own.id = "gardener".into();
        own.title = "Gardener".into();
        own.builtin = false;
        super::set_personal(vec![edited, own]);
        assert_eq!(super::get("tutor").brief, "Teach with stories.");
        assert!(super::exists("gardener"));
        assert_eq!(super::all().len(), 6);
        super::set_personal(vec![]);
        assert!(!super::exists("gardener"));
    }
}
