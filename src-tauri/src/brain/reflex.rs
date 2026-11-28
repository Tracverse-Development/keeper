//! Umoja's built-in mind: no model, no network. It learns plain statements about the person,
//! answers from the DKG facts it was handed, forgets on request, tells the time, opens apps
//! and websites and sets reminders. Each rule is one function (a Chain of Responsibility:
//! the first rule that recognises the words answers), so a new rule is one new function.

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

use super::context::{Context, Learned, Thought};
use crate::memory::Fact;
use crate::sdk::ActionRequest;

type Rule = fn(&str, &Context) -> Option<Thought>;

const RULES: &[Rule] = &[switch_engine, memory_question, forget, remind, open, my_name_is, remember_that, statement, recall_all, recall_actions, ask_name, time_now, greeting, help, question_about_me];

pub fn think(ctx: &Context) -> Thought {
    let said = ctx.said.trim();
    RULES.iter().find_map(|rule| rule(said, ctx)).unwrap_or_else(|| fallback(ctx))
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("rule pattern compiles"))
}

fn reply(text: impl Into<String>) -> Thought {
    Thought { reply: text.into(), ..Thought::default() }
}

fn clean(s: &str) -> String {
    s.trim().trim_end_matches(['.', '!', '?', ',']).trim().to_string()
}

/// "I love my sister" → "You love your sister": the assistant remembers in the second person.
pub fn to_second_person(text: &str) -> String {
    let swapped: Vec<String> = text
        .split_whitespace()
        .map(|w| {
            let lower = w.to_lowercase();
            let core = lower.trim_end_matches([',', '.', '!', '?']);
            let tail = &lower[core.len()..];
            let swapped = match core {
                "i" => "you",
                "i'm" | "im" => "you're",
                "i've" => "you've",
                "i'll" => "you'll",
                "i'd" => "you'd",
                "am" => "are",
                "my" => "your",
                "mine" => "yours",
                "me" => "you",
                "myself" => "yourself",
                _ => return w.to_string(),
            };
            format!("{swapped}{tail}")
        })
        .collect();
    let mut out = swapped.join(" ");
    if let Some(first) = out.get(0..1) {
        out = first.to_uppercase() + &out[1..];
    }
    out
}

fn learned(text: String, category: &str) -> Thought {
    let reply_text = format!("Got it. I'll remember that {}.", lower_first(&text));
    Thought { reply: reply_text, remember: vec![Learned { text, category: category.into(), about: vec![] }], ..Thought::default() }
}

fn lower_first(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_lowercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

fn my_name_is(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:hi|hello|hey)?[, ]*(?:my name is|my name's|call me|i am called|i'm called)\s+([\p{L}][\p{L}' -]{0,40})").captures(said)?;
    let name = clean(&caps[1]);
    let mut t = learned(format!("Your name is {name}"), "identity");
    t.reply = format!("Lovely to meet you, {name}. I've written your name into your memory graph.");
    Some(t)
}

fn remember_that(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:please\s+)?(?:remember|note|don't forget)(?:\s+that)?[:,]?\s+(.{3,})").captures(said)?;
    Some(learned(to_second_person(&clean(&caps[1])), "general"))
}

/// Plain statements about the person: "I like…", "My favourite… is…", "I live in…", "I work at…".
fn statement(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let r = re(&R, r"(?i)^(?:i (?:really )?(like|love|prefer|enjoy|hate|dislike|live|work|study|was born)|my (favou?rite|birthday|wife|husband|son|daughter|sister|brother|mother|mom|mum|father|dad|friend|church|job|email|phone|address|dog|cat)|i'm (?:a|an|from|allergic))\b.{2,}");
    let caps = r.captures(said)?;
    let key = caps.get(1).or(caps.get(2)).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
    let category = match key.as_str() {
        "like" | "love" | "prefer" | "enjoy" | "hate" | "dislike" | "favourite" | "favorite" => "preference",
        "live" | "address" => "place",
        "work" | "study" | "job" => "work",
        "birthday" | "was born" => "identity",
        "wife" | "husband" | "son" | "daughter" | "sister" | "brother" | "mother" | "mom" | "mum" | "father" | "dad" | "friend" | "dog" | "cat" => "person",
        _ => "general",
    };
    let category = if said.to_lowercase().contains("allergic") { "health" } else { category };
    Some(learned(to_second_person(&clean(said)), category))
}

/// "What did you do today?", "what did we talk about this week?", "what didn't work?": catalog questions.
fn memory_question(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^what (?:did|have) (?:you|we) (do|done|talk(?:ed)? about|run|ran)(?: for me)?\s*(today|yesterday|this week|this month|lately|recently)?\??$").captures(said);
    if let Some(c) = caps {
        let days = match c.get(2).map(|m| m.as_str().to_lowercase()).as_deref() {
            Some("today") => 1,
            Some("yesterday") => 2,
            Some("this month") => 31,
            _ => 7,
        };
        let question = if c[1].to_lowercase().starts_with("talk") { "turns-recent" } else { "actions-recent" };
        return Some(action("ask-memory", json!({ "question": question, "days": days.to_string() })));
    }
    let lower = said.to_lowercase();
    let question = if lower.contains("didn't work") || lower.contains("what failed") {
        "actions-failed"
    } else if lower.contains("what did you run") || lower.contains("commands you ran") {
        "agent-steps"
    } else if lower.contains("how much do you know") || lower.contains("how big is your memory") {
        "memory-size"
    } else if lower.contains("upcoming reminders") || lower.contains("what reminders") {
        return Some(action("list-reminders", json!({})));
    } else {
        return None;
    };
    Some(action("ask-memory", json!({ "question": question })))
}

/// "Switch your brain to Claude", "use Codex", "change your engine to the local model".
fn switch_engine(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:please\s+)?(?:switch|change|set|swap|use|think with)\s+(?:your\s+)?(?:brain|engine|mind|model)?\s*(?:to|with)?\s*(?:the\s+)?(claude(?: code)?|codex|gemini|hermes|ollama|local model|local|built-in(?: mind)?|builtin|reflex)\b").captures(said)?;
    let engine = match caps[1].to_lowercase().as_str() {
        s if s.starts_with("claude") => "claude",
        "codex" => "codex",
        "gemini" => "gemini",
        "hermes" => "hermes",
        "ollama" | "local model" | "local" => "ollama",
        _ => "reflex",
    };
    Some(action("switch-engine", json!({ "engine": engine })))
}

fn forget(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:please\s+)?forget(?:\s+that|\s+about)?\s+(.{3,})").captures(said)?;
    let what = clean(&caps[1]);
    Some(Thought { reply: String::new(), forget: vec![to_second_person(&what)], ..Thought::default() })
}

