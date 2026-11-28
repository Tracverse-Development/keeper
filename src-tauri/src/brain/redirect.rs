//! Changing course mid-turn ("leave the heading alone", "use metric"): the engine run is stopped
//! (`engines::cli::redirect`) and started again with the same request, the person's
//! corrections, and what it had already done on the computer, so it carries on instead of
//! starting from zero.
//!
//! Why a fresh run and not the engine's own session: Keeper runs Claude Code with
//! `--no-session-persistence` (nothing of the person's work is saved in Claude Code's own
//! files), so there is no session to `--resume`; the other engines have none either. The steps
//! recorded this turn are the memory the new run starts from.

use super::context::AgentStep;
use super::engines::cli;

/// At most this many corrections in one turn (then the run is simply stopped).
pub const MOST: usize = 5;
/// The steps the new run is told about (the latest ones; earlier ones are counted).
const STEPS_TOLD: usize = 20;
/// Longest step detail told to the new run.
const DETAIL_TOLD: usize = 300;

/// A live step line ("Bash: ls ~/Desktop", "Running: ls") as the step it reports.
pub fn step_from(line: &str) -> AgentStep {
    match line.split_once(": ") {
        Some((tool, detail)) if !tool.is_empty() && !tool.contains(' ') => AgentStep { tool: if tool == "Running" { "command".into() } else { tool.to_string() }, detail: detail.to_string() },
        _ => AgentStep { tool: "step".into(), detail: line.to_string() },
    }
}

/// The message the new run is sent: the person's request, their corrections (newest last,
/// and they win), and the steps already done, which really happened and are not to be redone.
pub fn prompt(request: &str, corrections: &[String], done: &[AgentStep]) -> String {
    let mut out = format!("{}\n\n", request.trim());
    out.push_str("While you were working on this, I changed course:\n");
    for c in corrections {
        out.push_str(&format!("- {}\n", c.trim()));
    }
    out.push_str("Follow my corrections: where they differ from the request, the corrections win (the last one most).\n\n");
    if done.is_empty() {
        out.push_str("You had not done anything on the computer yet.");
        return out;
    }
    out.push_str("Before I stopped you, you had already done these steps on the computer. They really happened: don't repeat them unless my correction needs it, and don't undo anything I didn't ask you to undo.\n");
    let skipped = done.len().saturating_sub(STEPS_TOLD);
    if skipped > 0 {
        out.push_str(&format!("({skipped} earlier steps not listed.)\n"));
    }
    for (i, step) in done.iter().skip(skipped).enumerate() {
        out.push_str(&format!("{}. {}: {}\n", skipped + i + 1, step.tool, cli::short(&step.detail, DETAIL_TOLD)));
    }
    out.push_str("Carry on from there.");
    out
}

/// What the turn's record keeps of the person's words when they changed course: the request,
/// then each correction ("Changed course: use metric"), so a reopened chat shows the whole story.
pub fn told_with(told: &str, corrections: &[String]) -> String {
    corrections.iter().fold(told.to_string(), |acc, c| format!("{acc}\nChanged course: {}", c.trim()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn step(tool: &str, detail: &str) -> AgentStep {
        AgentStep { tool: tool.into(), detail: detail.into() }
    }

    #[test]
    fn live_lines_become_steps() {
        assert_eq!(step_from("Bash: ls ~/Desktop"), step("Bash", "ls ~/Desktop"));
        assert_eq!(step_from("Edit: /tmp/a: b.md"), step("Edit", "/tmp/a: b.md"));
        assert_eq!(step_from("Running: ls -la"), step("command", "ls -la"));
        assert_eq!(step_from("something happened"), step("step", "something happened"));
    }

    #[test]
    fn the_new_run_hears_the_request_the_correction_and_what_was_done() {
        let p = prompt("Tidy my notes file", &["leave the heading alone".into()], &[step("Read", "~/notes.md"), step("Edit", "~/notes.md")]);
        assert!(p.starts_with("Tidy my notes file\n"));
        assert!(p.contains("- leave the heading alone\n"));
        assert!(p.contains("the corrections win"));
        assert!(p.contains("1. Read: ~/notes.md\n2. Edit: ~/notes.md\n"));
        assert!(p.contains("don't repeat them"));
        assert!(p.ends_with("Carry on from there."));
    }

    #[test]
    fn nothing_done_yet_is_said_plainly() {
        let p = prompt("Convert the recipe", &["use metric".into(), "and grams, not ml".into()], &[]);
        assert!(p.contains("- use metric\n- and grams, not ml\n"));
        assert!(p.ends_with("You had not done anything on the computer yet."));
    }

    #[test]
    fn a_long_history_keeps_the_latest_steps_and_counts_the_rest() {
        let done: Vec<_> = (1..=25).map(|i| step("Bash", &format!("echo {i}"))).collect();
        let p = prompt("Do it", &["stop at 30".into()], &done);
        assert!(p.contains("(5 earlier steps not listed.)"));
        assert!(!p.contains("5. Bash: echo 5\n"));
        assert!(p.contains("6. Bash: echo 6\n") && p.contains("25. Bash: echo 25\n"));
        let long = prompt("Do it", &["x".into()], &[step("Bash", &"a".repeat(1000))]);
        assert!(long.contains(&"a".repeat(DETAIL_TOLD)) && !long.contains(&"a".repeat(DETAIL_TOLD + 1)), "a long command is cut for the new run");
    }

    #[test]
    fn the_record_keeps_each_correction() {
        assert_eq!(told_with("Tidy my notes", &["leave the heading alone".into()]), "Tidy my notes\nChanged course: leave the heading alone");
        assert_eq!(told_with("Hi", &[]), "Hi");
    }
}
