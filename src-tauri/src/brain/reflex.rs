//! Umoja's built-in mind: no model, no network. It is conversation and memory only: it learns
//! plain statements about the person, answers from the DKG facts it was handed, forgets on
//! request, greets, tells the time here and says what it can do. Each rule is one function (a
//! Chain of Responsibility: the first rule that recognises the words answers), so a new rule is
//! one new function.
//!
//! Things a keeper DOES (a reminder, opening an app, dark mode, a video, the time in Tokyo) are
//! never rules here: they are SDK abilities whose own phrasings run them before any mind is
//! asked (`sdk::instant`, `Instant::Also`), so there is one implementation for every mind
//! (FIX-0053; a test keeps this list free of them).

use std::sync::OnceLock;

use regex::Regex;
use serde_json::json;

use super::context::{Context, Learned, Thought};
use crate::memory::Fact;
use crate::sdk::instant::{clean, to_second_person};
use crate::sdk::ActionRequest;

type Rule = fn(&str, &Context) -> Option<Thought>;

/// Every rule by name, in the order they are tried.
const RULES: &[(&str, Rule)] = &[
    ("memory_question", memory_question),
    ("forget", forget),
    ("my_name_is", my_name_is),
    ("remember_that", remember_that),
    ("statement", statement),
    ("recall_all", recall_all),
    ("recall_actions", recall_actions),
    ("ask_name", ask_name),
    ("time_now", time_now),
    ("greeting", greeting),
    ("help", help),
    ("question_about_me", question_about_me),
];

/// The built-in mind's answer to what was said (a rule's, or the fallback).
pub fn think(ctx: &Context) -> Thought {
    let said = ctx.said.trim();
    RULES.iter().find_map(|(_, rule)| rule(said, ctx)).unwrap_or_else(|| fallback(ctx))
}

fn re(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("rule pattern compiles"))
}

fn reply(text: impl Into<String>) -> Thought {
    Thought { reply: text.into(), ..Thought::default() }
}

fn learned(text: String, category: &str) -> Thought {
    let reply_text = format!("Got it. I'll remember that {}.", lower_first(&text));
    Thought { reply: reply_text, remember: vec![Learned { text, category: category.into(), about: vec![] }], ..Thought::default() }
}

fn lower_first(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_lowercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

/// Words that end a name: "My name is Amos and I love cricket" is Amos (and the rest is heard too).
const AFTER_A_NAME: &[&str] = &["and", "but", "so", "or", "&", "because", "who", "i", "i'm", "from"];
/// The most words a name is taken to have.
const NAME_WORDS: usize = 4;

/// "My name is Amos", "call me Ada": the name is learned, and what follows it ("and I love
/// cricket") is learned too when it is a statement the `statement` rule understands. The name
/// stops at punctuation or a joining word (FIX-0053: "Amos and I love cricket" was the name).
fn my_name_is(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:hi|hello|hey)?[, ]*(?:my name is|my name's|call me|i am called|i'm called)\s+(\p{L}.*)$").captures(said)?;
    let (name, rest) = split_name(&caps[1]);
    if name.is_empty() {
        return None;
    }
    let mut t = learned(format!("Your name is {name}"), "identity");
    t.reply = format!("Lovely to meet you, {name}. I've written your name into your memory graph.");
    if let Some(more) = statement(&rest, ctx) {
        let also: Vec<String> = more.remember.iter().map(|l| lower_first(&l.text)).collect();
        t.reply = format!("Lovely to meet you, {name}. I've written your name into your memory graph, and that {}.", join_naturally(&also));
        t.remember.extend(more.remember);
    }
    Some(t)
}

/// "Amos and I love cricket" → ("Amos", "I love cricket"); "Mary Jane." → ("Mary Jane", "").
fn split_name(words: &str) -> (String, String) {
    let (head, after_mark) = match words.find([',', '.', '!', '?', ';']) {
        Some(at) => (&words[..at], words[at + 1..].trim_start_matches([',', '.', '!', '?', ';', ' '])),
        None => (words, ""),
    };
    let all: Vec<&str> = head.split_whitespace().collect();
    let stop = all.iter().position(|w| AFTER_A_NAME.contains(&w.to_lowercase().as_str())).unwrap_or(all.len());
    let name: Vec<&str> = all[..stop].iter().take(NAME_WORDS).copied().filter(|w| w.chars().all(|c| c.is_alphabetic() || "'-".contains(c))).collect();
    // A joining word is dropped ("and I love cricket" → "I love cricket"); "I" starts the statement.
    let rest_words = match all.get(stop) {
        Some(w) if w.eq_ignore_ascii_case("i") || w.eq_ignore_ascii_case("i'm") => &all[stop..],
        Some(_) => &all[stop + 1..],
        None => &all[all.len()..],
    };
    let rest = [rest_words.join(" "), after_mark.to_string()].into_iter().filter(|p| !p.trim().is_empty()).collect::<Vec<_>>().join(". ");
    (clean(&name.join(" ")), rest.trim().to_string())
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
    } else {
        return None;
    };
    Some(action("ask-memory", json!({ "question": question })))
}