fn remind(said: &str, _: &Context) -> Option<Thought> {
    static IN: OnceLock<Regex> = OnceLock::new();
    static AT: OnceLock<Regex> = OnceLock::new();
    if let Some(c) = re(&IN, r"(?i)^remind me (?:to |that |about )?(.+?) in (\d{1,4}) ?(seconds?|secs?|minutes?|mins?|hours?|hrs?)\.?$").captures(said) {
        let n: i64 = c[2].parse().ok()?;
        let unit = c[3].to_lowercase();
        let minutes = if unit.starts_with('h') { n * 60 } else if unit.starts_with('s') { 0 } else { n };
        let seconds = if unit.starts_with('s') { n } else { minutes * 60 };
        return Some(action("remind", json!({ "text": to_second_person(&clean(&c[1])), "inSeconds": seconds })));
    }
    if let Some(c) = re(&AT, r"(?i)^remind me (?:to |that |about )?(.+?) at (\d{1,2})(?::(\d{2}))? ?(am|pm)?\.?$").captures(said) {
        let mut hour: u32 = c[2].parse().ok()?;
        let minute: u32 = c.get(3).map(|m| m.as_str().parse().unwrap_or(0)).unwrap_or(0);
        match c.get(4).map(|m| m.as_str().to_lowercase()) {
            Some(ref p) if p == "pm" && hour < 12 => hour += 12,
            Some(ref p) if p == "am" && hour == 12 => hour = 0,
            _ => {}
        }
        return Some(action("remind", json!({ "text": to_second_person(&clean(&c[1])), "atLocal": format!("{hour:02}:{minute:02}") })));
    }
    None
}

fn open(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:please\s+)?(?:open|launch|start|go to|show me)\s+(?:the\s+)?(.{2,60}?)(?:\s+app)?\.?$").captures(said)?;
    let target = clean(&caps[1]);
    let looks_like_site = target.contains('.') && !target.contains(' ');
    Some(if looks_like_site { action("open-website", json!({ "url": target })) } else { action("open-app", json!({ "name": target })) })
}

fn action(skill: &str, input: serde_json::Value) -> Thought {
    Thought { actions: vec![ActionRequest { skill: skill.into(), input }], ..Thought::default() }
}

fn recall_all(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what do you (?:know|remember) about me|what have you learned|what's in (?:your|my) memory|tell me about myself)").find(said)?;
    if ctx.facts.is_empty() {
        return Some(reply("Your memory graph is still empty. Tell me about yourself and I'll remember it on your DKG node."));
    }
    let list: Vec<String> = ctx.facts.iter().take(6).map(|f| lower_first(&f.text)).collect();
    Some(reply(format!("Here's what your memory graph says: {}.", join_naturally(&list))))
}

fn recall_actions(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what (?:have|did) you (?:done|do)|what did you do for me|your history|show (?:me )?your actions)").find(said)?;
    Some(action("recall-actions", json!({})))
}

fn ask_name(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what(?:'s| is) my name|who am i|do you know my name)").find(said)?;
    Some(match identity(&ctx.facts, "Your name is ") {
        Some(name) => reply(format!("You're {name}. That's in your memory graph.")),
        None => reply("I don't know your name yet. Tell me, and I'll remember it."),
    })
}

fn time_now(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what time is it|what's the time|the time\??$|what(?:'s| is) (?:the date|today)|what day is it)").find(said)?;
    Some(reply(format!("It's {}.", ctx.now_local)))
}

