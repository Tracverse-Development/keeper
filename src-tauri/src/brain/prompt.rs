//! The instructions a language-model brain gets, and how its answer is read back.
//! The model answers in JSON (the `Thought` shape); anything else is read as a plain reply.

use super::context::{Context, Thought};
use crate::skills;

/// Agent engines with tools, allowed to act: what is expected of them.
const ACTING: &str = "You may use your tools to act on this computer when the person asks (open, find, organise, write, run). \
Do the task, then report what you did in one or two plain sentences a person would say out loud: never write commands, \
flags, code or long paths in \"reply\" (it is spoken); name files and folders by their names, and put the details in a panel. Never do anything destructive or irreversible (deleting files, \
sending messages or email, payments, changing system settings) unless the person asked for exactly that; otherwise ask in your reply first. \
Everything you do is recorded in the person's DKG memory.";
const NOT_ACTING: &str = "Acting on this computer is switched off: do not use tools. If the person asks you to do something on the computer, \
say you can once they allow it in Settings (\"Let my assistant act on this computer\").";
const CHAT_TURN: &str = "You have no tools on this message (it was taken as conversation). If the person wants something done or looked up \
on this computer (their files, folders, documents, apps), do not guess and do not refuse: put \"needsComputer\": true in your JSON \
and reply in a few words that you'll take a look.";

/// The part of the instructions that does not change from turn to turn for a keeper: who it is,
/// its skills, whether it may act, how it shows things, and the answer format. Stable, so a
/// warm process can be started with it before the person speaks (`engines::warm`), and the model
/// provider can reuse it from its prompt cache.
pub fn system_static(ctx: &Context) -> String {
    format!(
        "You are {name}, a personal keeper (assistant) on the person's own computer. {identity} \
Your memory is the person's private OriginTrail DKG knowledge graph: each message brings the facts just queried from it. \
Use them naturally; never invent facts about the person. Keep spoken replies short (1-3 sentences), friendly, plain words, no markdown, no lists unless asked.\n\n\
Skills you can use (put them in \"actions\"):\n{skills}\n\n{acting}\n\n\
Answer ONLY with JSON: {{\"reply\": string, \"panels\": [panel], \"remember\": [{{\"text\": string, \"category\": string}}], \"forget\": [string], \"actions\": [{{\"skill\": string, \"input\": object}}]}}. \
Put \"reply\" FIRST. {stage} \"remember\" holds NEW lasting facts the person just told you about themselves, written in the second person (\"Your sister is Maya\"); categories: identity, preference, person (people and pets), place, health, schedule, general, and work (a note about the job in this mode, such as where this computer keeps screenshots; only work notes stay in this mode). Leave it empty when nothing new was learned.",
        name = ctx.assistant_name,
        identity = ctx.identity,
        skills = skills::catalogue_for(&crate::keepers::kit::roles::get(&ctx.job)),
        // A turn with no mode (a prepared lesson card) has no mode rule.
        acting = format!(
            "{} {}",
            if ctx.may_act { ACTING } else if ctx.can_act { CHAT_TURN } else { NOT_ACTING },
            if ctx.job.is_empty() { String::new() } else { crate::keepers::kit::roles::mode_rule(&crate::keepers::kit::roles::get(&ctx.job)) }
        ),
        stage = stage_rules(ctx),
    )
}

/// How to show things in this keeper's style: the Stage rules (or words only), then the style's own.
fn stage_rules(ctx: &Context) -> String {
    let style = super::styles::get(&ctx.style);
    let stage = if ctx.visual && style.visual { crate::stage::RULES } else { crate::stage::TEXT_RULES };
    if style.rules.is_empty() {
        stage.to_string()
    } else {
        format!("{stage} {}", style.rules)
    }
}

