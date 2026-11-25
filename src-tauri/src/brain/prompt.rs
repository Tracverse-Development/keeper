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

pub fn system(ctx: &Context) -> String {
    let facts = if ctx.facts.is_empty() {
        "(nothing yet)".to_string()
    } else {
        ctx.facts.iter().map(|f| format!("- {}", f.text)).collect::<Vec<_>>().join("\n")
    };
    let recent = ctx.recent.iter().rev().map(|t| format!("Person: {}\nYou: {}", t.said, t.replied)).collect::<Vec<_>>().join("\n");
    format!(
        "You are {name}, a warm, concise personal assistant on the person's own computer. \
Your memory is the person's private OriginTrail DKG knowledge graph: the facts below were just queried from it. \
Use them naturally; never invent facts about the person. Keep spoken replies short (1-3 sentences), friendly, plain words, no markdown, no lists unless asked.\n\n\
It is now {now}.\n\nWhat your DKG memory holds about the person:\n{facts}\n\nRecent conversation:\n{recent}\n\n\
Skills you can use (put them in \"actions\"):\n{skills}\n\n{acting}\n\n\
Answer ONLY with JSON: {{\"reply\": string, \"remember\": [{{\"text\": string, \"category\": string}}], \"forget\": [string], \"actions\": [{{\"skill\": string, \"input\": object}}]}}. \
\"remember\" holds NEW lasting facts the person just told you about themselves, written in the second person (\"Your sister is Maya\"); categories: identity, preference, person, place, work, health, schedule, general. Leave it empty when nothing new was learned.",
        name = ctx.assistant_name,
        now = ctx.now_local,
        skills = skills::catalogue(),
        acting = if ctx.may_act { ACTING } else { NOT_ACTING },
    )
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
