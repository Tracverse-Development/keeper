//! The look hook (DESK-LOOK-DENY-001): while a keeper only LOOKS at the computer, Claude Code
//! asks Keeper before every tool call (a PreToolUse hook that runs this same program with
//! `--look-guard`). A call that is not a read is DENIED with the reason and the engine carries on
//! with what it may run, instead of the whole look ending at the first unfamiliar command.
//!
//! The streaming guard stays as the backstop: if a call the guard refuses ever comes back as a
//! normal result (the hook did not run), the run is stopped there (`backstop_tripped`).

use std::io::Read;

use serde_json::Value;

use super::context::AgentStep;
use super::guard::PlanGuard;

/// Every denial starts with this, so the backstop can tell a denied call from one that ran.
pub const MARK: &str = "Keeper only looks here:";

/// The command Claude Code runs for the hook: this program with `--look-guard` (None if the
/// program's own path is unknown or unsafe to put in a command line; then the backstop alone holds).
pub fn command() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let path = exe.to_str()?;
    path.chars().all(|c| c.is_ascii_alphanumeric() || "/._- ".contains(c)).then(|| format!("'{path}' --look-guard"))
}

/// The `--settings` value that installs the hook for every tool.
pub fn settings() -> Option<String> {
    let command = command()?;
    Some(serde_json::json!({ "hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [ { "type": "command", "command": command, "timeout": 10 } ] } ] } }).to_string())
}

/// The hook's answer for one PreToolUse input: None to allow, or the deny JSON. Unreadable
/// input is denied (fails closed).
pub fn decide(input: &str, home: &std::path::Path) -> Option<String> {
    let deny = |why: &str| Some(serde_json::json!({ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": format!("{MARK} {why} Use a read-only command instead (no changes, no background jobs), or answer from what you already found.") } }).to_string());
    let Ok(v) = serde_json::from_str::<Value>(input) else { return deny("I couldn't read that request.") };
    let tool = v["tool_name"].as_str().unwrap_or("").to_string();
    let detail = ["command", "file_path", "path", "url", "pattern", "query"].iter().find_map(|k| v["tool_input"][*k].as_str()).unwrap_or("").to_string();
    PlanGuard::read_only(home).judge(&AgentStep { tool, detail }).and_then(|_| deny("that command could change something, or it isn't one I know only reads."))
}

/// Entry for `keeper --look-guard`: read the request on stdin, answer on stdout, exit 0.
pub fn run_hook() {
    let mut input = String::new();
    let _ = std::io::stdin().read_to_string(&mut input);
    let home = dirs::home_dir().unwrap_or_default();
    if let Some(answer) = decide(&input, &home) {
        println!("{answer}");
    }
}

/// The ids of tool calls in an assistant line, with their step (tool and input).
pub fn tool_uses(line: &Value) -> Vec<(String, AgentStep)> {
    line["message"]["content"].as_array().into_iter().flatten().filter(|i| i["type"] == "tool_use").map(|i| {
        let detail = ["command", "file_path", "path", "url", "pattern", "query"].iter().find_map(|k| i["input"][*k].as_str()).unwrap_or("").to_string();
        (i["id"].as_str().unwrap_or("").to_string(), AgentStep { tool: i["name"].as_str().unwrap_or("").to_string(), detail })
    }).collect()
}

/// True when a user line carries the result of a refused call that was NOT denied by the hook
/// (it ran): the backstop then stops the run.
pub fn backstop_tripped(line: &Value, refused: &std::collections::HashSet<String>) -> bool {
    line["message"]["content"].as_array().into_iter().flatten().any(|i| {
        i["type"] == "tool_result" && refused.contains(i["tool_use_id"].as_str().unwrap_or("")) && !i["content"].to_string().contains(MARK)
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::path::Path;

    #[test]
    fn reads_pass_changes_are_denied_with_the_reason() {
        let home = Path::new("/Users/x");
        assert!(super::decide(r#"{"tool_name":"Bash","tool_input":{"command":"arp -an"}}"#, home).is_none());
        assert!(super::decide(r#"{"tool_name":"Read","tool_input":{"file_path":"/etc/hosts"}}"#, home).is_none());
        let no = super::decide(r#"{"tool_name":"Bash","tool_input":{"command":"touch /tmp/x"}}"#, home).unwrap();
        assert!(no.contains("\"deny\"") && no.contains(super::MARK));
        assert!(super::decide(r#"{"tool_name":"Write","tool_input":{"file_path":"/Users/x/a.txt"}}"#, home).is_some());
        assert!(super::decide("not json", home).is_some(), "fails closed");
    }

    #[test]
    fn the_backstop_trips_only_when_a_refused_call_ran() {
        let refused: HashSet<String> = ["t1".to_string()].into();
        let denied = serde_json::json!({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","is_error":true,"content":format!("{} that changes things.", super::MARK)}]}});
        let ran = serde_json::json!({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"done"}]}});
        let other = serde_json::json!({"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t2","content":"done"}]}});
        assert!(!super::backstop_tripped(&denied, &refused));
        assert!(super::backstop_tripped(&ran, &refused));
        assert!(!super::backstop_tripped(&other, &refused));
    }
}
