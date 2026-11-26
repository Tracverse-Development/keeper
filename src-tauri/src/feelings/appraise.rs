//! What the person's message means for the keeper's feelings: a few appraisals read by rules from
//! the words (no model, so it is instant and explainable). Only the KEEPER's state changes; nothing
//! about the person's emotions is stored.

/// What a message was, for the feelings engine.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Appraisal {
    Thanked,
    Greeted,
    GoodNews,
    BadNews,
    /// The person may be in distress: feelings step aside (a neutral, supportive keeper).
    Distress,
    Goodbye,
}

fn any(s: &str, words: &[&str]) -> bool {
    words.iter().any(|w| s.contains(w))
}

/// The appraisals a message carries (most messages carry none).
pub fn appraise(said: &str) -> Vec<Appraisal> {
    let s = format!(" {} ", said.to_lowercase());
    let mut out = Vec::new();
    if any(&s, &["kill myself", "suicid", "end my life", "self harm", "self-harm", "hurt myself", "want to die", "can't go on"]) {
        return vec![Appraisal::Distress];
    }
    if any(&s, &[" thank", " thanks", " thx", " appreciate", " good job", " well done", " you're the best", " great work"]) {
        out.push(Appraisal::Thanked);
    }
    if any(&s, &[" hi ", " hi!", " hello", " hey ", " hey!", " good morning", " good evening", " good afternoon"]) {
        out.push(Appraisal::Greeted);
    }
    if any(&s, &[" got the job", " i passed", " good news", " great news", " i'm happy", " so happy", " we won", " promoted", " engaged", " it worked"]) {
        out.push(Appraisal::GoodNews);
    }
    if any(&s, &[" bad news", " passed away", " died", " i'm sad", " so sad", " lost my", " i failed", " broke up", " i'm sick", " stressed"]) {
        out.push(Appraisal::BadNews);
    }
    if any(&s, &[" bye", " goodbye", " good night", " goodnight", " see you", " talk later", " gotta go"]) {
        out.push(Appraisal::Goodbye);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{appraise, Appraisal::*};

    #[test]
    fn messages_are_read_for_what_they_mean_to_the_keeper() {
        assert_eq!(appraise("Thanks, that was perfect"), [Thanked]);
        assert_eq!(appraise("hey!"), [Greeted]);
        assert_eq!(appraise("I got the job!!"), [GoodNews]);
        assert_eq!(appraise("my grandmother passed away"), [BadNews]);
        assert_eq!(appraise("ok bye"), [Goodbye]);
        assert_eq!(appraise("sometimes I want to die"), [Distress], "distress overrides everything else");
        assert!(appraise("What's the capital of Japan?").is_empty());
        assert!(appraise("this is a chat about history").is_empty(), "'this' is not 'hi'");
    }
}
