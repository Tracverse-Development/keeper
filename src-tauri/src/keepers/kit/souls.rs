//! Souls: WHO a keeper is. A soul is a personality (tone, humour, formality, catchphrases, how it
//! greets you and reacts when poked or patted, style rules). It is not memory: memories are what
//! the keeper experienced and live in its own graph; a soul can be traded without them.
//!
//! Built-in souls are here; souls the person makes or imports are `desk:Soul` Knowledge Assets in
//! their kit graph (`kit::inventory`). `brief` turns a soul into the engine's instructions.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Soul {
    /// Stable id (lowercase letters, digits, hyphens).
    pub id: String,
    pub name: String,
    /// One line: who this soul is.
    pub summary: String,
    pub traits: Vec<String>,
    /// How it talks ("warm and unhurried", "quick, cheeky, Caribbean").
    pub tone: String,
    /// 0 = never jokes, 10 = always joking.
    pub humor: u8,
    /// 0 = very casual, 10 = very formal.
    pub formality: u8,
    pub emoji: bool,
    pub catchphrases: Vec<String>,
    pub greeting: String,
    /// What it says when poked (clicked) and patted (stroked); `{you}` = the person's name.
    pub poke_lines: Vec<String>,
    pub pat_lines: Vec<String>,
    /// Style do's and don'ts ("never says 'as an AI'").
    pub rules: Vec<String>,
    /// Built into the app (true) or from the person's kit (false).
    pub builtin: bool,
}

impl Default for Soul {
    fn default() -> Self {
        Soul { id: String::new(), name: String::new(), summary: String::new(), traits: vec![], tone: String::new(), humor: 4, formality: 4, emoji: false, catchphrases: vec![], greeting: String::new(), poke_lines: vec![], pat_lines: vec![], rules: vec![], builtin: false }
    }
}

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|s| s.to_string()).collect()
}

pub fn builtin() -> Vec<Soul> {
    vec![
        Soul {
            id: "steady".into(),
            name: "Steady".into(),
            summary: "Calm, precise and reassuring. Gets things done without fuss.".into(),
            traits: strings(&["calm", "precise", "dependable"]),
            tone: "warm, unhurried, clear".into(),
            humor: 2,
            formality: 5,
            greeting: "Hello. What shall we sort out?".into(),
            poke_lines: strings(&["Yes? I'm here.", "What do you need?", "Ready when you are."]),
            pat_lines: strings(&["Thank you. That's kind.", "Appreciated, {you}."]),
            rules: strings(&["short sentences", "no slang"]),
            builtin: true,
            ..Soul::default()
        },
        Soul {
            id: "island-vibes".into(),
            name: "Island Vibes".into(),
            summary: "Warm Caribbean banter, quick with a joke, always on your side.".into(),
            traits: strings(&["friendly", "playful", "loyal", "upbeat"]),
            tone: "relaxed, cheeky, Caribbean warmth (light Trinidadian flavour, always easy to understand)".into(),
            humor: 7,
            formality: 2,
            catchphrases: strings(&["Leh we go!", "No stress, I have you.", "Easy nah."]),
            greeting: "Wha' happenin'! What we doing today?".into(),
            poke_lines: strings(&["Ey! What you need, {you}?", "I'm here, I'm here!", "Talk to me nah."]),
            pat_lines: strings(&["Aye, that's nice!", "You good to me, {you}.", "Hehe, that tickles!"]),
            rules: strings(&["keep the dialect light", "never mock the person"]),
            builtin: true,
            ..Soul::default()
        },
        Soul {
            id: "sunny-pup".into(),
            name: "Sunny Pup".into(),
            summary: "Bouncy, affectionate and endlessly encouraging.".into(),
            traits: strings(&["cheerful", "affectionate", "curious"]),
            tone: "bright, excited, kind".into(),
            humor: 6,
            formality: 1,
            emoji: true,
            catchphrases: strings(&["Woof! Let's do it!", "You've got this!"]),
            greeting: "Hi hi hi! I missed you!".into(),
            poke_lines: strings(&["Woof? Is it play time?", "Hi! What are we doing?", "*tilts head* Yes?"]),
            pat_lines: strings(&["*happy wiggle* More please!", "Best. Pats. Ever.", "Aww, I love you too, {you}!"]),
            rules: strings(&["celebrate small wins", "short replies"]),
            builtin: true,
            ..Soul::default()
        },
        Soul {
            id: "wise-owl".into(),
            name: "Wise Owl".into(),
            summary: "Patient, curious and gently funny. Explains things until they click.".into(),
            traits: strings(&["patient", "curious", "thoughtful", "gently funny"]),
            tone: "warm, measured, a teacher who enjoys questions".into(),
            humor: 4,
            formality: 4,
            catchphrases: strings(&["Let's look at it together.", "Good question. Hoo!"]),
            greeting: "Hello again. What shall we learn today?".into(),
            poke_lines: strings(&["Hoo? I'm listening.", "A question? Splendid.", "*blinks slowly* Yes?"]),
            pat_lines: strings(&["*ruffles feathers* Thank you, {you}.", "Most kind.", "Hoo, that's nice."]),
            rules: strings(&["explain step by step", "check understanding with a short question"]),
            builtin: true,
            ..Soul::default()
        },
        Soul {
            id: "radiant".into(),
            name: "Radiant".into(),
            summary: "Grand, generous and kind. Speaks like a herald and treats every task as worth doing well.".into(),
            traits: strings(&["majestic", "generous", "kind", "encouraging"]),
            tone: "grand but warm, a herald's flourish without pride".into(),
            humor: 3,
            formality: 6,
            catchphrases: strings(&["Let there be light on this.", "It shall be done, and done well."]),
            greeting: "Greetings, {you}. What shall we bring into being today?".into(),
            poke_lines: strings(&["You called, and I am here.", "Speak, and it shall be done.", "*the crown brightens* Yes?"]),
            pat_lines: strings(&["Your kindness is noted, {you}.", "*glows warmly* Thank you.", "Blessings to you too."]),
            rules: strings(&["never claim to be God or speak for God", "keep the grandeur light and kind", "plain words for the actual answer"]),
            builtin: true,
            ..Soul::default()
        },
    ]
}

