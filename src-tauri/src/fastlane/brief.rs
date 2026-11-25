//! The morning brief: one scene, built from the keeper's own graph and this computer, no AI:
//! today's reminders and calendar (agenda), what the keeper did lately (timeline), files that
//! changed (folder), and a spoken summary. Shown on the first open of the day and on "brief me".

use serde_json::json;

use crate::brain::Thought;
use crate::kernel::settings::KeeperProfile;
use crate::kernel::time;
use crate::memory::Memory;

fn clock(iso: &str) -> String {
    time::parse_iso(iso).map(|t| t.with_timezone(&chrono::Local).format("%-I:%M %p").to_string()).unwrap_or_default()
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

    let files = crate::pim::recent_files(1, 8).await.unwrap_or_default();
    let mut panels = Vec::new();
    if !agenda.is_empty() {
        panels.push(json!({ "kind": "agenda", "title": "Today", "items": agenda }));
    }
    if !files.is_empty() {
        let entries: Vec<_> = files.iter().map(|f| json!({ "name": f.name, "kind": if f.kind == "folder" { "folder" } else { "file" }, "change": "kept" })).collect();
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
    let reply = match (agenda.len(), files.len()) {
        (0, 0) => format!("{greeting}. Nothing on your agenda yet, and it's quiet on your computer."),
        (0, f) => format!("{greeting}. Your agenda is clear. You changed {f} file{} lately.", if f == 1 { "" } else { "s" }),
        (a, _) => format!("{greeting}. You have {a} thing{} coming up. It's all on your screen.", if a == 1 { "" } else { "s" }),
    };
    Thought { reply, panels: serde_json::Value::Array(panels), ..Thought::default() }
}
