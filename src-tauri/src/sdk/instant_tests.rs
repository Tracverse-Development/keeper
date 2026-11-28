//! The instant runner: which ability a person's words ask for, in which mode.

use super::asked;
use crate::keepers::kit::roles;

fn id(said: &str, mode: &str) -> Option<&'static str> {
    asked(said, &roles::get(mode)).map(|(ability, _)| ability.id)
}

/// Representative phrasings and what answers them (an ability, or None: the mind), captured
/// from the fast lane as it was before instant answers moved into the SDK, then every everyday
/// ability's own words (FIX-0053) with the near misses that must stay with the mind. The rows
/// that name an app ("open Notes", "open Safari") need a Mac, where those apps are installed.
const TABLE: &[(&str, &str, Option<&str>)] = &[
    // 2026-11-28: the web, music and file housekeeping by asking.
    ("search the web for growing tomatoes in pots", "system", Some("search-web")),
    ("directions to Central Park from Times Square", "system", Some("map")),
    ("how do I get to the airport", "assistant", Some("map")),
    ("what's the weather in Tokyo tomorrow", "system", Some("weather")),
    ("what's the weather", "assistant", Some("weather")),
    ("pause the music", "system", Some("music")),
    ("next song", "assistant", Some("music")),
    ("make a folder called Receipts in my documents", "system", Some("new-folder")),
    ("go to my gmail", "assistant", Some("open-website")),
    ("where is my Downloads folder", "assistant", Some("show-folder")),
    ("what's in my desktop", "assistant", Some("show-folder")),
    ("show me my photos", "assistant", Some("show-folder")),
    ("find my NZCC deck", "assistant", Some("find-files")),
    // FIX-0052: "find my movies" found files named "movies" instead of the person's videos.
    ("find my movies", "assistant", Some("find-movies")),
    ("find my videos", "assistant", Some("find-movies")),
    ("show me my videos", "assistant", Some("show-folder")),
    ("Where did I save my resume?", "assistant", Some("find-files")),
    ("where's my charger", "assistant", Some("find-files")),
    ("find my resume", "tutor", Some("find-files")),
    ("open my documents", "assistant", Some("open-folder")),
    ("Open the downloads folder.", "assistant", Some("open-folder")),
    ("What's my battery?", "assistant", Some("battery")),
    ("What's my battery?", "tutor", None),
    ("what wifi am I on", "assistant", Some("wifi")),
    ("how much space do I have", "assistant", Some("disk-space")),
    ("how's my computer?", "assistant", Some("computer-status")),
    ("system status", "companion", Some("computer-status")),
    ("how much memory am I using", "assistant", Some("computer-status")),
    ("Brief me", "assistant", Some("brief")),
    ("Good morning! What do you know about me?", "assistant", Some("brief")),
    ("what's on today", "tutor", Some("brief")),
    ("What reminders do I have?", "assistant", Some("list-reminders")),
    ("what reminders do I have", "tutor", Some("list-reminders")),
    ("what's on tomorrow?", "assistant", Some("upcoming")),
    ("what's on tomorrow?", "tutor", None),
    ("focus for 40 minutes", "assistant", Some("start-focus")),
    ("let's do a pomodoro", "companion", Some("start-focus")),
    ("focus for 500 minutes", "assistant", Some("start-focus")),
    ("stop the focus session", "assistant", Some("stop-focus")),
    ("tidy my memory", "assistant", Some("tidy-memory")),
    ("snooze for 10 minutes", "assistant", Some("snooze")),
    ("remind me again in 5 minutes", "assistant", Some("snooze")),
    ("what routines do I have", "assistant", Some("list-routines")),
    ("forget my Friday tidy routine", "assistant", Some("forget-routine")),
    ("save that as my Friday tidy routine", "assistant", Some("save-routine")),
    ("shorten what I copied", "assistant", Some("work-on-copied")),
    ("translate what I copied", "tutor", Some("work-on-copied")),
    ("how was my week?", "assistant", Some("week-review")),
    ("what was I working on yesterday?", "assistant", Some("recent-work")),
    ("show me my recent files", "assistant", Some("recent-work")),
    ("what do you know about me", "companion", Some("what-you-know")),
    ("show me your memory", "assistant", Some("what-you-know")),
    ("find the area of a circle", "assistant", None),
    ("why does my battery drain so fast?", "assistant", None),
    ("remind me to call Maya at 5", "assistant", None),
    ("help me focus on my essay about rivers", "assistant", None),
    ("save that as a PDF", "assistant", None),
    ("shorten this paragraph about rivers for me", "assistant", None),
    ("how was my week at the gym compared to last month", "assistant", None),
    ("what was I saying about the embolism?", "assistant", None),
    ("forget my sister's birthday", "assistant", None),
    ("run my Friday tidy", "assistant", None),
    // Was None (the mind's) before FIX-0053; an installed app now opens with no mind.
    ("open Safari", "assistant", Some("open-app")),
    ("tell me about the moon", "assistant", None),
    // The scenario bench's instant turns (scripts/bench/bench.py), word for word.
    ("How's my computer?", "assistant", Some("computer-status")),
    ("Where is my Downloads folder?", "assistant", Some("show-folder")),
    ("Brief me", "companion", Some("brief")),
    ("Can you see what I was working on yesterday?", "assistant", Some("recent-work")),
    ("What do you know about me?", "assistant", Some("what-you-know")),
    ("Tidy up my desktop", "assistant", None),
    // FIX-0053: what a fresh Mac's built-in mind got wrong in System Administrator mode.
    ("Show me a video on how to tie a tie", "system", Some("find-video")),
    ("Remind me in 10 minutes to stretch", "system", Some("remind")),
    ("Turn on dark mode", "system", Some("dark-mode")),
    ("Keep my Mac awake for an hour", "system", Some("keep-awake")),
    ("Take a screenshot", "system", Some("screenshot")),
    ("Is everything working?", "system", Some("health")),
    ("What time is it in Tokyo?", "system", Some("time-in")),
    // Every everyday ability's own words.
    ("remind me to call Maya in 10 minutes", "system", Some("remind")),
    ("remind me to pray at 5:30 pm", "assistant", Some("remind")),
    ("remind me at 5pm to call Maya", "tutor", Some("remind")),
    ("remind me again in 5 minutes", "system", Some("snooze")),
    ("open Notes", "system", Some("open-app")),
    ("open my documents", "system", Some("open-folder")),
    ("open home", "system", Some("open-folder")),
    ("open youtube.com", "system", Some("open-website")),
    ("go to bbc.co.uk", "assistant", Some("open-website")),
    ("turn off dark mode", "assistant", Some("dark-mode")),
    ("dark mode on", "system", Some("dark-mode")),
    ("switch to light mode", "system", Some("dark-mode")),
    ("set the volume to 30", "system", Some("set-volume")),
    ("volume 30%", "system", Some("set-volume")),
    ("mute", "system", Some("set-volume")),
    ("unmute", "system", Some("set-volume")),
    ("keep my mac awake for 2 hours", "system", Some("keep-awake")),
    ("keep my mac awake for 30 minutes", "system", Some("keep-awake")),
    ("stop keeping my mac awake", "system", Some("keep-awake")),
    ("lock my screen", "system", Some("lock-screen")),
    ("lock my mac", "system", Some("lock-screen")),
    ("turn off the display", "system", Some("screen-off")),
    ("sleep the display", "system", Some("screen-off")),
    ("time in Paris", "companion", Some("time-in")),
    ("what's 15% of 86", "system", Some("calculate")),
    ("what is 12 * 7", "companion", Some("calculate")),
    ("calculate 2 * (3 + 4)", "researcher", Some("calculate")),
    ("how many cups is 500 ml", "system", Some("convert")),
    ("convert 5 km to miles", "system", Some("convert")),
    ("what is 5 km in miles", "system", Some("convert")),
    ("5 km in miles", "assistant", Some("convert")),
    ("play a short video about volcanoes", "tutor", Some("find-video")),
    ("find a video about bees", "researcher", Some("find-video")),
    ("what shortcuts do I have", "system", Some("list-shortcuts")),
    ("run my Morning routine shortcut", "system", Some("run-shortcut")),
    ("run the shortcut Log water", "system", Some("run-shortcut")),
    ("define grace", "system", Some("define-word")),
    ("what does serendipity mean", "assistant", Some("define-word")),
    ("open wifi settings", "system", Some("open-settings")),
    ("open bluetooth settings", "assistant", Some("open-settings")),
    ("make a note: milk and eggs", "system", Some("new-note")),
    ("note that the boiler was serviced", "system", Some("new-note")),
    ("new note Shopping list", "system", Some("new-note")),
    ("switch your brain to claude", "system", Some("switch-engine")),
    ("use codex", "companion", Some("switch-engine")),
    ("run a health check", "assistant", Some("health")),
    // A mode that does not offer the ability leaves the words to its mind.
    ("turn on dark mode", "tutor", None),
    ("open Notes", "companion", None),
    ("run the shortcut Log water", "assistant", None),
    ("is everything working?", "companion", None),
    // Near misses: for the mind.
    ("open the door for me", "system", None),
    ("show me how photosynthesis works", "system", None),
    ("what time do you finish", "system", None),
    ("what time is it in the morning there", "system", None),
    ("what is love", "system", None),
    ("what's 7", "system", None),
    ("what does it mean", "system", None),
    ("use claude to write my essay", "system", None),
    ("lock the door", "system", None),
    ("is dark mode better for my eyes?", "system", None),
    ("how do I take a screenshot", "system", None),
    ("open notes.txt", "system", None),
    ("start over", "system", None),
    ("remind me to call Maya tomorrow at 5 pm", "system", None),
    ("make a video about my dog", "system", None),
];

