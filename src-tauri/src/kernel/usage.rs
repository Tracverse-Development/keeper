//! What the cloud minds cost: a small ledger of spending per calendar month, kept in the app's
//! folder (0600) and in memory. Only amounts and counts are kept, never what was asked.
//!
//! The amount comes from the engine itself (Claude Code reports each answer's cost at API
//! prices; under a subscription that is what it would have cost, not a bill). A monthly limit
//! in Settings (`Settings::monthly_cap_usd`) is checked against it: once reached, turns stay on
//! this computer (a local model, or the built-in mind) and background helper calls stop.

use std::collections::BTreeMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use super::paths;

/// Months kept in the file (older ones are dropped).
const KEEP_MONTHS: usize = 24;

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Month {
    /// Dollars at the engines' own prices.
    pub usd: f64,
    /// Calls that reported a cost (answers and background helper calls).
    pub calls: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct Ledger {
    months: BTreeMap<String, Month>,
}

static LEDGER: Mutex<Option<Ledger>> = Mutex::new(None);

fn file() -> std::path::PathBuf {
    paths::app_home().join("usage.json")
}

/// The calendar month a moment falls in, in the person's own time ("2026-11").
pub fn month_key(now: chrono::DateTime<chrono::Local>) -> String {
    now.format("%Y-%m").to_string()
}

/// Add one call's cost to `key`'s month; amounts that are not a sane cost are ignored.
fn add(ledger: &mut Ledger, key: &str, usd: f64) {
    if !usd.is_finite() || !(0.0..=1000.0).contains(&usd) {
        return;
    }
    let month = ledger.months.entry(key.to_string()).or_default();
    month.usd += usd;
    month.calls += 1;
    while ledger.months.len() > KEEP_MONTHS {
        let Some(oldest) = ledger.months.keys().next().cloned() else { break };
        ledger.months.remove(&oldest);
    }
}

fn with<T>(f: impl FnOnce(&mut Ledger) -> T) -> Option<T> {
    let mut guard = LEDGER.lock().ok()?;
    let ledger = guard.get_or_insert_with(|| std::fs::read(file()).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default());
    Some(f(ledger))
}

/// Record one call's cost (now); written to the file at once.
pub fn record(usd: f64) {
    let key = month_key(chrono::Local::now());
    with(|ledger| {
        add(ledger, &key, usd);
        if let Ok(bytes) = serde_json::to_vec(ledger) {
            let _ = paths::write_private(&file(), &bytes);
        }
    });
}

/// This month so far.
pub fn this_month() -> Month {
    let key = month_key(chrono::Local::now());
    with(|ledger| ledger.months.get(&key).copied().unwrap_or_default()).unwrap_or_default()
}

/// Has this month's spending reached `cap` dollars? A cap of 0 (or less) means no limit.
pub fn reached(cap: f64, spent: f64) -> bool {
    cap > 0.0 && spent >= cap
}

/// Is the monthly limit reached right now?
pub fn over(cap: f64) -> bool {
    reached(cap, this_month().usd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn costs_add_up_per_month_and_nonsense_is_ignored() {
        let mut ledger = Ledger::default();
        add(&mut ledger, "2026-11", 0.02);
        add(&mut ledger, "2026-11", 0.03);
        add(&mut ledger, "2026-12", 0.5);
        add(&mut ledger, "2026-12", f64::NAN);
        add(&mut ledger, "2026-12", -1.0);
        add(&mut ledger, "2026-12", 5000.0);
        assert!((ledger.months["2026-11"].usd - 0.05).abs() < 1e-9);
        assert_eq!((ledger.months["2026-11"].calls, ledger.months["2026-12"].calls), (2, 1));
    }

    #[test]
    fn only_the_last_two_years_are_kept_and_a_limit_of_zero_is_no_limit() {
        let mut ledger = Ledger::default();
        for year in 2020..2030 {
            for month in 1..=12 {
                add(&mut ledger, &format!("{year}-{month:02}"), 1.0);
            }
        }
        assert_eq!(ledger.months.len(), KEEP_MONTHS);
        assert!(ledger.months.contains_key("2029-12") && !ledger.months.contains_key("2020-01"));
        assert!(!reached(0.0, 99.0));
        assert!(reached(5.0, 5.0) && !reached(5.0, 4.99));
    }
}
