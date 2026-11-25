//! OpenAI Codex (`codex exec --json`), using the person's own ChatGPT sign-in or key, the way
//! Foreman drives it. Read-only sandbox for chat; full access only when the person lets it act.
//! Each command it runs is recorded on the DKG.

use serde_json::Value;

use super::cli::{self, ACT_TIMEOUT, CHAT_TIMEOUT};
use crate::brain::context::{AgentStep, Context, Progress, Thought};
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

pub fn args(ctx: &Context, model: &str) -> Vec<String> {
    let sandbox = if ctx.may_act { "danger-full-access" } else { "read-only" };
    let prompt_text = format!("{}\n\nThe person says: {}", prompt::system(ctx), ctx.said);
    let mut a: Vec<String> = ["exec", "--json", "--skip-git-repo-check", "-s", sandbox].iter().map(|s| s.to_string()).collect();
    if !model.is_empty() {
        a.extend(["-m".to_string(), model.to_string()]);
    }
    a.push(prompt_text);
    a
}

/// What one `--json` event adds: a command (a step), the agent's message, or an error.
pub fn read_line(line: &str, steps: &mut Vec<AgentStep>, message: &mut Option<String>, error: &mut Option<String>) -> Option<String> {
    let v: Value = serde_json::from_str(line).ok()?;
    match v["type"].as_str()? {
        "item.completed" => {
            let item = &v["item"];
            match item["type"].as_str()? {
                "agent_message" => *message = item["text"].as_str().map(str::to_string),
                "command_execution" => {
                    let detail = cli::short(item["command"].as_str().unwrap_or_default(), 160);
                    steps.push(AgentStep { tool: "command".into(), detail: detail.clone() });
                    return Some(format!("Running: {detail}"));
                }
                "file_change" => steps.push(AgentStep { tool: "edit".into(), detail: cli::short(&item["changes"].to_string(), 160) }),
                _ => {}
            }
            None
        }
        "error" | "turn.failed" => {
            *error = v["message"].as_str().or(v["error"]["message"].as_str()).map(|m| cli::short(m, 200));
            None
        }
        _ => None,
    }
}

pub async fn think(ctx: &Context, model: &str, progress: &(dyn Fn(Progress) + Sync)) -> Result<Thought> {
    let program = cli::program("codex").ok_or_else(|| DeskError::Brain("Codex is not installed".into()))?;
    let (mut steps, mut message, mut error) = (Vec::new(), None, None);
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    cli::run(&program, &args(ctx, model), &cli::workdir(ctx.may_act), timeout, |line| {
        if let Some(step) = read_line(line, &mut steps, &mut message, &mut error) {
            progress(Progress::Step(&step));
        }
    })
    .await?;
    let text = message.ok_or_else(|| DeskError::Brain(error.unwrap_or_else(|| "Codex gave no answer".into())))?;
    let mut thought = prompt::read(&text);
    thought.steps = steps;
    Ok(thought)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_commands_messages_and_errors() {
        let (mut s, mut m, mut e) = (vec![], None, None);
        read_line(r#"{"type":"item.completed","item":{"type":"command_execution","command":"ls -la","exit_code":0}}"#, &mut s, &mut m, &mut e);
        read_line(r#"{"type":"item.completed","item":{"type":"agent_message","text":"{\"reply\":\"ok\"}"}}"#, &mut s, &mut m, &mut e);
        read_line(r#"{"type":"error","message":"401 Unauthorized"}"#, &mut s, &mut m, &mut e);
        assert_eq!(s[0].detail, "ls -la");
        assert_eq!(m.as_deref(), Some("{\"reply\":\"ok\"}"));
        assert_eq!(e.as_deref(), Some("401 Unauthorized"));
    }
}