fn greeting(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)^(hi|hello|hey|good (?:morning|afternoon|evening)|yo)\b[ ,!.]*(?:umoja|there)?[ !.]*$").find(said)?;
    Some(reply(match identity(&ctx.facts, "Your name is ") {
        Some(name) => format!("Hello {name}. What can I do for you?"),
        None => format!("Hello, I'm {}. What should I call you?", ctx.assistant_name),
    }))
}

fn help(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what can you do|help me|how do you work|what are you)").find(said)?;
    Some(reply("I'm your personal assistant, and my memory lives on your own DKG node. Tell me about yourself and I'll remember it. I can recall it later, set reminders, open apps and websites, and tell you what I've done."))
}

/// A question about the person ("what's my favourite drink?") answered from the recalled facts.
fn question_about_me(said: &str, ctx: &Context) -> Option<Thought> {
    let lower = said.to_lowercase();
    let is_question = lower.ends_with('?') || ["what", "who", "where", "when", "which", "do i", "am i", "how old"].iter().any(|w| lower.starts_with(w));
    if !is_question || !(lower.contains(" my ") || lower.contains(" i ") || lower.starts_with("do i") || lower.starts_with("am i")) {
        return None;
    }
    let asked: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4).collect();
    let best = ctx.facts.iter().find(|f| {
        let t = f.text.to_lowercase();
        asked.iter().any(|w| t.contains(w))
    })?;
    Some(reply(format!("From your memory graph: {}.", lower_first(&best.text))))
}

fn fallback(ctx: &Context) -> Thought {
    reply(format!(
        "I'm using my built-in mind right now, so I can remember what you tell me about yourself, recall it, set reminders and open apps. For open conversation, connect a local model in Settings. {} is listening.",
        ctx.assistant_name
    ))
}

fn identity(facts: &[Fact], prefix: &str) -> Option<String> {
    facts.iter().find_map(|f| f.text.strip_prefix(prefix).map(str::to_string))
}

fn join_naturally(items: &[String]) -> String {
    match items {
        [] => String::new(),
        [one] => one.clone(),
        [rest @ .., last] => format!("{}, and {last}", rest.join(", ")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(said: &str, facts: Vec<Fact>) -> Context {
        Context { said: said.into(), assistant_name: "Keeper".into(), identity: String::new(), facts, recent: vec![], elsewhere: vec![], now_local: "Tuesday 25 November 2026, 10:42".into(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None }
    }

    #[test]
    fn learns_a_name_in_the_second_person() {
        let t = think(&ctx("My name is Ada", vec![]));
        assert_eq!(t.remember[0], Learned { text: "Your name is Ada".into(), category: "identity".into(), about: vec![] });
    }

    #[test]
    fn learns_preferences_and_answers_from_them() {
        let t = think(&ctx("I love sorrel at Christmas", vec![]));
        assert_eq!(t.remember[0].text, "You love sorrel at Christmas");
        assert_eq!(t.remember[0].category, "preference");
        let fact = Fact::new("Your favourite drink is sorrel", "preference", "2026-11-25T10:00:00Z");
        let a = think(&ctx("what's my favourite drink?", vec![fact]));
        assert!(a.reply.contains("sorrel"), "{}", a.reply);
    }

    #[test]
    fn reminders_open_and_forget_become_requests() {
        let r = think(&ctx("remind me to call Maya in 10 minutes", vec![]));
        assert_eq!(r.actions[0].skill, "remind");
        assert_eq!(r.actions[0].input["inSeconds"], 600);
        let o = think(&ctx("open Notes", vec![]));
        assert_eq!(o.actions[0].input["name"], "Notes");
        let w = think(&ctx("open umojaark.com", vec![]));
        assert_eq!(w.actions[0].skill, "open-website");
        let e = think(&ctx("switch your brain to Claude Code", vec![]));
        assert_eq!((e.actions[0].skill.as_str(), e.actions[0].input["engine"].as_str()), ("switch-engine", Some("claude")));
        assert_eq!(think(&ctx("use codex", vec![])).actions[0].input["engine"], "codex");
        let q = think(&ctx("what did you do today?", vec![]));
        assert_eq!((q.actions[0].skill.as_str(), q.actions[0].input["question"].as_str(), q.actions[0].input["days"].as_str()), ("ask-memory", Some("actions-recent"), Some("1")));
        assert_eq!(think(&ctx("what did we talk about this week", vec![])).actions[0].input["question"], "turns-recent");
        let f = think(&ctx("forget that I live in Port of Spain", vec![]));
        assert_eq!(f.forget, vec!["You live in Port of Spain".to_string()]);
    }

    #[test]
    fn pronouns_swap_cleanly() {
        assert_eq!(to_second_person("I'm allergic to my cat, I think"), "You're allergic to your cat, you think");
    }
}
