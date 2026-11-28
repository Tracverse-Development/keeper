//! Looking at this computer, changing nothing: the battery, Wi-Fi, free disk space, the open
//! apps, the time in another place, the person's Shortcuts. Each answers in a sentence and,
//! where a table says it better, shows one. "What's my battery?", "what Wi-Fi am I on?" and "how
//! much space do I have?" are also instant answers (their whole phrasings below).

use std::sync::OnceLock;

use regex::Regex;

use super::super::super::{input, instant, Ability, Access, Done, Instant, ALL, MAC};
use super::{cities, counted, duration_words, names, readings, sentence_case, some_of, twelve_hour};
use crate::kernel::{DeskError, Result};
use crate::platform;

pub const ABILITIES: &[Ability] = &[
    Ability { id: "battery", how: "{} says how much battery is left and whether it is charging", access: Access::Look, platforms: MAC, modes: &["assistant"], instant: Instant::Also(battery_words), run: |_, _| Box::pin(battery()) },
    Ability { id: "wifi", how: "{} says which Wi-Fi network the Mac is on and how strong the signal is", access: Access::Look, platforms: MAC, modes: &["assistant"], instant: Instant::Also(wifi_words), run: |_, _| Box::pin(wifi()) },
    Ability { id: "disk-space", how: "{} says how much space is free on the startup disk", access: Access::Look, platforms: ALL, modes: &["assistant"], instant: Instant::Also(disk_words), run: |_, _| Box::pin(async { disk_space() }) },
    Ability { id: "computer-status", how: "\"how's my computer\", \"system status\": the processor and memory load right now, as a chart", access: Access::Look, platforms: ALL, modes: &[], instant: Instant::Only(status_words), run: |_, _| Box::pin(async { Ok(status()) }) },
    Ability { id: "open-apps", how: "{} lists the apps open right now", access: Access::Look, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |_, _| Box::pin(open_apps()) },
    Ability { id: "time-in", how: "{\"place\": \"Tokyo\"} tells the time now in a city or country (or an IANA zone like Europe/Paris)", access: Access::Look, platforms: MAC, modes: &["assistant", "companion"], instant: Instant::No, run: |input, _| Box::pin(time_in(input)) },
    Ability { id: "list-shortcuts", how: "{} lists the person's Shortcuts (from the Shortcuts app)", access: Access::Look, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |_, _| Box::pin(list_shortcuts()) },
];

/// The whole phrasings that ask for a reading at once; anything else about the battery or the
/// network ("why does my battery drain so fast?") goes to the mind.
const BATTERY_ASKS: &str = r"(?i)^(?:please\s+)?(?:what(?:'s| is) my battery(?: level| at)?|how much battery (?:do i have|is left|have i got)(?: left)?|battery(?: level| status)?|is my (?:mac|laptop|computer) charging|how(?:'s| is) my battery)\s*[?.!]?$";
const WIFI_ASKS: &str = r"(?i)^(?:please\s+)?(?:what wi-?fi am i on|which wi-?fi (?:am i on|is this)|what(?:'s| is) my wi-?fi(?: signal| network)?|how(?:'s| is) my wi-?fi(?: signal)?|wi-?fi (?:signal|status))\s*[?.!]?$";
const DISK_ASKS: &str = r"(?i)^(?:please\s+)?(?:how much (?:free )?(?:disk |storage )?space (?:do i have|is left|have i got)(?: left)?(?: on (?:my|this) (?:mac|computer|disk|drive))?|(?:free )?disk space|how full is (?:my|this) (?:disk|drive|mac|computer))\s*[?.!]?$";

/// "How's my computer?", "system status", "how much memory am I using".
const STATUS_ASKS: &str = r"(?i)^(?:how(?:'s| is) my (?:computer|mac|system)|system status|how much (?:memory|ram|cpu)\b.*)\??$";

fn status_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, STATUS_ASKS, said)
}

fn battery_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, BATTERY_ASKS, said)
}

fn wifi_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, WIFI_ASKS, said)
}

