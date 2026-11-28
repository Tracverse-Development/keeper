//! What the Mac reports about itself: the battery (`pmset`), Wi-Fi (`system_profiler`), the open
//! apps (`lsappinfo`), the time in another zone (`date` with `TZ`) and the person's Shortcuts.
//! Every tool runs with argv only and a time limit; each reply is read by a pure parser below,
//! tested on real output.

use std::time::Duration;

use tokio::process::Command;

use super::macos::tool_output;
use super::status::{Battery, WiFi, ZoneTime};
use crate::kernel::{DeskError, Result};

const QUICK: Duration = Duration::from_secs(5);
/// `system_profiler` takes three or four seconds to ask the Wi-Fi card.
const SLOW: Duration = Duration::from_secs(12);
const ZONES: &str = "/usr/share/zoneinfo";

pub async fn battery() -> Result<Option<Battery>> {
    Ok(battery_from(&tool_output(Command::new("/usr/bin/pmset").args(["-g", "batt"]), QUICK, "I couldn't read the battery.").await?))
}

/// `pmset -g batt`: "Now drawing from 'AC Power'" then " -InternalBattery-0 (id=…)\t58%; charging; 1:05 remaining present: true".
fn battery_from(text: &str) -> Option<Battery> {
    let line = text.lines().find(|l| l.contains("InternalBattery"))?;
    let fields: Vec<&str> = line.split('\t').nth(1)?.split(';').map(str::trim).collect();
    let percent = fields.first()?.trim_end_matches('%').parse::<u8>().ok()?.min(100);
    let raw_state = fields.get(1).copied().unwrap_or_default();
    let on_power = text.contains("'AC Power'");
    let state = match raw_state {
        "charging" | "finishing charge" => "charging",
        "charged" => "fully charged",
        "discharging" if !on_power => "on battery",
        _ if on_power => "plugged in, not charging",
        _ => "on battery",
    };
    let remaining = fields.get(2).and_then(|f| f.split_whitespace().next()).filter(|t| t.contains(':') && *t != "0:00").map(str::to_string);
    Some(Battery { percent, state: state.into(), on_power, remaining })
}

pub async fn wifi() -> Result<WiFi> {
    let json = tool_output(Command::new("/usr/sbin/system_profiler").args(["SPAirPortDataType", "-json"]), SLOW, "I couldn't ask the Wi-Fi card.").await?;
    wifi_from(&serde_json::from_str(&json).unwrap_or_default()).ok_or_else(|| DeskError::Invalid("This Mac has no Wi-Fi.".into()))
}

/// `system_profiler SPAirPortDataType -json`: the first interface that reports a status (en0).
fn wifi_from(report: &serde_json::Value) -> Option<WiFi> {
    let interfaces = report["SPAirPortDataType"][0]["spairport_airport_interfaces"].as_array()?;
    let card = interfaces.iter().find(|i| i.get("spairport_status_information").is_some())?;
    if card["spairport_status_information"] != "spairport_status_connected" {
        return Some(WiFi::default());
    }
    let now = &card["spairport_current_network_information"];
    // "-58 dBm / -90 dBm": signal, then noise.
    let levels: Vec<i32> = now["spairport_signal_noise"].as_str().unwrap_or_default().split('/').filter_map(|p| p.trim().trim_end_matches("dBm").trim().parse().ok()).collect();
    Some(WiFi {
        connected: true,
        name: now["_name"].as_str().filter(|n| !n.is_empty() && *n != "<redacted>").map(str::to_string),
        signal_dbm: levels.first().copied(),
        noise_dbm: levels.get(1).copied(),
        channel: now["spairport_network_channel"].as_str().map(str::to_string),
        rate_mbps: now["spairport_network_rate"].as_u64().map(|r| r as u32),
    })
}

pub async fn open_apps() -> Result<Vec<String>> {
    Ok(apps_from(&tool_output(Command::new("/usr/bin/lsappinfo").arg("list"), QUICK, "I couldn't see which apps are open.").await?))
}

/// `lsappinfo list`: blocks headed ` 12) "Name" ASN:…`, each with a `type="…"` line; the apps a
/// person sees are the "Foreground" ones (helpers are "UIElement" or "BackgroundOnly").
fn apps_from(text: &str) -> Vec<String> {
    let mut apps = Vec::new();
    let mut name: Option<String> = None;
    for line in text.lines() {
        let trimmed = line.trim_start();
        if trimmed.split(')').next().is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit())) {
            // Names can carry an invisible left-to-right mark ("‎WhatsApp").
            name = trimmed.split('"').nth(1).map(|n| n.replace('\u{200e}', ""));
        } else if trimmed.contains("type=\"Foreground\"") {
            apps.extend(name.take());
        }
    }
    apps
}

/// Zone names are checked here as well as by the caller: letters, `_`, `+`, `-` in at most three
/// parts ("America/Argentina/Buenos_Aires"), never `..`, and the zone file must exist, because
/// `date` silently answers in UTC for a zone it does not know.
pub async fn time_in_zone(zone: &str) -> Result<ZoneTime> {
    let unknown = || DeskError::Invalid(format!("I don't know the time zone {zone}."));
    let well_formed = zone.split('/').count() <= 3 && zone.split('/').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || "_+-".contains(c)) && !p.starts_with('-'));
    if !well_formed || !std::path::Path::new(ZONES).join(zone).is_file() {
        return Err(unknown());
    }
    let out = tool_output(Command::new("/bin/date").arg("+%H:%M|%A|%Z|%z").env("TZ", zone), QUICK, "I couldn't read the clock.").await?;
    zone_time_from(&out).ok_or_else(unknown)
}

