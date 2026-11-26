//! Which remembered facts matter for what was just said. Three signals, all worked out on this
//! computer and each explainable:
//! - the same WORDS (strongest: "sister" in the question, "sister" in the fact);
//! - the fact's TOPIC words, which the mind adds when it learns it ("family", "phone");
//! - the same CONCEPT (`meaning`): "who should I call for family news?" and "Your sister is
//!   Maya" share no word, but both are about family.
//! Identity facts (the person's name, where they live) keep a standing place.

use super::meaning;
use super::records::Fact;

const STOP: &[&str] = &[
    "the", "and", "for", "you", "your", "are", "was", "what", "who", "how", "when", "where", "why", "that", "this", "with", "have",
    "has", "had", "can", "could", "would", "should", "about", "from", "into", "just", "like", "know", "tell", "please", "umoja", "does",
    "did", "not", "but", "any", "all", "our", "out", "get", "got", "let", "its", "it's", "i'm", "me", "my",
];

/// Points for each signal: an exact word beats a topic word beats a shared concept.
const WORD: i32 = 6;
const TOPIC: i32 = 5;
const CONCEPT: i32 = 3;
const IDENTITY: i32 = 4;

fn words(text: &str) -> Vec<String> {
    meaning::words(text).into_iter().filter(|w| w.len() >= 3 && !STOP.contains(&w.as_str())).collect()
}

/// How related `fact` is to a question with these words and concepts (0 = not at all, apart
/// from an identity fact's standing place).
fn score(fact: &Fact, asked: &[String], asked_concepts: &[&str]) -> i32 {
    let fact_words = words(&fact.text);
    let same = |w: &String, other: &String| other == w || other.starts_with(w.as_str());
    let by_word = asked.iter().filter(|w| fact_words.iter().any(|fw| same(w, fw))).count() as i32;
    // A topic word counts only where the fact's own words did not already.
    let by_topic = asked.iter().filter(|w| !fact_words.iter().any(|fw| same(w, fw)) && fact.topics.iter().any(|t| same(w, t))).count() as i32;
    let about: Vec<&str> = meaning::concepts(&format!("{} {}", fact.text, fact.topics.join(" "))).into_iter().chain(meaning::concepts_of_category(&fact.category).iter().copied()).collect();
    let by_concept = asked_concepts.iter().filter(|c| about.contains(c)).count() as i32;
    by_word * WORD + by_topic * TOPIC + by_concept * CONCEPT + if fact.category == "identity" { IDENTITY } else { 0 }
}

/// The `limit` facts most related to `said`, identity facts next, newest breaking ties.
pub fn relevant(facts: &[Fact], said: &str, limit: usize) -> Vec<Fact> {
    let (asked, asked_concepts) = (words(said), meaning::concepts(said));
    let mut scored: Vec<(i32, &Fact)> = facts.iter().map(|f| (score(f, &asked, &asked_concepts), f)).collect();
    // Stable sort keeps the query's newest-first order among equal scores.
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    let mut out: Vec<Fact> = scored.iter().filter(|(s, _)| *s > 0).take(limit).map(|(_, f)| (*f).clone()).collect();
    // Room left over goes to the newest facts, so a fresh topic still has some context.
    for f in facts {
        if out.len() >= limit {
            break;
        }
        if !out.iter().any(|o| o.id == f.id) {
            out.push(f.clone());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fact(text: &str, category: &str) -> Fact {
        Fact::new(text, category, "2026-11-25T10:00:00Z")
    }

    #[test]
    fn related_facts_come_first() {
        let facts = vec![fact("Your favourite drink is sorrel", "preference"), fact("You live in Port of Spain", "place"), fact("Your name is Ada", "identity")];
        let top = relevant(&facts, "what drink should I make?", 2);
        assert_eq!(top[0].text, "Your favourite drink is sorrel");
        assert_eq!(top[1].text, "Your name is Ada");
    }

    #[test]
    fn a_fact_is_found_by_what_it_means_among_many_others() {
        let mut facts: Vec<Fact> = (0..30).map(|i| fact(&format!("Your project number {i} ships in week {i}"), "work")).collect();
        facts.push(fact("Your sister is Maya", "person"));
        facts.push(fact("You are allergic to peanuts", "health"));
        facts.push(fact("Rex goes to the groomer monthly", "general").about(&["dog".into(), "pet".into()]));
        let top = |q: &str| relevant(&facts, q, 3).into_iter().map(|f| f.text).collect::<Vec<_>>();
        assert_eq!(top("Who should I call for family news?")[0], "Your sister is Maya", "no word in common, the same concept");
        assert!(top("What should I cook for dinner tonight?").contains(&"You are allergic to peanuts".to_string()));
        assert_eq!(top("Anything coming up for the dog?")[0], "Rex goes to the groomer monthly", "found by the topic words the mind gave it");
        assert_eq!(top("Is Maya coming to dinner?")[0], "Your sister is Maya", "an exact word beats a shared concept");
    }
}
