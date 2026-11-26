//! Time in one format everywhere: RFC 3339 UTC, the shape `xsd:dateTime` takes on the DKG.

use chrono::{DateTime, SecondsFormat, Utc};

pub fn now() -> DateTime<Utc> {
    Utc::now()
}

pub fn iso(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn now_iso() -> String {
    iso(now())
}

pub fn parse_iso(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s).ok().map(|t| t.with_timezone(&Utc))
}

/// Wait until the wall clock reaches `until`, in steps of at most half a minute, so time the
/// Mac spends asleep counts (a single long sleep pauses with the computer and wakes late: review
/// finding on reminders and focus sessions).
pub async fn sleep_until(until: chrono::DateTime<chrono::Utc>) {
    const STEP: std::time::Duration = std::time::Duration::from_secs(30);
    loop {
        let left = (until - now()).to_std().unwrap_or_default();
        if left.is_zero() {
            return;
        }
        tokio::time::sleep(left.min(STEP)).await;
    }
}
