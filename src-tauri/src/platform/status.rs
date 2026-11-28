//! What the computer reports about itself, in OS-neutral shapes: each system's file fills these
//! (`status_macos.rs` on macOS), and `sdk::packs::computer` turns them into words and panels.

/// The battery right now (from `platform::battery`).
#[derive(Debug, Clone, PartialEq)]
pub struct Battery {
    /// Charge, 0-100.
    pub percent: u8,
    /// How it is doing, in plain words: "charging", "on battery", "fully charged", "plugged in, not charging".
    pub state: String,
    /// Plugged into power (charging or not).
    pub on_power: bool,
    /// "4:12" until empty (on battery) or full (charging), when the system has an estimate.
    pub remaining: Option<String>,
}

/// The Wi-Fi connection right now (from `platform::wifi`).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct WiFi {
    pub connected: bool,
    /// The network's name; `None` when the system hides it (macOS does, unless the app may use
    /// Location Services) or when not connected.
    pub name: Option<String>,
    /// Signal strength in dBm (-30 is superb, -80 is barely there).
    pub signal_dbm: Option<i32>,
    pub noise_dbm: Option<i32>,
    /// "100 (5GHz, 80MHz)".
    pub channel: Option<String>,
    /// The link speed, megabits a second.
    pub rate_mbps: Option<u32>,
}

impl WiFi {
    /// The signal in one word, the way a person would say it.
    pub fn signal_words(&self) -> Option<&'static str> {
        Some(match self.signal_dbm? {
            s if s >= -55 => "excellent",
            s if s >= -67 => "good",
            s if s >= -75 => "fair",
            _ => "weak",
        })
    }
}

/// The time now somewhere else (from `platform::time_in_zone`).
#[derive(Debug, Clone, PartialEq)]
pub struct ZoneTime {
    /// "08:52" (24-hour).
    pub clock: String,
    pub weekday: String,
    /// The zone's short name ("JST"; some zones only have "+04").
    pub abbreviation: String,
    /// Minutes ahead of UTC (Tokyo is 540).
    pub offset_minutes: i32,
}

/// The longest a keeper keeps the computer awake in one go (eight hours).
pub const MAX_AWAKE_MINUTES: u32 = 480;

/// How loud: a level 0-100, or muted / unmuted (the level is kept).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Volume {
    Level(u8),
    Mute,
    Unmute,
}

#[cfg(test)]
mod tests {
    use super::WiFi;

    #[test]
    fn signal_is_said_in_words() {
        let at = |dbm| WiFi { signal_dbm: Some(dbm), ..WiFi::default() }.signal_words();
        assert_eq!((at(-40), at(-60), at(-70), at(-85)), (Some("excellent"), Some("good"), Some("fair"), Some("weak")));
        assert_eq!(WiFi::default().signal_words(), None);
    }
}
