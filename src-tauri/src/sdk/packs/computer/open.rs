//! Opening things on this computer for the person: a folder or file in the Finder (inside their
//! home folder only), a pane of System Settings by its everyday name, a word in the Dictionary.
//! "Open Wi-Fi settings" and "define grace" run them with no mind (`open_words`).

use super::open_words::{define_words, settings_words};
use super::super::super::{input, Ability, Access, Done, Instant, MAC};
use crate::kernel::{DeskError, Result};
use crate::platform;

pub const ABILITIES: &[Ability] = &[
    Ability { id: "show-files", how: "{\"path\": \"~/Documents/Taxes\"} shows a folder or a file INSIDE Keeper, beside you: folders to go through, pictures, documents, videos and songs to play, text files to edit and save. Use this to show any file or folder unless the person asks for the Finder", access: Access::Look, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, cx| Box::pin(async move { show_files(input, cx) }) },
    Ability { id: "show-in-finder", how: "{\"path\": \"~/Documents/Taxes\"} opens a folder in the Finder, or shows a file there, ONLY when the person asks for the Finder (inside their home folder)", access: Access::Open, platforms: MAC, modes: &["assistant"], instant: Instant::No, run: |input, _| Box::pin(async move { show_in_finder(input) }) },
    Ability { id: "open-settings", how: "{\"pane\": \"wifi\"} opens System Settings at a pane: wifi, bluetooth, network, sound, displays, battery, appearance, wallpaper, notifications, focus, privacy, keyboard, trackpad, mouse, accessibility, general, software update, storage, users, lock screen, desktop and dock, sharing, date and time, login items, time machine, printers", access: Access::Open, platforms: MAC, modes: &["assistant"], instant: Instant::Also(settings_words), run: |input, _| Box::pin(async move { open_settings(input) }) },
    Ability { id: "define-word", how: "{\"word\": \"grace\"} opens a word in the Dictionary app", access: Access::Open, platforms: MAC, modes: &["assistant"], instant: Instant::Also(define_words), run: |input, _| Box::pin(async move { define_word(input) }) },
];

fn show_files(input: &serde_json::Value, cx: &super::super::super::Cx<'_>) -> Result<Done> {
    let said = input::text(input, "path")?;
    let path = crate::explorer::place(said)?;
    if !cx.at_the_mac {
        return Err(DeskError::Invalid("Keeper's file viewer is on the Mac; ask me there.".into()));
    }
    crate::explorer::show(cx.app, &path);
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "your home folder".into());
    Ok(Done::said(format!("Here's {name}, in Keeper.")))
}

fn show_in_finder(input: &serde_json::Value) -> Result<Done> {
    let said = input::text(input, "path")?;
    let path = crate::stage::open::person_file(said).ok_or_else(|| DeskError::Invalid(format!("I can't find {said} in your home folder.")))?;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "your home folder".into());
    if path.is_dir() {
        platform::open_path(&path)?;
        Ok(Done::said(format!("Opened {name} in the Finder.")))
    } else {
        platform::reveal(&path);
        Ok(Done::said(format!("Showed {name} in the Finder.")))
    }
}

/// (the names a person uses, the pane's identifier in System Settings). Identifiers read from
/// the Settings extensions on macOS 26-27 (`/System/Library/ExtensionKit/Extensions`).
const PANES: &[(&[&str], &str)] = &[
    (&["wifi", "wi-fi", "wireless"], "com.apple.wifi-settings-extension"),
    (&["bluetooth"], "com.apple.BluetoothSettings"),
    (&["network", "internet", "vpn"], "com.apple.Network-Settings.extension"),
    (&["sound", "volume", "audio"], "com.apple.Sound-Settings.extension"),
    (&["displays", "display", "screen", "brightness", "monitor"], "com.apple.Displays-Settings.extension"),
    (&["battery", "energy", "power"], "com.apple.Battery-Settings.extension"),
    (&["appearance", "dark mode", "light mode"], "com.apple.Appearance-Settings.extension"),
    (&["wallpaper", "background"], "com.apple.Wallpaper-Settings.extension"),
    (&["notifications"], "com.apple.Notifications-Settings.extension"),
    (&["focus", "do not disturb"], "com.apple.Focus-Settings.extension"),
    (&["privacy", "security", "privacy and security", "permissions"], "com.apple.settings.PrivacySecurity.extension"),
    (&["speech recognition", "speech"], "com.apple.preference.security?Privacy_SpeechRecognition"),
    (&["microphone", "mic"], "com.apple.preference.security?Privacy_Microphone"),
    (&["keyboard"], "com.apple.Keyboard-Settings.extension"),
    (&["trackpad"], "com.apple.Trackpad-Settings.extension"),
    (&["mouse"], "com.apple.Mouse-Settings.extension"),
    (&["accessibility"], "com.apple.Accessibility-Settings.extension"),
    (&["general"], "com.apple.systempreferences.GeneralSettings"),
    (&["software update", "updates", "update"], "com.apple.Software-Update-Settings.extension"),
    (&["storage", "disk"], "com.apple.settings.Storage"),
    (&["users", "users and groups", "accounts"], "com.apple.Users-Groups-Settings.extension"),
    (&["lock screen", "screen saver"], "com.apple.Lock-Screen-Settings.extension"),
    (&["desktop and dock", "dock", "desktop", "mission control"], "com.apple.Desktop-Settings.extension"),
    (&["sharing"], "com.apple.Sharing-Settings.extension"),
    (&["date and time", "date", "time", "clock"], "com.apple.Date-Time-Settings.extension"),
    (&["login items", "startup items"], "com.apple.LoginItems-Settings.extension"),
    (&["time machine", "backup", "backups"], "com.apple.Time-Machine-Settings.extension"),
    (&["printers", "printers and scanners", "printer", "scanner"], "com.apple.Print-Scan-Settings.extension"),
    (&["screen time"], "com.apple.Screen-Time-Settings.extension"),
    (&["siri"], "com.apple.Siri-Settings.extension"),
];

