//! The morning brief: one scene, built from the keeper's own graph and this computer, no AI:
//! today's reminders and calendar (agenda), what the keeper did lately (timeline), files that
//! changed (folder), and a spoken summary. Shown on the first open of the day and on "brief me"
//! (the `brief` ability); `recent_work` is "what was I working on yesterday" (`recent-work`).

use serde_json::json;

use super::super::super::Done;
use crate::kernel::time;
use crate::memory::Memory;

/// Files listed by name in the brief (screenshots are counted, not listed).
const BRIEF_FILES: usize = 8;

fn clock(iso: &str) -> String {
    time::parse_iso(iso).map(|t| t.with_timezone(&chrono::Local).format("%-I:%M %p").to_string()).unwrap_or_default()
}

/// Screenshots and recordings fold into one line, so the documents you worked on stay visible.
fn file_entries(files: &[crate::pim::FileHit]) -> Vec<serde_json::Value> {
    let is_capture = |name: &str| name.starts_with("Screenshot ") || name.starts_with("Screen Recording ");
    let captures = files.iter().filter(|f| is_capture(&f.name)).count();
    let mut entries: Vec<_> = files.iter().filter(|f| !is_capture(&f.name)).take(BRIEF_FILES).map(|f| json!({ "name": f.name, "kind": if f.kind == "folder" { "folder" } else { "file" }, "change": "kept" })).collect();
    if captures > 0 {
        entries.push(json!({ "name": format!("{captures} screenshot{}", if captures == 1 { "" } else { "s" }), "kind": "file", "change": "added" }));
    }
    entries
}

/// "What was I working on yesterday?": the files changed in the last `days` days, at once.
pub async fn recent_work(days: u32, when: &str) -> Done {
    let files = crate::pim::recent_files(days, 30).await.unwrap_or_default();
    if files.is_empty() {
        return Done::said(format!("I don't see any files you changed {when}."));
    }
    let entries = file_entries(&files);
    let first = files.iter().find(|f| !f.name.starts_with("Screen")).map(|f| f.name.clone()).unwrap_or_else(|| files[0].name.clone());
    let reply = format!("{} {when}, newest first. The latest is {first}.", if entries.len() == 1 { "Here's the file you changed".to_string() } else { format!("Here are the {} files you changed", entries.len()) });
    Done::said(reply).showing_raw(json!([{ "kind": "folder", "title": format!("Files you changed {when}"), "path": "~", "entries": entries }]))
}

/// The morning brief for the keeper called `keeper_name`, from its memory and this computer.
pub async fn compose(app: &tauri::AppHandle, memory: &Memory, keeper_name: &str) -> Done {
    let now = time::now();
    let tomorrow = now + chrono::Duration::hours(30);
    // The calendar is read only with permission; asking for the brief is a fine moment to ask
    // for it, and a refused or failed read is said out loud, never shown as an empty day.
    let (events, calendar_note) = crate::sdk::packs::calendar::read_events(app, now, tomorrow, true).await;
    let reminders: Vec<_> = memory.upcoming_reminders().await.unwrap_or_default().into_iter().filter(|r| time::parse_iso(&r.due_at).is_some_and(|d| d < tomorrow)).collect();
    // Events and reminders in one time order (`sdk::agenda`, the same rows "what's on tomorrow" shows).
    let agenda = crate::sdk::agenda::rows(&events, &reminders, now);

    let args = [("days".to_string(), "2".to_string())].into_iter().collect();
    let done: Vec<serde_json::Value> = memory
        .ask("actions-recent", &args)
        .await
        .map(|(rows, _)| rows.iter().take(6).map(|r| json!({ "when": clock(r.get("at").map(String::as_str).unwrap_or("")), "title": r.get("outcome").cloned().unwrap_or_default() })).collect())
        .unwrap_or_default();

    let files = crate::pim::recent_files(1, 30).await.unwrap_or_default();
    let mut panels = Vec::new();
    if !agenda.is_empty() {
        panels.push(json!({ "kind": "agenda", "title": "Today", "items": agenda }));
    }
    if !files.is_empty() {
        let entries = file_entries(&files);
        panels.push(json!({ "kind": "folder", "title": "Files you changed lately", "path": "~", "entries": entries }));
    }
    if !done.is_empty() {
        panels.push(json!({ "kind": "timeline", "title": format!("What {keeper_name} did lately"), "events": done }));
    }
    let greeting = match chrono::Local::now().format("%H").to_string().parse::<u32>().unwrap_or(9) {
        0..=11 => "Good morning",
        12..=16 => "Good afternoon",
        _ => "Good evening",
    };
    let changed = files.len().min(BRIEF_FILES);
    let reply = match (agenda.len(), changed) {
        (0, 0) => format!("{greeting}. Nothing on your agenda yet, and it's quiet on your computer."),
        (0, f) => format!("{greeting}. Your agenda is clear. You changed {f} file{} lately.", if f == 1 { "" } else { "s" }),
        (a, _) => format!("{greeting}. You have {a} thing{} coming up. It's all on your screen.", if a == 1 { "" } else { "s" }),
    };
    let reply = match calendar_note {
        Some(note) => format!("{reply} {note}"),
        None => reply,
    };
    Done::said(reply).showing_raw(serde_json::Value::Array(panels))
}

#[cfg(test)]
mod tests {
    use crate::pim::FileHit;

    fn f(name: &str) -> FileHit {
        FileHit { path: format!("/x/{name}"), name: name.into(), kind: "document".into(), modified: String::new() }
    }

    #[test]
    fn screenshots_fold_into_one_line() {
        let entries = super::file_entries(&[f("Screenshot 1.png"), f("Amendments.doc"), f("Screenshot 2.png")]);
        let names: Vec<_> = entries.iter().map(|e| e["name"].as_str().unwrap().to_string()).collect();
        assert_eq!(names, ["Amendments.doc", "2 screenshots"]);
    }
}
