//! Which remembered facts matter for what was just said. Plain keyword overlap with a
//! stop-word list, plus a standing place for identity facts (the person's name, where they
//! live): small, fast, explainable, and it runs on this computer.

use super::records::Fact;

const STOP: &[&str] = &[
    "the", "and", "for", "you", "your", "are", "was", "what", "who", "how", "when", "where", "why", "that", "this", "with", "have",
    "has", "had", "can", "could", "would", "should", "about", "from", "into", "just", "like", "know", "tell", "please", "umoja", "does",
    "did", "not", "but", "any", "all", "our", "out", "get", "got", "let", "its", "it's", "i'm", "me", "my",
];

fn words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .filter(|w| w.len() >= 3 && !STOP.contains(w))
        .map(|w| w.trim_end_matches("'s").to_string())
        .collect()
}

/// The `limit` facts most related to `said`, identity facts next, newest breaking ties.
pub fn relevant(facts: &[Fact], said: &str, limit: usize) -> Vec<Fact> {
    let asked = words(said);
    let mut scored: Vec<(i32, &Fact)> = facts
        .iter()
        .map(|f| {
            let fact_words = words(&f.text);
            let overlap = asked.iter().filter(|w| fact_words.iter().any(|fw| fw == *w || fw.starts_with(w.as_str()))).count() as i32;
            let identity = if f.category == "identity" { 4 } else { 0 };
            (overlap * 6 + identity, f)
        })
        .collect();
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
}
