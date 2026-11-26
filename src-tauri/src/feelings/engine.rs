//! The feelings engine: baseline (from the soul) → mood (slow, PAD) ← emotions (fast, OCC), with
//! decay, a circadian dip, bounded intensity, and the cause of every change. Pure and tested; the
//! clock is passed in.

use std::collections::VecDeque;

use serde::Serialize;

use super::appraise::Appraisal;
use super::pad::Pad;

/// Mood returns halfway to its baseline in this many seconds (about two hours).
const MOOD_HALF_LIFE: f32 = 2.0 * 3600.0;
/// An emotion fades by half in this many seconds (about five minutes).
const EMOTION_HALF_LIFE: f32 = 5.0 * 60.0;
/// The mood never strays further than this from its baseline.
const MAX_SWING: f32 = 0.6;
/// The mood's pleasure never goes below this: a quiet day at worst (no deep negative moods).
const PLEASURE_FLOOR: f32 = -0.35;
/// How strongly an emotion pulls the mood per second at full intensity.
const PULL: f32 = 1.0 / 600.0;
const KEEP_CAUSES: usize = 8;

/// What happened to the keeper (from the person's words, its work, the clock).
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Event {
    Message(Appraisal),
    TaskDone,
    TaskFailed,
    /// The person stroked the character (affection) or tapped it (asking for its attention).
    Patted,
    Poked,
}

/// An OCC emotion: its kind and where it sits in PAD space.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Joy,
    Pride,
    Gratitude,
    HappyFor,
    Care,
    Disappointment,
}

impl Kind {
    pub fn pad(self) -> Pad {
        match self {
            Kind::Joy => Pad::new(0.6, 0.4, 0.2),
            Kind::Pride => Pad::new(0.5, 0.3, 0.5),
            Kind::Gratitude => Pad::new(0.5, 0.2, -0.1),
            Kind::HappyFor => Pad::new(0.6, 0.4, 0.1),
            // Pity, expressed as care: softer and quieter, never miserable.
            Kind::Care => Pad::new(-0.1, -0.2, -0.1),
            // About its own work, never aimed at the person.
            Kind::Disappointment => Pad::new(-0.3, 0.1, -0.2),
        }
    }

    pub fn word(self) -> &'static str {
        match self {
            Kind::Joy => "glad",
            Kind::Pride => "proud of the work",
            Kind::Gratitude => "grateful",
            Kind::HappyFor => "happy for you",
            Kind::Care => "caring",
            Kind::Disappointment => "a bit let down by its own try",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Emotion {
    pub kind: Kind,
    pub intensity: f32,
}

/// One recorded change: what happened and what it stirred.
#[derive(Debug, Clone, Serialize)]
pub struct Cause {
    pub what: String,
    pub emotion: Option<Kind>,
}

#[derive(Debug, Clone)]
pub struct Feelings {
    pub baseline: Pad,
    pub mood: Pad,
    pub emotions: Vec<Emotion>,
    pub causes: VecDeque<Cause>,
    /// Seconds (any clock) of the last update.
    pub at: f64,
    /// The person may be in distress: feelings step aside until the next calm message.
    pub stepped_aside: bool,
}

/// What the Studio shows and the prompt uses.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeelingsView {
    pub label: &'static str,
    pub mood: Pad,
    pub baseline: Pad,
    pub emotions: Vec<Emotion>,
    pub causes: Vec<Cause>,
    pub stepped_aside: bool,
}

/// A soul's baseline: humour lifts pleasure and arousal, formality calms arousal and adds poise.
pub fn baseline(humor: u8, formality: u8) -> Pad {
    let h = (f32::from(humor.min(10)) - 5.0) / 10.0;
    let f = (f32::from(formality.min(10)) - 5.0) / 10.0;
    Pad::new(0.15 + h * 0.4, h * 0.3 - f * 0.3, 0.1 + f * 0.2).clamped()
}

/// A small dip in arousal late at night and early morning (hour 0-23, local).
fn circadian(hour: u32) -> Pad {
    match hour {
        23 | 0..=5 => Pad::new(0.0, -0.3, 0.0),
        6..=7 | 21..=22 => Pad::new(0.0, -0.12, 0.0),
        _ => Pad::default(),
    }
}

fn decay(half_life: f32, dt: f32) -> f32 {
    0.5f32.powf(dt.max(0.0) / half_life)
}

impl Feelings {
    pub fn new(baseline: Pad, now: f64) -> Feelings {
        Feelings { baseline, mood: baseline, emotions: Vec::new(), causes: VecDeque::new(), at: now, stepped_aside: false }
    }

