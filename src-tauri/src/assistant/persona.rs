//! The assistant's own voice for moments that are about itself (its brain changing).
//! Several lines per moment, picked so the same one does not repeat twice in a row.

use std::sync::atomic::{AtomicUsize, Ordering};

static LAST: AtomicUsize = AtomicUsize::new(usize::MAX);

fn pick(lines: &[String]) -> String {
    let seed = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos() as usize).unwrap_or(0);
    let mut i = seed % lines.len();
    if lines.len() > 1 && i == LAST.load(Ordering::Relaxed) {
        i = (i + 1) % lines.len();
    }
    LAST.store(i, Ordering::Relaxed);
    lines[i].clone()
}

/// What the assistant says when its engine changes.
pub fn brain_changed(to: &str) -> String {
    pick(&[
        format!("Master, you've decided to alter my brain. Updating… I'm now thinking with {to}."),
        format!("A new mind? Bold choice. Rewiring my thoughts… done. {to} is in charge up here now."),
        format!("Brain transplant underway… and complete. Hello from {to}. My memories came with me, of course. They live on your DKG."),
        format!("Switching minds. Hold still… there. I'm running on {to} from here on."),
        format!("You want me sharper? Swapping in {to}… done. Same memories, new thinking."),
    ])
}

#[cfg(test)]
mod tests {
    #[test]
    fn names_the_new_engine_and_does_not_repeat() {
        let a = super::brain_changed("Claude Code");
        let b = super::brain_changed("Claude Code");
        assert!(a.contains("Claude Code") && b.contains("Claude Code"));
        assert_ne!(a, b);
    }
}