/// `date +%H:%M|%A|%Z|%z`: "08:52|Saturday|JST|+0900".
fn zone_time_from(text: &str) -> Option<ZoneTime> {
    let mut parts = text.trim().split('|');
    let (clock, weekday, abbreviation, offset) = (parts.next()?, parts.next()?, parts.next()?, parts.next()?);
    let sign = if offset.starts_with('-') { -1 } else { 1 };
    let digits = offset.trim_start_matches(['+', '-']);
    let (hours, minutes) = (digits.get(0..2)?.parse::<i32>().ok()?, digits.get(2..4)?.parse::<i32>().ok()?);
    Some(ZoneTime { clock: clock.into(), weekday: weekday.into(), abbreviation: abbreviation.into(), offset_minutes: sign * (hours * 60 + minutes) })
}

pub async fn shortcuts() -> Result<Vec<String>> {
    let out = tool_output(Command::new("/usr/bin/shortcuts").arg("list"), QUICK, "I couldn't read your Shortcuts.").await?;
    Ok(out.lines().map(str::trim).filter(|l| !l.is_empty()).map(str::to_string).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_battery_reads_in_words() {
        let charging = battery_from("Now drawing from 'AC Power'\n -InternalBattery-0 (id=27328611)\t58%; charging; (no estimate) present: true\n").unwrap();
        assert_eq!(charging, Battery { percent: 58, state: "charging".into(), on_power: true, remaining: None });
        let draining = battery_from("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t87%; discharging; 4:12 remaining present: true").unwrap();
        assert_eq!((draining.state.as_str(), draining.remaining.as_deref(), draining.on_power), ("on battery", Some("4:12"), false));
        let full = battery_from("Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t100%; charged; 0:00 remaining present: true").unwrap();
        assert_eq!((full.state.as_str(), full.remaining), ("fully charged", None));
        let held = battery_from("Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t80%; AC attached; not charging present: true").unwrap();
        assert_eq!(held.state, "plugged in, not charging");
        assert_eq!(battery_from("Now drawing from 'AC Power'\n"), None, "a desktop Mac has no battery");
    }

    #[test]
    fn wifi_reads_signal_and_hides_a_redacted_name() {
        let report = serde_json::json!({ "SPAirPortDataType": [{ "spairport_airport_interfaces": [
            { "_name": "en0", "spairport_status_information": "spairport_status_connected", "spairport_current_network_information": { "_name": "<redacted>", "spairport_network_channel": "100 (5GHz, 80MHz)", "spairport_network_rate": 216, "spairport_signal_noise": "-58 dBm / -90 dBm" } },
            { "_name": "awdl0", "spairport_current_network_information": { "spairport_network_type": "spairport_network_type_station" } }
        ] }] });
        let w = wifi_from(&report).unwrap();
        assert_eq!(w, WiFi { connected: true, name: None, signal_dbm: Some(-58), noise_dbm: Some(-90), channel: Some("100 (5GHz, 80MHz)".into()), rate_mbps: Some(216) });
        let named = serde_json::json!({ "SPAirPortDataType": [{ "spairport_airport_interfaces": [{ "spairport_status_information": "spairport_status_connected", "spairport_current_network_information": { "_name": "Home" } }] }] });
        assert_eq!(wifi_from(&named).unwrap().name.as_deref(), Some("Home"));
        let off = serde_json::json!({ "SPAirPortDataType": [{ "spairport_airport_interfaces": [{ "spairport_status_information": "spairport_status_off" }] }] });
        assert!(!wifi_from(&off).unwrap().connected);
        assert_eq!(wifi_from(&serde_json::json!({})), None);
    }

    #[test]
    fn only_foreground_apps_count_as_open() {
        let text = " 1) \"loginwindow\" ASN:0x0-0x1001: \n    type=\"UIElement\" flavor=3\n 2) \"Finder\" ASN:0x0-0x3a03a: \n    bundleID=\"com.apple.finder\"\n    pid = 900 type=\"Foreground\" flavor=3\n 3) \"\u{200e}WhatsApp\" ASN:0x0-0x8fc8fc: \n    pid = 901 type=\"Foreground\"\n 4) \"sharingd\" ASN:0x0-0x9009: \n    type=\"BackgroundOnly\"\n";
        assert_eq!(apps_from(text), ["Finder", "WhatsApp"]);
    }

    #[test]
    fn a_zone_clock_reads_its_offset() {
        assert_eq!(zone_time_from("08:52|Saturday|JST|+0900\n").unwrap(), ZoneTime { clock: "08:52".into(), weekday: "Saturday".into(), abbreviation: "JST".into(), offset_minutes: 540 });
        assert_eq!(zone_time_from("19:22|Friday|-0330|-0330").unwrap().offset_minutes, -210);
        assert_eq!(zone_time_from("nonsense"), None);
    }

    #[tokio::test]
    async fn zone_names_are_checked_before_date_runs() {
        for bad in ["../../etc/passwd", "Asia/../../etc", "-u", "Nowhere/Atlantis", ""] {
            assert!(time_in_zone(bad).await.is_err(), "{bad:?}");
        }
        // A real read of this Mac's clock database (harmless).
        assert_eq!(time_in_zone("Asia/Tokyo").await.unwrap().offset_minutes, 540);
    }
}