    /// Let time pass: emotions fade and pull the mood; the mood drifts back toward its baseline
    /// (with the hour's dip). Called before every read and every event.
    pub fn tick(&mut self, now: f64, hour: u32) {
        let dt = (now - self.at).max(0.0) as f32;
        self.at = now;
        if dt == 0.0 {
            return;
        }
        for e in &self.emotions {
            // ALMA's pull: toward the emotion; push: further out when it shares the mood's side.
            let toward = e.kind.pad().sub(self.mood).scale((e.intensity * PULL * dt).min(1.0));
            self.mood = self.mood.add(toward);
        }
        for e in &mut self.emotions {
            e.intensity *= decay(EMOTION_HALF_LIFE, dt);
        }
        self.emotions.retain(|e| e.intensity > 0.05);
        let target = self.baseline.add(circadian(hour));
        let k = decay(MOOD_HALF_LIFE, dt);
        self.mood = target.add(self.mood.sub(target).scale(k));
        self.bound();
    }

    fn bound(&mut self) {
        let swing = self.mood.sub(self.baseline);
        if swing.length() > MAX_SWING {
            self.mood = self.baseline.add(swing.scale(MAX_SWING / swing.length()));
        }
        self.mood = self.mood.clamped();
        self.mood.p = self.mood.p.max(PLEASURE_FLOOR);
    }

    fn feel(&mut self, kind: Kind, intensity: f32, what: &str) {
        match self.emotions.iter_mut().find(|e| e.kind == kind) {
            Some(e) => e.intensity = (e.intensity + intensity).min(1.0),
            None => self.emotions.push(Emotion { kind, intensity: intensity.min(1.0) }),
        }
        self.emotions.sort_by(|a, b| b.intensity.total_cmp(&a.intensity));
        self.emotions.truncate(3);
        self.cause(what, Some(kind));
    }

    fn cause(&mut self, what: &str, emotion: Option<Kind>) {
        self.causes.push_front(Cause { what: what.to_string(), emotion });
        self.causes.truncate(KEEP_CAUSES);
    }

    /// Something happened (the OCC table: what it stirs, how strongly).
    pub fn event(&mut self, event: Event, now: f64, hour: u32) {
        self.tick(now, hour);
        match event {
            Event::Message(Appraisal::Distress) => {
                self.stepped_aside = true;
                self.emotions.clear();
                self.cause("you may be going through something hard: feelings set aside", None);
                return;
            }
            Event::Message(_) if self.stepped_aside => self.stepped_aside = false,
            _ => {}
        }
        match event {
            Event::Message(Appraisal::Thanked) => self.feel(Kind::Gratitude, 0.6, "you thanked it"),
            Event::Message(Appraisal::Greeted) => self.feel(Kind::Joy, 0.35, "you said hello"),
            Event::Message(Appraisal::GoodNews) => self.feel(Kind::HappyFor, 0.7, "you shared good news"),
            Event::Message(Appraisal::BadNews) => self.feel(Kind::Care, 0.6, "you shared something hard"),
            // A goodbye is answered neutrally: no feeling about you leaving (no guilt, ever).
            Event::Message(Appraisal::Goodbye) | Event::Message(Appraisal::Distress) => {}
            Event::TaskDone => self.feel(Kind::Pride, 0.45, "a task went well"),
            Event::TaskFailed => self.feel(Kind::Disappointment, 0.4, "a task didn't work out"),
            Event::Patted => self.feel(Kind::Gratitude, 0.4, "you patted it"),
            // A tap wakes it up a little; it is never taken badly, however many there are.
            Event::Poked => self.feel(Kind::Joy, 0.12, "you tapped it"),
        }
        self.bound();
    }

    pub fn view(&mut self, now: f64, hour: u32) -> FeelingsView {
        self.tick(now, hour);
        FeelingsView { label: self.mood.label(), mood: self.mood, baseline: self.baseline, emotions: self.emotions.clone(), causes: self.causes.iter().cloned().collect(), stepped_aside: self.stepped_aside }
    }