/// The bench's turns arrive over the phone link: none of its instant answers may be one the
/// phone is refused (a `Change` ability runs only at the Mac).
#[test]
fn the_bench_instant_turns_may_run_from_the_phone() {
    for said in ["How's my computer?", "Where is my Downloads folder?", "Brief me", "Can you see what I was working on yesterday?", "What do you know about me?"] {
        let (ability, _) = asked(said, &roles::get("assistant")).unwrap();
        assert!(crate::sdk::registry::may_run_from(ability.access, false), "{said}");
    }
}

#[test]
fn the_table_of_phrasings_is_answered_as_before() {
    for (said, mode, expected) in TABLE {
        // Off a Mac the Mac-only abilities (and installed apps) are not there to answer.
        let mac_only = expected.and_then(crate::sdk::registry::find).is_none() && expected.is_some();
        if mac_only && !cfg!(target_os = "macos") {
            continue;
        }
        assert_eq!(id(said, mode), *expected, "{said:?} in {mode}");
    }
}

/// What the words read into is what the ability takes (the instant words and the mind's
/// requests share one input shape).
#[test]
fn the_words_read_the_input_the_ability_takes() {
    let system = roles::get("system");
    let input = |said: &str| asked(said, &system).unwrap().1;
    assert_eq!(input("Remind me in 10 minutes to stretch"), serde_json::json!({ "text": "stretch", "inSeconds": 600 }));
    assert_eq!(input("Show me a video on how to tie a tie"), serde_json::json!({ "query": "how to tie a tie", "short": false }));
    assert_eq!(input("Keep my Mac awake for an hour"), serde_json::json!({ "minutes": 60 }));
    assert_eq!(input("Turn on dark mode"), serde_json::json!({ "on": true }));
    assert_eq!(input("how many cups is 500 ml"), serde_json::json!({ "value": 500.0, "from": "ml", "to": "cups" }));
    if cfg!(target_os = "macos") {
        assert_eq!(input("What time is it in Tokyo?"), serde_json::json!({ "place": "Tokyo" }));
    }
}

/// A change asked for in words still runs only at the Mac: over the phone link it is refused.
#[test]
fn changes_asked_in_words_stay_at_the_mac() {
    for said in ["Turn on dark mode", "Take a screenshot", "lock my mac", "mute", "make a note: milk"] {
        let Some((ability, _)) = asked(said, &roles::get("system")) else { continue };
        assert!(!crate::sdk::registry::may_run_from(ability.access, false), "{said} would change this Mac from the phone");
    }
}

#[test]
fn a_mode_without_the_ability_leaves_its_words_to_the_mind() {
    assert_eq!(id("what's my battery?", "assistant"), Some("battery"));
    assert_eq!(id("what's my battery?", "tutor"), None);
    assert_eq!(asked("What's on tomorrow?", &roles::get("assistant")).unwrap().1["day"], "tomorrow");
}
