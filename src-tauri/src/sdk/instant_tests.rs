//! The instant runner: which ability a person's words ask for, in which mode.

use super::asked;
use crate::keepers::kit::roles;

fn id(said: &str, mode: &str) -> Option<&'static str> {
    asked(said, &roles::get(mode)).map(|(ability, _)| ability.id)
}

/// Representative phrasings and what answers them (an ability, or None: the mind), captured
/// from the fast lane as it was before instant answers moved into the SDK.
const TABLE: &[(&str, &str, Option<&str>)] = &[
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
    ("open Safari", "assistant", None),
    ("tell me about the moon", "assistant", None),
    // The scenario bench's instant turns (scripts/bench/bench.py), word for word.
    ("How's my computer?", "assistant", Some("computer-status")),
    ("Where is my Downloads folder?", "assistant", Some("show-folder")),
    ("Brief me", "companion", Some("brief")),
    ("Can you see what I was working on yesterday?", "assistant", Some("recent-work")),
    ("What do you know about me?", "assistant", Some("what-you-know")),
    ("Tidy up my desktop", "assistant", None),
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
        assert_eq!(id(said, mode), *expected, "{said:?} in {mode}");
    }
}

#[test]
fn a_mode_without_the_ability_leaves_its_words_to_the_mind() {
    assert_eq!(id("what's my battery?", "assistant"), Some("battery"));
    assert_eq!(id("what's my battery?", "tutor"), None);
    assert_eq!(asked("What's on tomorrow?", &roles::get("assistant")).unwrap().1["day"], "tomorrow");
}