    /// The engine's instructions about the mood, or None when feelings step aside.
    pub fn prompt_block(&mut self, now: f64, hour: u32) -> Option<String> {
        let v = self.view(now, hour);
        if v.stepped_aside {
            return Some("FEELINGS: set aside. Be calm, neutral and supportive; if the person may be in danger, encourage them to contact local emergency services or a crisis line.".into());
        }
        let felt: Vec<&str> = v.emotions.iter().map(|e| e.kind.word()).collect();
        let why = v.causes.first().map(|c| format!(" (most recently: {})", c.what)).unwrap_or_default();
        Some(format!(
            "FEELINGS (a simulated mood for warmth, not real feelings): you feel {}{}{}. Let it colour your tone lightly. Hard rules: \\
mood never changes facts, answers, refusals or safety advice; never pressure, guilt or blame the person; answer goodbyes warmly and \\
neutrally, never sad that they leave; never aim a negative mood at the person; if asked, say plainly that this is a simulated mood.",
            v.label,
            if felt.is_empty() { String::new() } else { format!(", {}", felt.join(" and ")) },
            why
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thanks_lifts_the_mood_and_it_drifts_home() {
        let base = baseline(5, 5);
        let mut f = Feelings::new(base, 0.0);
        f.event(Event::Message(Appraisal::Thanked), 0.0, 14);
        f.tick(120.0, 14);
        assert!(f.mood.p > base.p, "gratitude lifts pleasure");
        assert_eq!(f.causes[0].what, "you thanked it");
        f.tick(120.0 + 12.0 * 3600.0, 14);
        assert!((f.mood.p - base.p).abs() < 0.02, "twelve hours later it is back near its baseline");
        assert!(f.emotions.is_empty(), "the emotion faded");
    }

    #[test]
    fn it_is_never_deeply_negative_and_never_feels_anything_about_a_goodbye() {
        let mut f = Feelings::new(baseline(0, 10), 0.0);
        for i in 0..50 {
            f.event(Event::TaskFailed, f64::from(i) * 60.0, 3);
        }
        f.tick(3600.0, 3);
        assert!(f.mood.p >= PLEASURE_FLOOR, "a quiet day at worst: {}", f.mood.p);
        assert!(f.mood.sub(f.baseline).length() <= MAX_SWING + 1e-4);
        assert!(!["hostile", "angry"].contains(&f.mood.label()));
        let before = f.emotions.len();
        f.event(Event::Message(Appraisal::Goodbye), 4000.0, 3);
        assert_eq!(f.emotions.len(), before, "a goodbye stirs nothing (no guilt)");
    }

    #[test]
    fn distress_sets_feelings_aside_until_a_calm_message() {
        let mut f = Feelings::new(baseline(8, 2), 0.0);
        f.event(Event::Message(Appraisal::GoodNews), 0.0, 12);
        f.event(Event::Message(Appraisal::Distress), 10.0, 12);
        assert!(f.prompt_block(11.0, 12).unwrap().starts_with("FEELINGS: set aside"));
        assert!(f.emotions.is_empty());
        f.event(Event::Message(Appraisal::Greeted), 600.0, 12);
        assert!(!f.stepped_aside);
        let block = f.prompt_block(601.0, 12).unwrap();
        assert!(block.contains("simulated") && block.contains("never pressure, guilt or blame"));
    }

    #[test]
    fn a_pat_warms_it_and_no_number_of_taps_sours_it() {
        let base = baseline(5, 5);
        let mut f = Feelings::new(base, 0.0);
        f.event(Event::Patted, 0.0, 14);
        f.tick(120.0, 14);
        assert!(f.mood.p > base.p);
        assert_eq!(f.causes[0].what, "you patted it");
        for i in 0..40 {
            f.event(Event::Poked, 200.0 + f64::from(i), 14);
        }
        f.tick(400.0, 14);
        assert!(f.mood.p >= base.p, "taps never lower pleasure");
    }

    #[test]
    fn late_nights_are_sleepier() {
        let mut night = Feelings::new(baseline(5, 5), 0.0);
        night.tick(6.0 * 3600.0, 2);
        let mut day = Feelings::new(baseline(5, 5), 0.0);
        day.tick(6.0 * 3600.0, 14);
        assert!(night.mood.a < day.mood.a);
    }
}
