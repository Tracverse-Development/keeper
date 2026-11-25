//! The morning brief: one scene, built from the keeper's own graph and this computer, no AI:
//! today's reminders and calendar (agenda), what the keeper did lately (timeline), files that
//! changed (folder), and a spoken summary. Shown on the first open of the day and on "brief me".

use serde_json::json;

use crate::brain::Thought;
use crate::kernel::settings::KeeperProfile;
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

pub async fn compose(app: &tauri::AppHandle, memory: &Memory, keeper: &KeeperProfile) -> Thought {
    let now = time::now();
    let tomorrow = now + chrono::Duration::hours(30);
    let mut agenda: Vec<serde_json::Value> = Vec::new();

    let events = crate::pim::events(app, &time::iso(now), &time::iso(tomorrow)).await.unwrap_or_default();
    for e in events.iter().take(10) {
        agenda.push(json!({ "time": if e.all_day { "All day".to_string() } else { clock(&e.start) }, "title": e.title, "detail": e.location, "kind": "event" }));
    }
    let reminders = memory.upcoming_reminders().await.unwrap_or_default();
    for r in reminders.iter().filter(|r| time::parse_iso(&r.due_at).is_some_and(|d| d < tomorrow)).take(10) {
        agenda.push(json!({ "time": clock(&r.due_at), "title": r.text, "kind": "reminder" }));
    }

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
        panels.push(json!({ "kind": "timeline", "title": format!("What {} did lately", keeper.name), "events": done }));
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
    Thought { reply, panels: serde_json::Value::Array(panels), ..Thought::default() }
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
