//! What a brain is given (`Context`) and what it must give back (`Thought`).
//! Every engine, agent CLI, local model or built-in rules, speaks this one contract.

use serde::{Deserialize, Serialize};

use crate::memory::{Fact, Turn};
use crate::sdk::ActionRequest;

#[derive(Clone)]
pub struct Context {
    pub said: String,
    pub assistant_name: String,
    /// Who this keeper is and what it can do: its soul's brief, then its role's brief.
    pub identity: String,
    /// Facts recalled from the DKG for this turn (already ranked).
    pub facts: Vec<Fact>,
    /// The last exchanges of THIS chat, newest first (from the DKG).
    pub recent: Vec<Turn>,
    /// One line per other recent chat: separate topics the keeper knows about but does not mix in.
    pub elsewhere: Vec<String>,
    /// Local time, written out ("Tuesday 25 November 2026, 10:42").
    pub now_local: String,
    /// May an agent engine act on this computer this turn (tools on)?
    pub may_act: bool,
    /// Could this keeper act on another turn (its role acts and the person allows it)? A turn
    /// taken as conversation (`assistant::intent`) has `may_act` off but this on, so the engine
    /// is told to ask for the computer (`needs_computer`) rather than say acting is switched off.
    pub can_act: bool,
    /// The mode (job) this turn is in (`keepers::kit::roles` id): which skills and tools it knows.
    pub job: String,
    /// The keeper's simulated mood for this turn (`feelings`), when its mode allows one and the
    /// person has not turned it off; added to the turn's message, never the fixed instructions.
    pub feelings: Option<String>,
    /// How this keeper shows its answer (`styles::STYLES` id; "" = Balanced).
    pub style: String,
    /// Show this answer visually on the Stage (panels), or in words?
    pub visual: bool,
    /// When the person approved a plan: the guard every tool call is checked against; the
    /// engine stops at the first call outside it (`brain::guard`).
    pub guard: Option<std::sync::Arc<super::guard::PlanGuard>>,
    /// Material the person handed over with this message (a dropped file's text), already
    /// written as a block for the turn's message (`assistant::attach::Attached::block`).
    pub attached: Option<String>,
    /// The web page open in Keeper's browser in front of the person, as fenced MATERIAL
    /// (`browser::page::material`). Unlike `attached` it never stops instant answers or acting:
    /// the person may ask about the page, or ask for anything else while it is open.
    pub page: Option<String>,
}

/// What an engine reports while it works: a tool step it took, or a Stage panel it finished
/// writing (streamed, so it can be shown before the answer is complete).
pub enum Progress<'a> {
    Step(&'a str),
    Panel(crate::stage::Panel),
    /// The spoken reply, ready before the rest of the answer.
    Reply(String),
    /// New words of the reply while it is being written (live typing in the chat).
    ReplyText(String),
    /// The person changed course with these words; the engine starts again with them (`redirect`).
    Redirected(String),
}

/// Something learned about the person, written in the second person ("Your sister is Maya").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Learned {
    pub text: String,
    #[serde(default = "general")]
    pub category: String,
    /// A few everyday words for what the fact is about ("family", "phone"), so it is found by
    /// meaning later; cleaned where the fact is made (`memory::records::clean_topics`).
    #[serde(default)]
    pub about: Vec<String>,
}

fn general() -> String {
    "general".into()
}

/// One thing an agent engine did on the computer (a tool call), recorded on the DKG.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AgentStep {
    /// The engine's tool name ("Bash", "Edit", "command").
    pub tool: String,
    /// What it did, short ("ls ~/Desktop", "edited notes.md").
    pub detail: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Thought {
    pub reply: String,
    #[serde(default)]
    pub remember: Vec<Learned>,
    /// Words describing facts to retract ("my old address").
    #[serde(default)]
    pub forget: Vec<String>,
    #[serde(default)]
    pub actions: Vec<ActionRequest>,
    /// What to show on the Stage (raw from the engine; `stage::read` validates and caps it).
    #[serde(default)]
    pub panels: serde_json::Value,
    /// Filled by agent engines from their event stream, never by the model's JSON.
    #[serde(skip_deserializing)]
    pub steps: Vec<AgentStep>,
    /// The steps the engine WOULD take on the computer (asked for before acting; see
    /// `assistant::approval`). Raw from the engine; validated where it is used.
    #[serde(default)]
    pub plan: serde_json::Value,
    /// Panels only the core may show (a plan to approve, your facts); never from the model.
    #[serde(skip)]
    pub core_panels: Vec<crate::stage::Panel>,
    /// What the engine says this answer cost, in dollars at its own prices (cloud engines that
    /// report one; never from the model's JSON).
    #[serde(skip)]
    pub cost_usd: Option<f64>,
    /// A conversation turn's engine says the person wants computer work after all; the core
    /// runs the turn again with tools (`assistant::source`).
    #[serde(default, rename = "needsComputer")]
    pub needs_computer: bool,
    /// The engine says this belongs to another mode (its id); the core switches and answers there.
    #[serde(default, rename = "switchMode")]
    pub switch_mode: Option<String>,
    /// The person's corrections this turn ("Changed course: …"), in order (`redirect`; never
    /// from the model's JSON).
    #[serde(skip)]
    pub corrections: Vec<String>,
}
