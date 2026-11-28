//! Email on the Mac. Composing opens the person's own mail app on a `mailto:` link (whatever app
//! they chose: Apple Mail, Outlook…), filled in and never sent: they read it and press Send.
//! Reading lists the unread messages of Apple Mail's inbox, their sender, subject and when they
//! arrived only (never a message's words), after macOS has asked the person to let Keeper use
//! Mail. The script is fixed text; the count reaches it only as an `argv` item.

use std::time::Duration;

use tokio::process::Command;

use super::macos::tool_output;
use super::Unread;
use crate::kernel::{DeskError, Result};

/// Asking Mail may make macOS ask the person first, and a big inbox takes a moment.
const MAY_ASK: Duration = Duration::from_secs(90);
/// Fields and messages are separated by characters a subject never holds.
const FIELD: char = '\u{1f}';
const ROW: char = '\u{1e}';

const UNREAD_SCRIPT: &str = r#"on run argv
set wanted to (item 1 of argv) as integer
set out to ""
tell application "Mail"
  set waiting to (messages of inbox whose read status is false)
  set total to count of waiting
  if total < wanted then set wanted to total
  repeat with i from 1 to wanted
    set m to item i of waiting
    set out to out & (sender of m) & (ASCII character 31) & (subject of m) & (ASCII character 31) & ((date received of m) as «class isot» as string) & (ASCII character 30)
  end repeat
  return (total as string) & (ASCII character 30) & out
end tell
end run"#;

/// Opens the person's mail app on a filled-in `mailto:` link (built and checked by the caller).
pub fn compose(mailto: &str) -> Result<()> {
    if !mailto.starts_with("mailto:") {
        return Err(DeskError::Invalid("That isn't an email to open.".into()));
    }
    std::process::Command::new("/usr/bin/open").arg(mailto).status().ok().filter(|s| s.success()).map(drop).ok_or_else(|| DeskError::Io("I couldn't open your mail app.".into()))
}

/// How many unread messages Apple Mail's inbox holds, and the newest `limit` of them.
pub async fn unread(limit: usize) -> Result<(usize, Vec<Unread>)> {
    let out = tool_output(Command::new("/usr/bin/osascript").arg("-e").arg(UNREAD_SCRIPT).arg(limit.to_string()), MAY_ASK, "I couldn't read your inbox. Keeper may need permission to use Mail (System Settings, Privacy & Security, Automation), and Mail needs an account set up.").await?;
    Ok(parse(&out))
}

/// The script's answer: the total, then one row per message.
pub fn parse(out: &str) -> (usize, Vec<Unread>) {
    let mut rows = out.trim_end_matches(['\n', '\r']).split(ROW);
    let total = rows.next().and_then(|t| t.trim().parse().ok()).unwrap_or(0);
    let list = rows
        .filter(|r| !r.trim().is_empty())
        .filter_map(|r| {
            let mut f = r.split(FIELD);
            Some(Unread { from: f.next()?.trim().to_string(), subject: f.next()?.trim().to_string(), received: f.next().unwrap_or("").trim().to_string() })
        })
        .collect();
    (total, list)
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_inbox_answer_reads_as_rows() {
        let out = "2\u{1e}Ann <ann@example.com>\u{1f}Dinner on Saturday?\u{1f}2026-11-28T09:15:00\u{1e}Bank\u{1f}Your statement\u{1f}2026-11-27T18:00:00\u{1e}\n";
        let (total, rows) = super::parse(out);
        assert_eq!(total, 2);
        assert_eq!(rows.len(), 2);
        assert_eq!((rows[0].from.as_str(), rows[0].subject.as_str()), ("Ann <ann@example.com>", "Dinner on Saturday?"));
        assert_eq!(super::parse("0\u{1e}\n"), (0, vec![]));
    }

    #[test]
    fn only_a_mailto_link_is_opened() {
        assert!(super::compose("https://example.com").is_err());
        assert!(super::compose("file:///etc/passwd").is_err());
    }
}