fn forget(said: &str, _: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    let caps = re(&R, r"(?i)^(?:please\s+)?forget(?:\s+that|\s+about)?\s+(.{3,})").captures(said)?;
    let what = clean(&caps[1]);
    Some(Thought { reply: String::new(), forget: vec![to_second_person(&what)], ..Thought::default() })
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

/// The time HERE. "What time is it in Tokyo?" is the `time-in` ability's (its phrasings run it
/// first); a place it does not know is not answered with the local time (FIX-0053).
fn time_now(said: &str, ctx: &Context) -> Option<Thought> {
    static R: OnceLock<Regex> = OnceLock::new();
    re(&R, r"(?i)(what time is it|what's the time|the time\??$|what(?:'s| is) (?:the date|today)|what day is it)").find(said)?;
    if said.to_lowercase().contains(" in ") {
        return None;
    }
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
    Some(reply(WITHOUT_AN_AI))
}

/// What works with no AI connected, said truthfully: memory, and the abilities whose own words
/// run them (`sdk::instant`; which ones depends on the mode, System Administrator has them all).
const WITHOUT_AN_AI: &str = "I'm using my built-in mind, so I work without an AI. Tell me about yourself and I'll remember it on your own memory node and recall it later. \
I can also do quick things at once: set a reminder (\"remind me in 10 minutes to stretch\"), open an app or a website, show you a video (\"show me a video on how to tie a tie\"), \
tell the time here or in another city, work out a sum or a conversion, turn dark mode on, take a screenshot, and check that everything is working. \
For open conversation, connect an AI in Settings.";

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
    // "Remind me to call Maya at 5" needs am or pm; the remind ability's words take a clear time.
    if said_starts(&ctx.said, "remind me") {
        return reply("Tell me when, and I'll set it: \"remind me to call Maya at 5 pm\" or \"remind me in 10 minutes to stretch\".");
    }
    reply(format!(
        "I'm using my built-in mind right now, so I can remember what you tell me about yourself and recall it, and do quick things: reminders, opening apps and websites, videos, the time anywhere, sums, and your Mac's settings. For open conversation, connect an AI in Settings. {} is listening.",
        ctx.assistant_name
    ))
}

fn said_starts(said: &str, words: &str) -> bool {
    said.trim().to_lowercase().starts_with(words)
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
    fn memory_questions_and_forgetting_become_requests() {
        let q = think(&ctx("what did you do today?", vec![]));
        assert_eq!((q.actions[0].skill.as_str(), q.actions[0].input["question"].as_str(), q.actions[0].input["days"].as_str()), ("ask-memory", Some("actions-recent"), Some("1")));
        assert_eq!(think(&ctx("what did we talk about this week", vec![])).actions[0].input["question"], "turns-recent");
        let f = think(&ctx("forget that I live in Port of Spain", vec![]));
        assert_eq!(f.forget, vec!["You live in Port of Spain".to_string()]);
    }

    // FIX-0053: "My name is Amos and I love cricket" saved the name as "Amos and I love cricket".
    #[test]
    fn a_name_stops_at_a_joining_word_and_the_rest_is_learned_too() {
        let t = think(&ctx("My name is Amos and I love cricket", vec![]));
        let learned: Vec<(&str, &str)> = t.remember.iter().map(|l| (l.text.as_str(), l.category.as_str())).collect();
        assert_eq!(learned, vec![("Your name is Amos", "identity"), ("You love cricket", "preference")]);
        assert!(t.reply.contains("Amos") && t.reply.contains("you love cricket"), "{}", t.reply);
        for (said, name) in [("Hi, my name is Mary Jane.", "Mary Jane"), ("my name is Ada, I live in Port of Spain", "Ada"), ("call me Ishmael!", "Ishmael"), ("My name's Kwame but everyone calls me K", "Kwame")] {
            assert_eq!(think(&ctx(said, vec![])).remember[0].text, format!("Your name is {name}"), "{said}");
        }
        let place = think(&ctx("my name is Ada, I live in Port of Spain", vec![]));
        assert_eq!(place.remember[1].text, "You live in Port of Spain");
        assert_eq!(think(&ctx("My name is Kwame but everyone calls me K", vec![])).remember.len(), 1, "not a statement: only the name");
    }

    // FIX-0053: the built-in mind held its own copies of abilities (remind, open, switch engine,
    // list reminders) that misread "show me a video…" as an app and "remind me in 10 minutes
    // to…" as nothing. Those are abilities now, run by their own words before any mind.
    #[test]
    fn the_built_in_mind_holds_no_ability_rules() {
        let names: Vec<&str> = RULES.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, ["memory_question", "forget", "my_name_is", "remember_that", "statement", "recall_all", "recall_actions", "ask_name", "time_now", "greeting", "help", "question_about_me"]);
        let system = crate::keepers::kit::roles::get("system");
        for said in ["remind me to call Maya in 10 minutes", "remind me in 10 minutes to stretch", "open Notes", "open umojaark.com", "switch your brain to Claude Code", "What reminders do I have?", "show me a video on how to tie a tie", "turn on dark mode"] {
            assert!(think(&ctx(said, vec![])).actions.is_empty(), "{said} is not the built-in mind's");
            assert!(crate::sdk::instant::asked(said, &system).is_some(), "{said} is an ability's own words");
        }
    }

    #[test]
    fn the_time_here_is_not_the_time_elsewhere() {
        assert_eq!(think(&ctx("what time is it?", vec![])).reply, "It's Tuesday 25 November 2026, 10:42.");
        assert!(!think(&ctx("what time is it in Atlantis?", vec![])).reply.contains("10:42"));
    }

    #[test]
    fn help_says_what_works_without_an_ai() {
        let said = think(&ctx("what can you do?", vec![])).reply;
        assert!(said.contains("without an AI") && said.contains("remind me in 10 minutes") && said.contains("video"), "{said}");
        assert!(think(&ctx("remind me to call Maya at 5", vec![])).reply.contains("5 pm"), "an unclear time is asked about");
    }

    #[test]
    fn pronouns_swap_cleanly() {
        assert_eq!(to_second_person("I'm allergic to my cat, I think"), "You're allergic to your cat, you think");
    }
}