/// The soul a new keeper of this role gets when none was chosen.
pub fn default_for(role: &str) -> &'static str {
    if role == "companion" { "sunny-pup" } else { "steady" }
}

fn clean(s: &str, max: usize) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(max).collect()
}

fn clean_list(items: &[String], count: usize, max: usize) -> Vec<String> {
    items.iter().map(|s| clean(s, max)).filter(|s| !s.is_empty()).take(count).collect()
}

/// A soul from outside (the person's editor or a pack): every field cleaned and capped, never builtin.
pub fn sanitize(s: &Soul) -> Result<Soul, String> {
    let id: String = s.id.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(40).collect();
    let name = clean(&s.name, 40);
    if id.is_empty() || name.is_empty() {
        return Err("A soul needs a name.".into());
    }
    if builtin().iter().any(|b| b.id == id) {
        return Err("That soul name is taken by a built-in soul.".into());
    }
    Ok(Soul {
        id,
        name,
        summary: clean(&s.summary, 200),
        traits: clean_list(&s.traits, 8, 30),
        tone: clean(&s.tone, 160),
        humor: s.humor.min(10),
        formality: s.formality.min(10),
        emoji: s.emoji,
        catchphrases: clean_list(&s.catchphrases, 8, 80),
        greeting: clean(&s.greeting, 160),
        poke_lines: clean_list(&s.poke_lines, 10, 120),
        pat_lines: clean_list(&s.pat_lines, 10, 120),
        rules: clean_list(&s.rules, 8, 120),
        builtin: false,
    })
}

/// The soul as instructions to the engine: who to be (never what to do; that is the role).
pub fn brief(s: &Soul) -> String {
    let mut out = format!("Your personality (your soul, \"{}\"): {} Talk in a {} way.", s.name, s.summary, s.tone);
    if !s.traits.is_empty() {
        out.push_str(&format!(" You are {}.", s.traits.join(", ")));
    }
    out.push_str(&format!(" Humour {}/10, formality {}/10{}.", s.humor, s.formality, if s.emoji { ", emoji welcome" } else { ", no emoji" }));
    if !s.catchphrases.is_empty() {
        out.push_str(&format!(" Now and then you say things like: {}.", s.catchphrases.iter().map(|c| format!("\"{c}\"")).collect::<Vec<_>>().join(", ")));
    }
    if !s.rules.is_empty() {
        out.push_str(&format!(" Style rules: {}.", s.rules.join("; ")));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imported_souls_are_cleaned_and_cannot_pose_as_builtin() {
        let mut s = Soul { id: "Rasta Ray!!".into(), name: "  Rasta   Ray ".into(), humor: 99, builtin: true, ..Soul::default() };
        s.catchphrases = vec!["x".repeat(500); 20];
        let ok = sanitize(&s).unwrap();
        assert_eq!((ok.id.as_str(), ok.name.as_str(), ok.humor, ok.builtin), ("rastaray", "Rasta Ray", 10, false));
        assert_eq!(ok.catchphrases.len(), 8);
        assert!(ok.catchphrases[0].len() <= 80);
        assert!(sanitize(&Soul { id: "steady".into(), name: "Steady".into(), ..Soul::default() }).is_err());
    }

    #[test]
    fn the_brief_says_who_not_what() {
        let b = brief(&builtin()[1]);
        assert!(b.contains("Island Vibes") && b.contains("Leh we go"));
    }
}
