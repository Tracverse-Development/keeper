//! The instructions a language-model brain gets, and how its answer is read back.
//! The model answers in JSON (the `Thought` shape); anything else is read as a plain reply.

use super::context::{Context, Thought};
use crate::skills;

/// Agent engines with tools, allowed to act: what is expected of them.
const ACTING: &str = "You may use your tools to act on this computer when the person asks (open, find, organise, write, run). \
Do the task, then report what you did in one or two sentences. Never do anything destructive or irreversible (deleting files, \
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
Put \"reply\" FIRST. {stage} \"remember\" holds NEW lasting facts the person just told you about themselves, written in the second person (\"Your sister is Maya\"); categories: identity, preference, person, place, work, health, schedule, general. Leave it empty when nothing new was learned.",
        name = ctx.assistant_name,
        identity = ctx.identity,
        skills = skills::catalogue(),
        acting = if ctx.may_act { ACTING } else if ctx.can_act { CHAT_TURN } else { NOT_ACTING },
        stage = if ctx.visual { crate::stage::RULES } else { crate::stage::TEXT_RULES },
    )
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
    let recent = if recent.is_empty() { "(this is the start)".to_string() } else { recent };
    format!("It is now {now}.\n\nWhat your DKG memory holds about the person:\n{facts}\n\nRecent conversation:\n{recent}\n\nThe person says: {said}", now = ctx.now_local, said = ctx.said)
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
        if let Ok(thought) = serde_json::from_str::<Thought>(&trimmed[start..=end]) {
            if !thought.reply.trim().is_empty() || !thought.actions.is_empty() {
                return thought;
            }
        }
    }
    Thought { reply: trimmed.trim_matches('`').to_string(), ..Thought::default() }
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
}
