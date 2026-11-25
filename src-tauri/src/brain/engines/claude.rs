//! Claude Code (`claude -p`), using the person's own Claude subscription or key, exactly as
//! Foreman drives it: stream-json events, MCP servers off, no saved session. Chat-only turns
//! disallow the acting tools; when the person lets it act, it runs with its tools unrestricted
//! and every tool call it makes is recorded on the DKG.

use serde_json::Value;

use super::cli::{self, ACT_TIMEOUT, CHAT_TIMEOUT};
use crate::brain::context::{AgentStep, Context, Thought};
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

const ACTING_TOOLS: &str = "Bash Edit Write MultiEdit NotebookEdit WebFetch WebSearch Task";

pub fn args(ctx: &Context, model: &str) -> Vec<String> {
    let mut a: Vec<String> = ["-p", &ctx.said, "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--no-session-persistence", "--append-system-prompt"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    a.push(prompt::system(ctx));
    if !model.is_empty() {
        a.extend(["--model".to_string(), model.to_string()]);
    }
    if ctx.may_act {
        a.extend(["--permission-mode", "bypassPermissions", "--max-turns", "40"].map(String::from));
    } else {
        a.extend(["--disallowedTools", ACTING_TOOLS, "--max-turns", "3"].map(String::from));
    }
    a
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

pub async fn think(ctx: &Context, model: &str, progress: &(dyn Fn(&str) + Sync)) -> Result<Thought> {
    let program = cli::program("claude").ok_or_else(|| DeskError::Brain("Claude Code is not installed".into()))?;
    let mut steps = Vec::new();
    let mut result = None;
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    let run = cli::run(&program, &args(ctx, model), &cli::workdir(ctx.may_act), timeout, |line| {
        if let Some(step) = read_line(line, &mut steps, &mut result) {
            progress(&step);
        }
    })
    .await?;
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
        let ctx = Context { said: "My name is Ada and I love sorrel. What is 2 plus 2?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false };
        let t = think(&ctx, "", &|_| {}).await.expect("claude answered");
        assert!(t.reply.contains('4'), "reply: {}", t.reply);
        assert!(t.remember.iter().any(|l| l.text.contains("Ada")), "learned: {:?}", t.remember);
        assert!(t.steps.is_empty(), "a chat turn used no tools");
    }

    /// An acting turn records its tool calls: `cargo test live_claude -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_acting_turn_records_steps() {
        let ctx = Context { said: "List the files in /tmp with a shell command and tell me how many there are.".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: true };
        let t = think(&ctx, "", &|_| {}).await.expect("claude answered");
        assert!(!t.steps.is_empty(), "the tool call was captured");
        assert!(t.steps.iter().any(|s| s.tool == "Bash"), "steps: {:?}", t.steps);
    }

    /// Teaching answers with Stage panels, not a web page: `cargo test live_claude_teaches -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_teaches_with_panels() {
        let ctx = Context { said: "I need to understand math. Can you pull up some tables and show me how multiplication works?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: "Tuesday".into(), may_act: false };
        let t = think(&ctx, "", &|_| {}).await.expect("claude answered");
        let panels = crate::stage::read(&t.panels);
        println!("reply: {}\npanels: {:?}", t.reply, panels.iter().map(|p| serde_json::to_value(p).unwrap()["kind"].clone()).collect::<Vec<_>>());
        assert!(!panels.is_empty(), "no panels; reply was: {}", t.reply);
        assert!(t.steps.is_empty(), "it built nothing on disk");
    }

    #[test]
    fn chat_turns_cannot_act() {
        let ctx = Context { said: "hi".into(), assistant_name: "U".into(), identity: String::new(), facts: vec![], recent: vec![], now_local: String::new(), may_act: false };
        let a = args(&ctx, "claude-haiku-5-5");
        assert!(a.windows(2).any(|w| w[0] == "--model" && w[1] == "claude-haiku-5-5"));
        assert!(a.contains(&"--disallowedTools".to_string()));
        assert!(!a.contains(&"bypassPermissions".to_string()));
    }
}
