//! Panels that only say the reply again are dropped. A status answer once showed its free-space
//! figure in the reply, a text panel, a table, a chart and the live panel (bench 2026-11-27);
//! the text panel that restates the reply is the one that adds nothing (FIX-0035).

use std::collections::HashSet;

use super::Panel;

/// A text panel is an echo when at least this share of its words are already in the reply.
const ECHO_SHARE: f64 = 0.7;
/// Fewer content words than this is too little to judge (a label, not a restatement).
const MIN_WORDS: usize = 3;

/// Glue words that say nothing on their own.
const GLUE: [&str; 24] = ["the", "and", "you", "your", "have", "has", "are", "is", "was", "with", "for", "that", "this", "out", "about", "of", "to", "in", "on", "it", "a", "an", "so", "right"];

/// The panels without text panels that only restate `reply` (no bullets, nearly every word
/// already said). Every other panel is kept, in order.
pub fn without_echoes(reply: &str, panels: Vec<Panel>) -> Vec<Panel> {
    let said = words(reply);
    panels.into_iter().filter(|p| !is_echo(&said, p)).collect()
}

fn is_echo(said: &HashSet<String>, panel: &Panel) -> bool {
    let Panel::Text { body, bullets, .. } = panel else { return false };
    if !bullets.is_empty() || said.is_empty() {
        return false;
    }
    let body = words(body);
    if body.len() < MIN_WORDS {
        return false;
    }
    let repeated = body.iter().filter(|w| said.contains(*w)).count();
    repeated as f64 / body.len() as f64 >= ECHO_SHARE
}

/// The distinct content words of a text, lowercased.
fn words(text: &str) -> HashSet<String> {
    text.split(|c: char| !c.is_alphanumeric()).map(str::to_lowercase).filter(|w| !w.is_empty() && !GLUE.contains(&w.as_str())).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(body: &str, bullets: &[&str]) -> Panel {
        Panel::Text { id: "t".into(), title: "Storage".into(), body: body.into(), bullets: bullets.iter().map(|b| b.to_string()).collect() }
    }

    fn live() -> Panel {
        Panel::Live { id: "live".into(), title: "Your storage, right now".into(), metrics: vec!["disk".into()] }
    }

    // FIX-0035: the storage answer's text panel said the reply again.
    #[test]
    fn a_text_panel_that_restates_the_reply_is_dropped() {
        let reply = "You have 120 GB free of 500 GB on your Mac.";
        let kept = without_echoes(reply, vec![text("You have about 120 GB free out of 500 GB.", &[]), live()]);
        assert_eq!(kept.len(), 1);
        assert!(matches!(kept[0], Panel::Live { .. }));
    }

    #[test]
    fn a_text_panel_that_adds_something_stays() {
        let reply = "You have 120 GB free of 500 GB on your Mac.";
        let adds = text("Photos and Mail take most of the space; emptying the Trash would free another 8 GB.", &[]);
        assert_eq!(without_echoes(reply, vec![adds, live()]).len(), 2);
        let listed = text("You have 120 GB free of 500 GB.", &["Photos: 90 GB", "Mail: 30 GB"]);
        assert_eq!(without_echoes(reply, vec![listed]).len(), 1, "bullets are new content");
        assert_eq!(without_echoes("", vec![text("Anything at all here.", &[])]).len(), 1, "no reply, nothing to echo");
    }
}