fn disk_words(said: &str) -> Option<serde_json::Value> {
    static R: OnceLock<Regex> = OnceLock::new();
    instant::whole(&R, DISK_ASKS, said)
}

/// The processor and memory load now, in a sentence and a chart.
fn status() -> Done {
    let load = crate::system::read();
    let words = if load.cpu > 80.0 { "working hard" } else if load.cpu > 40.0 { "fairly busy" } else { "calm" };
    Done::said(format!("Your computer is {words}: processor at {:.0}%, memory at {:.0}%.", load.cpu, load.memory))
        .showing_raw(serde_json::json!([{ "kind": "chart", "title": "Right now", "labels": ["Processor", "Memory"], "values": [load.cpu.round(), load.memory.round()], "unit": "%" }]))
}

async fn battery() -> Result<Done> {
    let Some(b) = platform::battery().await? else { return Ok(Done::said("This Mac has no battery; it runs on mains power.")) };
    let until = if b.state == "charging" { "until full" } else { "left" };
    let time = b.remaining.as_ref().map(|t| format!(" ({} {until})", hours_and_minutes(t))).unwrap_or_default();
    let mut rows = vec![("Charge", format!("{}%", b.percent)), ("State", sentence_case(&b.state)), ("Power", if b.on_power { "Power adapter".into() } else { "Battery".into() })];
    if let Some(t) = &b.remaining {
        rows.push(if b.state == "charging" { ("Until full", hours_and_minutes(t)) } else { ("Time left", hours_and_minutes(t)) });
    }
    Ok(Done::said(format!("Your battery is at {}%, {}{time}.", b.percent, b.state)).showing(readings("battery", "Battery", &rows)))
}

/// "4:05" (the system's hours:minutes) → "4 hours 5 minutes".
fn hours_and_minutes(clock: &str) -> String {
    let (h, m) = clock.split_once(':').unwrap_or(("0", clock));
    duration_words(h.parse::<u32>().unwrap_or(0) * 60 + m.parse::<u32>().unwrap_or(0))
}

async fn wifi() -> Result<Done> {
    let w = platform::wifi().await?;
    if !w.connected {
        return Ok(Done::said("This Mac isn't on Wi-Fi right now."));
    }
    let on = w.name.as_ref().map(|n| format!("on {n}")).unwrap_or_else(|| "on Wi-Fi".into());
    let signal = match (w.signal_words(), w.signal_dbm) {
        (Some(words), Some(dbm)) => format!(" with {} {words} signal ({dbm} dBm)", if words == "excellent" { "an" } else { "a" }),
        _ => String::new(),
    };
    let hidden = if w.name.is_none() { " macOS keeps the network's name private unless Keeper may use Location Services." } else { "" };
    let rows: Vec<(&str, String)> = [
        ("Network", Some(w.name.clone().unwrap_or_else(|| "Hidden by macOS".into()))),
        ("Signal", w.signal_dbm.map(|s| format!("{s} dBm, {}", w.signal_words().unwrap_or_default()))),
        ("Noise", w.noise_dbm.map(|n| format!("{n} dBm"))),
        ("Channel", w.channel.clone()),
        ("Speed", w.rate_mbps.map(|r| format!("{r} Mbps"))),
    ]
    .into_iter()
    .filter_map(|(what, value)| value.map(|v| (what, v)))
    .collect();
    Ok(Done::said(format!("You're {on}{signal}.{hidden}")).showing(readings("wifi", "Wi-Fi", &rows)))
}

fn disk_space() -> Result<Done> {
    let space = crate::system::startup_disk().ok_or_else(|| DeskError::Io("I couldn't read the disk.".into()))?;
    let gb = |bytes: f64| (bytes / crate::system::GB).round();
    let (free, used, total) = (gb(space.free), gb(space.used()), gb(space.total));
    let chart = crate::stage::Panel::Chart { id: "disk".into(), title: "Startup disk".into(), labels: vec![format!("Used, {used:.0} GB"), format!("Free, {free:.0} GB")], values: vec![used, free], unit: Some("GB".into()) };
    Ok(Done::said(format!("You have {free:.0} GB free of {total:.0} GB on your startup disk.")).showing(chart))
}

