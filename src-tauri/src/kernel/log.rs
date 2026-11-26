//! Keeper's own log: what went wrong, kept on this computer only (`keeper.log` in the app's
//! folder, 0600, rotated at 1 MB with one older file kept), so a failure is never silent and
//! can be handed to support in one copy (`support_report`). Lines carry the area and a sentence;
//! never a message the person wrote, a fact, a key or a file's contents.

use std::io::Write;
use std::sync::Mutex;

use super::paths;

const MAX_BYTES: u64 = 1024 * 1024;
static WRITING: Mutex<()> = Mutex::new(());

fn file() -> std::path::PathBuf {
    paths::app_home().join("keeper.log")
}

/// One line, already safe to keep: control characters removed, at most 400 characters.
pub fn clean(text: &str) -> String {
    text.chars().map(|c| if c.is_control() { ' ' } else { c }).take(400).collect::<String>().trim().to_string()
}

/// Note something that went wrong in `area` ("node", "turn", "update", "panic").
pub fn error(area: &str, what: &str) {
    let Ok(_held) = WRITING.lock() else { return };
    let path = file();
    if std::fs::metadata(&path).is_ok_and(|m| m.len() > MAX_BYTES) {
        let _ = std::fs::rename(&path, path.with_extension("log.1"));
    }
    let line = format!("{} [{}] {}\n", super::time::now_iso(), clean(area), clean(what));
    let fresh = !path.exists();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line.as_bytes());
    }
    if fresh {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        }
    }
}

/// The last `n` lines of the log (oldest first).
pub fn tail(n: usize) -> Vec<String> {
    let text = std::fs::read_to_string(file()).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(n)..].iter().map(|l| l.to_string()).collect()
}

/// Every panic is written to the log before the process ends (no crash goes unrecorded).
pub fn catch_panics() {
    let before = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let place = info.location().map(|l| format!("{}:{}", l.file(), l.line())).unwrap_or_default();
        let what = info.payload().downcast_ref::<&str>().map(|s| s.to_string()).or_else(|| info.payload().downcast_ref::<String>().cloned()).unwrap_or_else(|| "a panic".into());
        error("panic", &format!("{what} at {place}"));
        before(info);
    }));
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_line_is_one_line_and_short() {
        assert_eq!(super::clean("node\nanswered 503\u{7}"), "node answered 503");
        assert_eq!(super::clean(&"x".repeat(900)).chars().count(), 400);
    }
}
