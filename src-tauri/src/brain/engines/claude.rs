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
use super::warm;
use crate::brain::context::{AgentStep, Context, Progress, Thought};
use crate::stage::stream::PanelStream;
use crate::brain::prompt;
use crate::kernel::{DeskError, Result};

/// The longest tool input kept whole for the plan guard (longer ones are cut and never pass).
const MAX_STEP: usize = 4000;

const ACTING_TOOLS: &str = "Bash Edit Write MultiEdit NotebookEdit WebFetch WebSearch Task";

/// The command line for this keeper and mode. The message itself goes on stdin (stream-json
/// input), so the command line depends only on the fixed instructions: a warm spare can be
/// started with it before the person speaks (`warm`).
pub fn args(ctx: &Context, model: &str) -> Vec<String> {
    let mut a: Vec<String> = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--strict-mcp-config", "--no-session-persistence"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    if ctx.may_act {
        a.extend(["--append-system-prompt".to_string(), prompt::system_static(ctx)]);
        // No user or project settings: Keeper's own instructions and permissions are the whole
        // configuration (the person's Claude Code hooks and plugins cost ~0.7 s and are not ours).
        a.extend(["--permission-mode", "bypassPermissions", "--setting-sources", "", "--max-turns", "40"].map(String::from));
        // A look asks Keeper before every call, so one refused command is denied, not fatal.
        if let Some(settings) = look_settings(ctx) {
            a.extend(["--settings".to_string(), settings]);
        }
    } else if crate::keepers::kit::roles::get(&ctx.job).tools == crate::keepers::kit::roles::Tools::Web {
        // Research: reading the web only (search and fetch), never the computer.
        a.extend(["--system-prompt".to_string(), prompt::system_static(ctx)]);
        a.extend(["--tools", "WebSearch,WebFetch", "--allowedTools", "WebSearch WebFetch", "--disable-slash-commands", "--setting-sources", "", "--max-turns", "12"].map(String::from));
    } else {
        a.extend(["--system-prompt".to_string(), prompt::system_static(ctx)]);
        a.extend(["--tools", "", "--disable-slash-commands", "--setting-sources", "", "--disallowedTools", ACTING_TOOLS, "--max-turns", "2"].map(String::from));
    }
    if !model.is_empty() {
        a.extend(["--model".to_string(), model.to_string()]);
    }
    a
}

/// The look hook's settings, for a look-only turn (None for anything else).
fn look_settings(ctx: &Context) -> Option<String> {
    ctx.guard.as_ref().filter(|g| g.is_read_only()).and_then(|_| crate::brain::look_hook::settings())
}

/// The person's turn as one stream-json input line.
pub fn message_line(ctx: &Context) -> String {
    let line = serde_json::json!({ "type": "user", "message": { "role": "user", "content": prompt::turn_message(ctx) } });
    format!("{line}\n")
}