async fn open_apps() -> Result<Done> {
    let apps = platform::open_apps().await?;
    if apps.is_empty() {
        return Ok(Done::said("No apps are open apart from the system's own."));
    }
    Ok(Done::said(format!("You have {} open: {}.", counted(apps.len(), "app"), some_of(&apps, 6))).showing(names("apps", "Open apps", "App", &apps)))
}

async fn time_in(input: &serde_json::Value) -> Result<Done> {
    let place = input::text(input, "place")?;
    let zone = cities::zone_for(place).ok_or_else(|| DeskError::Invalid(format!("I don't know the time zone for {place}. Try a big city nearby.")))?;
    let there = platform::time_in_zone(&zone).await?;
    let here = chrono::Local::now().offset().local_minus_utc() / 60;
    Ok(Done::said(format!("In {} it's {} on {} ({}), {}.", sentence_case(place), twelve_hour(&there.clock), there.weekday, there.abbreviation, difference(there.offset_minutes - here))))
}

/// "9 hours ahead of you", "5 hours 30 minutes behind you", "the same time as you".
fn difference(minutes: i32) -> String {
    if minutes == 0 {
        return "the same time as you".into();
    }
    let way = if minutes > 0 { "ahead of" } else { "behind" };
    format!("{} {way} you", duration_words(minutes.unsigned_abs()))
}

async fn list_shortcuts() -> Result<Done> {
    let all = platform::shortcuts().await?;
    if all.is_empty() {
        return Ok(Done::said("You don't have any Shortcuts yet. Make one in the Shortcuts app and I can run it by name."));
    }
    Ok(Done::said(format!("You have {}: {}. Ask me to run one by name.", counted(all.len(), "Shortcut"), some_of(&all, 5))).showing(names("shortcuts", "Your Shortcuts", "Shortcut", &all)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_phrasings_ask_for_their_reading() {
        let asked = |said: &str| [("battery", battery_words(said)), ("wifi", wifi_words(said)), ("disk-space", disk_words(said))].into_iter().find(|(_, input)| input.is_some()).map(|(id, _)| id);
        for (said, id) in [("What's my battery?", "battery"), ("how much battery do I have left", "battery"), ("is my laptop charging?", "battery"), ("What Wi-Fi am I on?", "wifi"), ("how's my wifi signal", "wifi"), ("How much space do I have?", "disk-space"), ("how much free disk space is left on my mac?", "disk-space"), ("how full is my drive", "disk-space")] {
            assert_eq!(asked(said), Some(id), "{said}");
        }
        for mind in ["why does my battery drain so fast?", "what is wifi", "how much space is in a cubic metre", "battery acid on the floor"] {
            assert_eq!(asked(mind), None, "{mind} goes to the mind");
        }
    }

    #[test]
    fn durations_and_differences_read_as_words() {
        assert_eq!(hours_and_minutes("4:05"), "4 hours 5 minutes");
        assert_eq!(hours_and_minutes("1:00"), "1 hour");
        assert_eq!(hours_and_minutes("0:45"), "45 minutes");
        assert_eq!(difference(540), "9 hours ahead of you");
        assert_eq!(difference(-330), "5 hours 30 minutes behind you");
        assert_eq!(difference(0), "the same time as you");
    }

    #[tokio::test]
    async fn an_unknown_place_says_so_without_running_anything() {
        let err = time_in(&serde_json::json!({ "place": "Atlantis" })).await.unwrap_err().to_string();
        assert!(err.contains("Atlantis"), "{err}");
        assert!(time_in(&serde_json::json!({})).await.is_err());
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn reading_the_battery_and_the_shortcuts_is_harmless() {
        // Real, read-only calls on this Mac.
        let said = battery().await.unwrap().summary;
        assert!(said.contains('%') || said.contains("no battery"), "{said}");
        assert!(list_shortcuts().await.is_ok());
        assert!(disk_space().unwrap().summary.contains("GB free"));
    }
}