/// This turn's context and words: the time, the facts recalled for it, the recent conversation,
/// then what the person said.
pub fn turn_message(ctx: &Context) -> String {
    let facts = if ctx.facts.is_empty() {
        "(nothing yet)".to_string()
    } else {
        ctx.facts.iter().map(|f| format!("- {}", f.text)).collect::<Vec<_>>().join("\n")
    };
    let recent = ctx.recent.iter().rev().map(|t| format!("Person: {}\nYou: {}", t.said, t.replied)).collect::<Vec<_>>().join("\n");
    let recent = if recent.is_empty() { "(this chat is just starting)".to_string() } else { recent };
    let elsewhere = if ctx.elsewhere.is_empty() {
        String::new()
    } else {
        format!(
            "\n\nOther chats going on (SEPARATE topics: never treat them as this chat; mention them only if the person asks about another chat):\n{}",
            ctx.elsewhere.iter().map(|l| format!("- {l}")).collect::<Vec<_>>().join("\n")
        )
    };
    let feelings = ctx.feelings.as_deref().map(|f| format!("\n\n{f}")).unwrap_or_default();
    format!("It is now {now}.\n\nWhat your DKG memory holds about the person:\n{facts}\n\nThis chat so far (its own train of thought):\n{recent}{elsewhere}{feelings}\n\nThe person says: {said}{attached}", now = ctx.now_local, said = ctx.said, attached = ctx.attached.as_deref().unwrap_or(""))
}

/// Everything in one text, for engines that take a single prompt.
pub fn system(ctx: &Context) -> String {
    format!("{}\n\n{}", system_static(ctx), turn_message(ctx))
}

/// Read a model's answer. Models sometimes wrap JSON in prose or code fences, so take the
/// outermost `{…}`; if there is none, the whole answer is the reply.
pub fn read(answer: &str) -> Thought {
    let trimmed = answer.trim();
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&trimmed[start..=end]) {
            let thought = from_value(&v);
            if !thought.reply.trim().is_empty() || !thought.actions.is_empty() {
                return thought;
            }
        }
        // Not valid JSON (cut off, or a stray quote): keep the reply and every complete panel
        // rather than showing raw JSON (scenario bench 2026-11-26: a research answer lost its panels).
        if let Some(thought) = salvage(&trimmed[start..]) {
            return thought;
        }
    }
    Thought { reply: trimmed.trim_matches('`').to_string(), ..Thought::default() }
}

/// The answer's fields one by one: a field of the wrong shape is dropped, never the whole answer
/// (one malformed "remember" item once cost a lesson all its panels).
fn from_value(v: &serde_json::Value) -> Thought {
    let list = |key: &str| v[key].as_array().cloned().unwrap_or_default();
    Thought {
        reply: v["reply"].as_str().unwrap_or_default().to_string(),
        remember: list("remember").into_iter().filter_map(|x| serde_json::from_value(x).ok()).collect(),
        forget: list("forget").into_iter().filter_map(|x| x.as_str().map(str::to_string)).collect(),
        actions: list("actions").into_iter().filter_map(|x| serde_json::from_value(x).ok()).collect(),
        panels: v["panels"].clone(),
        plan: v["plan"].clone(),
        needs_computer: v["needsComputer"].as_bool().unwrap_or(false),
        switch_mode: v["switchMode"].as_str().map(str::to_string),
        ..Thought::default()
    }
}

/// From JSON that does not parse: the reply string and the panels that are complete.
fn salvage(text: &str) -> Option<Thought> {
    let mut stream = crate::stage::stream::PanelStream::default();
    let panels = stream.push(text);
    let reply = stream.take_reply()?;
    Some(Thought { reply, panels: serde_json::to_value(&panels).unwrap_or_default(), ..Thought::default() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_fenced_json_and_plain_text() {
        let t = read("Sure!\n```json\n{\"reply\":\"Hi Ada\",\"remember\":[{\"text\":\"Your name is Ada\",\"category\":\"identity\"}]}\n```");
        assert_eq!(t.reply, "Hi Ada");
        assert_eq!(t.remember.len(), 1);
        assert_eq!(read("Just words").reply, "Just words");
    }

    #[test]
    fn a_bad_field_or_a_cut_off_answer_keeps_the_reply_and_panels() {
        // "remember" in the wrong shape: the panels survive.
        let t = read(r#"{"reply":"Here it is","remember":"oops","panels":[{"kind":"text","title":"A","body":"b"}]}"#);
        assert_eq!(t.reply, "Here it is");
        assert_eq!(t.panels.as_array().map(Vec::len), Some(1));
        // Cut off mid-panel: the reply and the complete first panel survive, never raw JSON.
        let t = read(r#"{"reply":"Moderate at best.","panels":[{"kind":"text","title":"Why","body":"Eight small trials."},{"kind":"table","title":"Evid"#);
        assert_eq!(t.reply, "Moderate at best.");
        assert_eq!(t.panels.as_array().map(Vec::len), Some(1));
    }
}