/// Start a spare for this keeper and mode now, so its next turn skips Claude Code's start-up.
pub fn warm_up(ctx: &Context, model: &str) {
    let Some(program) = cli::program("claude") else { return };
    let (a, cwd) = (args(ctx, model), cli::workdir(ctx.may_act));
    warm::fill(warm::key(&program, &cwd, &a), program, cwd, a);
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
                    // The FULL command goes to the plan guard (FIX-0019: it once judged a copy cut at
                    // 160 characters and stopped a harmless look); only the live phase text is short.
                    // A command longer than the cap is cut with "…", which the guard never accepts.
                    let detail = ["command", "file_path", "path", "url", "pattern", "description", "query"]
                        .iter()
                        .find_map(|k| input[*k].as_str())
                        .map(|s| if s.chars().count() <= MAX_STEP { s.to_string() } else { cli::short(s, MAX_STEP) })
                        .unwrap_or_default();
                    let tool = item["name"].as_str().unwrap_or("tool").to_string();
                    said_now = Some(format!("{tool}: {}", cli::short(&detail, 160)));
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

/// One quick question that must be answered with a JSON object (no tools, no chat): used where
/// Keeper needs structured data from the helper model, such as turning words into a wardrobe
/// item. The answer is untrusted data; the caller validates every field.
pub async fn ask_json(system: &str, question: &str, model: &str) -> Result<serde_json::Value> {
    let program = cli::program("claude").ok_or_else(|| DeskError::Brain("Claude Code is not installed".into()))?;
    let mut a: Vec<String> = ["-p", "--output-format", "json", "--strict-mcp-config", "--no-session-persistence", "--tools", "", "--disable-slash-commands", "--setting-sources", "", "--max-turns", "1"].iter().map(|s| s.to_string()).collect();
    a.extend(["--system-prompt".to_string(), system.to_string()]);
    if !model.is_empty() {
        a.extend(["--model".to_string(), model.to_string()]);
    }
    a.push(question.to_string());
    let run = cli::run(&program, &a, &cli::workdir(false), std::time::Duration::from_secs(60), |_| true).await?;
    let envelope: Value = serde_json::from_str(run.stdout.trim()).map_err(|_| DeskError::Brain("The helper model did not answer.".into()))?;
    let text = envelope["result"].as_str().unwrap_or_default();
    let (start, end) = (text.find('{'), text.rfind('}'));
    match (start, end) {
        (Some(s), Some(e)) if e > s => serde_json::from_str(&text[s..=e]).map_err(|_| DeskError::Brain("The helper model's answer wasn't readable.".into())),
        _ => Err(DeskError::Brain("The helper model's answer wasn't readable.".into())),
    }
}

pub async fn think(ctx: &Context, model: &str, progress: &(dyn Fn(Progress) + Sync)) -> Result<Thought> {
    let program = cli::program("claude").ok_or_else(|| DeskError::Brain("Claude Code is not installed".into()))?;
    let (a, cwd) = (args(ctx, model), cli::workdir(ctx.may_act));
    let key = warm::key(&program, &cwd, &a);
    // A warm spare skips the start-up; then the next spare starts at once for the turn after.
    let spare = warm::take(&key);
    let from_spare = spare.is_some();
    let child = match spare {
        Some(child) => child,
        None => cli::spawn(&program, &a, &cwd, true)?,
    };
    warm::fill(key, program.clone(), cwd.clone(), a.clone());
    match run_once(ctx, child, progress).await {
        // A spare that went bad (it died, or its sign-in moved on) costs a retry, never a turn.
        Err(DeskError::Brain(m)) if from_spare && m != cli::STOPPED => run_once(ctx, cli::spawn(&program, &a, &cwd, true)?, progress).await,
        other => other,
    }
}

/// One run of a started Claude Code process: send the message, stream panels, the reply and
/// tool calls as they come, and read the final answer.
async fn run_once(ctx: &Context, child: tokio::process::Child, progress: &(dyn Fn(Progress) + Sync)) -> Result<Thought> {
    let mut steps = Vec::new();
    let mut result = None;
    let mut panels = PanelStream::default();
    let timeout = if ctx.may_act { ACT_TIMEOUT } else { CHAT_TIMEOUT };
    // With the look hook, refused calls are denied and the run goes on; the stream only checks
    // that each refused call really was denied (the backstop).
    let hooked = look_settings(ctx).is_some();
    let mut refused = std::collections::HashSet::new();
    let run = cli::drive(child, Some(message_line(ctx)), timeout, |line| {
        if let Some(text) = text_delta(line) {
            for p in panels.push(&text) {
                progress(Progress::Panel(p));
            }
            if let Some(words) = panels.take_reply_delta() {
                progress(Progress::ReplyText(words));
            }
            if let Some(reply) = panels.take_reply() {
                progress(Progress::Reply(reply));
            }
            return true;
        }
        if hooked {
            if let (Some(guard), Ok(v)) = (&ctx.guard, serde_json::from_str::<Value>(line)) {
                for (id, step) in crate::brain::look_hook::tool_uses(&v) {
                    if guard.judge(&step).is_some() {
                        refused.insert(id);
                    }
                }
                if crate::brain::look_hook::backstop_tripped(&v, &refused) {
                    let ran = steps.last().map(|s: &AgentStep| s.detail.clone()).unwrap_or_default();
                    let _ = guard.check(&AgentStep { tool: "Bash".into(), detail: format!("(the look hook let this run) {ran}") });
                    return false;
                }
            }
        }
        if let Some(step) = read_line(line, &mut steps, &mut result) {
            progress(Progress::Step(&step));
            // Under an approved plan, the first tool call outside it stops Claude here.
            if let (false, Some(guard), Some(last)) = (hooked, &ctx.guard, steps.last()) {
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
        // FIX-0019: a long command reaches the guard whole; only the phase text is short.
        let long = format!("route -n get default; echo ---; {}networksetup -getairportnetwork en0", "ifconfig | grep inet; ".repeat(12));
        let line = serde_json::json!({"type": "assistant", "message": {"content": [{"type": "tool_use", "name": "Bash", "input": {"command": long}}]}}).to_string();
        let mut steps = vec![];
        let said = read_line(&line, &mut steps, &mut result).unwrap();
        assert_eq!(steps[0].detail, long, "the guard sees every character");
        assert!(said.chars().count() < 200, "the live phase text stays short");
    }

    /// The real Claude Code CLI with the person's subscription: `cargo test live_claude -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_answers_in_the_contract() {
        let ctx = Context { said: "My name is Ada and I love sorrel. What is 2 plus 2?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None };
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        assert!(t.reply.contains('4') || t.reply.to_lowercase().contains("four"), "reply: {}", t.reply);
        assert!(t.remember.iter().any(|l| l.text.contains("Ada")), "learned: {:?}", t.remember);
        assert!(t.steps.is_empty(), "a chat turn used no tools");
    }

    /// An acting turn records its tool calls: `cargo test live_claude -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_acting_turn_records_steps() {
        let ctx = Context { said: "List the files in /tmp with a shell command and tell me how many there are.".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "Tuesday".into(), may_act: true, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None };
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        assert!(!t.steps.is_empty(), "the tool call was captured");
        assert!(t.steps.iter().any(|s| s.tool == "Bash"), "steps: {:?}", t.steps);
    }

    /// Teaching answers with Stage panels, not a web page: `cargo test live_claude_teaches -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_claude_teaches_with_panels() {
        let ctx = Context { said: "I need to understand math. Can you pull up some tables and show me how multiplication works?".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None };
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
        let ctx = Context { said: "Explain addition step by step, with a quiz.".into(), assistant_name: "Kofi".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None };
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

    #[tokio::test]
    #[ignore]
    async fn live_research_mode_cites_real_sources() {
        // As the app builds it: the Researcher mode's brief is part of the identity (turn::base_context).
        let ctx = Context { said: "What blood test is used first to rule out a pulmonary embolism?".into(), assistant_name: "Kofi".into(), identity: crate::keepers::kit::roles::get("researcher").brief.to_string(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: "Tuesday".into(), may_act: false, visual: true, guard: None, can_act: false, job: "researcher".into(), feelings: None, style: String::new(), attached: None };
        let started = std::time::Instant::now();
        let t = think(&ctx, "", &|_: Progress| {}).await.expect("claude answered");
        let panels = crate::stage::read(&t.panels);
        let sources: Vec<_> = panels.iter().filter_map(|p| match p { crate::stage::Panel::Sources { items, .. } => Some(items.clone()), _ => None }).flatten().collect();
        println!("{} ms; reply: {}; sources: {:?}", started.elapsed().as_millis(), t.reply, sources.iter().map(|s| &s.url).collect::<Vec<_>>());
        assert!(!sources.is_empty(), "a research answer ends with real sources");
        assert!(sources.iter().all(|s| s.url.starts_with("http")));
    }

    #[test]
    fn chat_turns_cannot_act() {
        let ctx = Context { said: "hi".into(), assistant_name: "U".into(), identity: String::new(), facts: vec![], recent: vec![], elsewhere: vec![], now_local: String::new(), may_act: false, visual: true, guard: None, can_act: false, job: String::new(), feelings: None, style: String::new(), attached: None };
        let a = args(&ctx, "claude-haiku-5-5");
        assert!(a.windows(2).any(|w| w[0] == "--model" && w[1] == "claude-haiku-5-5"));
        assert!(a.contains(&"--disallowedTools".to_string()) && a.contains(&"--system-prompt".to_string()));
        assert!(text_delta(r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"{\"re"}}}"#).as_deref() == Some("{\"re"));
        assert!(!a.contains(&"bypassPermissions".to_string()));
    }
}
