//! A point in PAD space (pleasure, arousal, dominance), each in [-1, 1], and the words for it.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Default)]
pub struct Pad {
    pub p: f32,
    pub a: f32,
    pub d: f32,
}

impl Pad {
    pub const fn new(p: f32, a: f32, d: f32) -> Pad {
        Pad { p, a, d }
    }

    pub fn clamped(self) -> Pad {
        Pad { p: self.p.clamp(-1.0, 1.0), a: self.a.clamp(-1.0, 1.0), d: self.d.clamp(-1.0, 1.0) }
    }

    pub fn add(self, o: Pad) -> Pad {
        Pad { p: self.p + o.p, a: self.a + o.a, d: self.d + o.d }
    }

    pub fn sub(self, o: Pad) -> Pad {
        Pad { p: self.p - o.p, a: self.a - o.a, d: self.d - o.d }
    }

    pub fn scale(self, k: f32) -> Pad {
        Pad { p: self.p * k, a: self.a * k, d: self.d * k }
    }

    pub fn length(self) -> f32 {
        (self.p * self.p + self.a * self.a + self.d * self.d).sqrt()
    }

    /// Words for the mood, always about the keeper itself and never about the person (the eight
    /// ALMA octants with kind names: low pleasure reads "tired" or "quiet", never hostile).
    pub fn label(self) -> &'static str {
        if self.length() < 0.15 {
            return "calm";
        }
        match (self.p >= 0.0, self.a >= 0.0, self.d >= 0.0) {
            (true, true, true) => "cheerful",
            (true, true, false) => "playful",
            (true, false, true) => "relaxed",
            (true, false, false) => "content",
            (false, true, true) => "restless",
            (false, true, false) => "a little unsettled",
            (false, false, true) => "thoughtful",
            (false, false, false) => "tired",
        }
    }
}
