//! Claude Code (`claude -p`), using the person's own Claude subscription or key: stream-json
//! events, MCP servers off, no saved session.
//! - Talking turns run LEAN: our own system prompt in place of Claude Code's, no tools, no slash
//!   commands, no settings files (a fraction of the context, a faster first word).
//! - Acting turns run the full agent with its tools unrestricted; every tool call is recorded on
//!   the DKG.
//! Text arrives as partial messages, so Stage panels are handed over as soon as each is written
//! (`stage::stream::PanelStream`).

use serde_json::Value;

use super::cli::{self, ACT_TIMEOUT, CHAT_TIMEOUT};
use crate::brain::context::{AgentStep, Context, Progress, Thought};
use crate::stage::stream::PanelStream;
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

const ACTING_TOOLS: &str = "Bash Edit Write MultiEdit NotebookEdit WebFetch WebSearch Task";

pub fn args(ctx: &Context, model: &str) -> Vec<String> {
    let mut a: Vec<String> = ["-p", &ctx.said, "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--strict-mcp-config", "--no-session-persistence"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    if ctx.may_act {
        a.extend(["--append-system-prompt".to_string(), prompt::system(ctx)]);
        a.extend(["--permission-mode", "bypassPermissions", "--max-turns", "40"].map(String::from));
    } else {
        a.extend(["--system-prompt".to_string(), prompt::system(ctx)]);
        a.extend(["--tools", "", "--disable-slash-commands", "--setting-sources", "", "--disallowedTools", ACTING_TOOLS, "--max-turns", "2"].map(String::from));
    }
    if !model.is_empty() {
        a.extend(["--model".to_string(), model.to_string()]);
    }
    a
}

/// The text a partial-message event adds (`stream_event` → `content_block_delta` → `text_delta`).
pub fn text_delta(line: &str) -> Option<String> {
    let v: Value = serde_json::from_str(line).ok()?;
    (v["type"] == "stream_event" && v["event"]["delta"]["type"] == "text_delta").then(|| v["event"]["delta"]["text"].as_str().map(str::to_string)).flatten()
}

/// What one stream-json line adds: a tool call (a step) or the final answer.
pub fn read_line(line: &str, steps: &mut Vec<AgentStep>, result: &mut Option<String>) -> Option<String> {
    let v: Value = serde_json::from_str(line).ok()?;
    match v["type"].as_str()? {
        "assistant" => {
            let mut said_now = None;
            for item in v["message"]["content"].as_array().into_iter().flatten() {
                if item["type"] == "tool_use" {
                    let input = &item["input"];
                    let detail = ["command", "file_path", "path", "url", "pattern", "description", "query"]
                        .iter()
                        .find_map(|k| input[*k].as_str())
                        .map(|s| cli::short(s, 160))
                        .unwrap_or_default();
                    let tool = item["name"].as_str().unwrap_or("tool").to_string();
                    said_now = Some(format!("{tool}: {detail}"));
                    steps.push(AgentStep { tool, detail });
                }
            }
            said_now
        }
        "result" => {
            *result = v["result"].as_str().map(str::to_string);
            None
        }
        _ => None,
    }
}

pub async fn think(ctx: &Context, model: &str, progress: &(dyn Fn(Progress) + Sync)) -> Result<Thought> {
    let program = cli::program("claude").ok_or_else(|| DeskError::Brain("Claude Code is not installed".into()))?;
    let mut steps = Vec::new();
    let mut result = None;
    let mut panels = PanelStream::default();
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    let run = cli::run(&program, &args(ctx, model), &cli::workdir(ctx.may_act), timeout, |line| {
        if let Some(text) = text_delta(line) {
            for p in panels.push(&text) {
                progress(Progress::Panel(p));
            }
            if let Some(reply) = panels.take_reply() {
                progress(Progress::Reply(reply));
            }
            return true;
        }
        if let Some(step) = read_line(line, &mut steps, &mut result) {
            progress(Progress::Step(&step));
            // Under an approved plan, the first tool call outside it stops Claude here.
            if let (Some(guard), Some(last)) = (&ctx.guard, steps.last()) {
                return guard.check(last).is_none();
            }
        }
        true
    })
    .await?;
    if let Some(verdict) = ctx.guard.as_ref().and_then(|g| g.stopped()) {
        return Ok(super::stopped_by_plan(&verdict, steps));
    }
    let text = result.ok_or_else(|| DeskError::Brain(if run.success { "Claude Code gave no answer".into() } else { cli::short(&run.stderr, 200) }))?;
    let mut thought = prompt::read(&text);
    thought.steps = steps;
    Ok(thought)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_tool_calls_and_the_result() {
        let mut steps = vec![];
        let mut result = None;
        let line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"ls ~/Desktop"}}]}}"#;
        assert_eq!(read_line(line, &mut steps, &mut result).as_deref(), Some("Bash: ls ~/Desktop"));
        read_line(r#"{"type":"result","result":"{\"reply\":\"Done\"}"}"#, &mut steps, &mut result);
        assert_eq!(steps, vec![AgentStep { tool: "Bash".into(), detail: "ls ~/Desktop".into() }]);
        assert_eq!(result.as_deref(), Some("{\"reply\":\"Done\"}"));
    }

    /// The real Claude Code CLI with the person's subscription: `cargo test live_claude -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_answers_in_the_contract() {
        let ctx = Context { said: "My name is Ada and I love sorrel. What is 2 plus 2?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None };
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        assert!(t.reply.contains('4'), "reply: {}", t.reply);
        assert!(t.remember.iter().any(|l| l.text.contains("Ada")), "learned: {:?}", t.remember);
        assert!(t.steps.is_empty(), "a chat turn used no tools");
    }

    /// An acting turn records its tool calls: `cargo test live_claude -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_acting_turn_records_steps() {
        let ctx = Context { said: "List the files in /tmp with a shell command and tell me how many there are.".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: true, visual: true, guard: None };
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        assert!(!t.steps.is_empty(), "the tool call was captured");
        assert!(t.steps.iter().any(|s| s.tool == "Bash"), "steps: {:?}", t.steps);
    }

    /// Teaching answers with Stage panels, not a web page: `cargo test live_claude_teaches -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_teaches_with_panels() {
        let ctx = Context { said: "I need to understand math. Can you pull up some tables and show me how multiplication works?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None };
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        let panels = crate::stage::read(&t.panels);
        println!("reply: {}\npanels: {:?}", t.reply, panels.iter().map(|p| serde_json::to_value(p).unwrap()["kind"].clone()).collect::<Vec<_>>());
        assert!(!panels.is_empty(), "no panels; reply was: {}", t.reply);
        assert!(t.steps.is_empty(), "it built nothing on disk");
    }

    /// Panels stream before the answer ends: `cargo test live_claude_streams -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_streams_panels() {
        use std::sync::Mutex;
        let ctx = Context { said: "Explain addition step by step, with a quiz.".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None };
        let started = std::time::Instant::now();
        let arrivals: Mutex<Vec<u128>> = Mutex::new(vec![]);
        let t = think(&ctx, "", &|p: Progress| {
            if let Progress::Panel(_) = p {
                arrivals.lock().unwrap().push(started.elapsed().as_millis());
            }
        })
        .await
        .expect("claude answered");
        let total = started.elapsed().as_millis();
        let arrivals = arrivals.into_inner().unwrap();
        println!("panels streamed at {arrivals:?} ms; whole answer {total} ms; final panels {}", crate::stage::read(&t.panels).len());
        assert!(!arrivals.is_empty(), "no panel streamed");
        assert!(arrivals[0] < total, "the first panel arrived before the answer finished");
    }

    #[test]
    fn chat_turns_cannot_act() {
        let ctx = Context { said: "hi".into(), assistant_name: "U".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: String::new(), may_act: false, visual: true, guard: None };
        let a = args(&ctx, "claude-haiku-5-5");
        assert!(a.windows(2).any(|w| w[0] == "--model" && w[1] == "claude-haiku-5-5"));
        assert!(a.contains(&"--disallowedTools".to_string()) && a.contains(&"--system-prompt".to_string()));
        assert!(text_delta(r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"{\"re"}}}"#).as_deref() == Some("{\"re"));
        assert!(!a.contains(&"bypassPermissions".to_string()));
    }
}