/// The Settings address for a pane the person named ("Wi-Fi", "privacy & security"), or None.
pub fn pane_address(said: &str) -> Option<String> {
    let key = said.trim().to_lowercase().replace('&', "and").replace(" settings", "").replace(" pane", "");
    let key = key.trim();
    PANES.iter().find(|(names, _)| names.contains(&key)).map(|(_, id)| format!("x-apple.systempreferences:{id}"))
}

fn open_settings(input: &serde_json::Value) -> Result<Done> {
    let pane = input::text(input, "pane")?;
    let address = pane_address(pane).ok_or_else(|| DeskError::Invalid(format!("I don't know a Settings pane called {pane}. Try Wi-Fi, Sound, Displays or Privacy.")))?;
    platform::open_url(&address)?;
    Ok(Done::said(format!("Opened {pane} in System Settings.")))
}

/// A word or short phrase to look up: it starts with a letter, then letters, spaces, hyphens and
/// apostrophes, at most 40.
fn dictionary_address(word: &str) -> Option<String> {
    let word = word.trim();
    let ok = word.chars().count() <= 40 && word.starts_with(char::is_alphabetic) && word.chars().all(|c| c.is_alphabetic() || " -'’".contains(c));
    ok.then(|| format!("dict://{}", word.split_whitespace().collect::<Vec<_>>().join("%20")))
}

fn define_word(input: &serde_json::Value) -> Result<Done> {
    let word = input::text(input, "word")?;
    let address = dictionary_address(word).ok_or_else(|| DeskError::Invalid("That doesn't look like a word I can look up.".into()))?;
    platform::open_url(&address)?;
    Ok(Done::said(format!("Opened \"{word}\" in the Dictionary.")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panes_are_found_by_their_everyday_names() {
        assert_eq!(pane_address("Wi-Fi").as_deref(), Some("x-apple.systempreferences:com.apple.wifi-settings-extension"));
        assert_eq!(pane_address("Privacy & Security").as_deref(), Some("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension"));
        assert_eq!(pane_address("sound settings").as_deref(), Some("x-apple.systempreferences:com.apple.Sound-Settings.extension"));
        assert_eq!(pane_address("x-apple.systempreferences:evil"), None);
        let mut seen = std::collections::HashSet::new();
        for (names, _) in PANES {
            assert!(names.iter().all(|n| seen.insert(*n)), "a pane name is used twice");
        }
    }

    #[test]
    fn only_words_go_to_the_dictionary() {
        assert_eq!(dictionary_address("grace").as_deref(), Some("dict://grace"));
        assert_eq!(dictionary_address("  status  quo ").as_deref(), Some("dict://status%20quo"));
        assert_eq!(dictionary_address("o'clock").as_deref(), Some("dict://o'clock"));
        for bad in ["grace/../x", "-a", "http://x", "a?b=c", "123", &"a".repeat(41)] {
            assert_eq!(dictionary_address(bad), None, "{bad}");
        }
    }

    #[test]
    fn the_finder_only_opens_the_home_folder() {
        for outside in ["/etc", "~/../../etc", "../..", "~/not-a-real-folder-4821"] {
            assert!(show_in_finder(&serde_json::json!({ "path": outside })).is_err(), "{outside}");
        }
    }

    #[test]
    fn the_permission_pages_a_keeper_needs_have_addresses() {
        assert_eq!(super::pane_address("speech recognition").as_deref(), Some("x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"));
        assert_eq!(super::pane_address("Microphone").as_deref(), Some("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"));
    }
}
