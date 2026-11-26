// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Claude Code calls this program back as the look hook (allow or deny one tool call).
    if std::env::args().nth(1).as_deref() == Some("--look-guard") {
        return keeper_lib::look_guard_hook();
    }
    keeper_lib::run();
}
