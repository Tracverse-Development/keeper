//! A small line diff for drafts: which lines a draft keeps, takes out and puts in, with the words
//! that changed inside an edited line marked, and long runs of unchanged lines folded away.
//!
//! The core is a longest-common-subsequence diff over any comparable items (`diff`), used twice:
//! over lines, then over the words of each edited line. Common starts and ends are trimmed first,
//! so a few fixes in a long file cost little; a middle too big to compare (`MAX_CELLS`) is shown
//! as taken out and put back whole rather than slowly.

use serde::Serialize;

/// The most comparisons one diff makes (rows x columns of its table). About 16 MB of table.
const MAX_CELLS: usize = 4_000_000;
/// Unchanged lines kept on each side of a change; longer unchanged runs fold into a gap.
pub const CONTEXT: usize = 2;
/// The most lines a view carries; the rest fold into one gap at the end.
pub const MAX_VIEW_LINES: usize = 1500;

/// One step of a diff, by position: in both (`Same(a, b)`), only in the old (`Removed(a)`), only
/// in the new (`Added(b)`). Removals come before additions inside one change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Same(usize, usize),
    Removed(usize),
    Added(usize),
}

/// The steps that turn `old` into `new` (longest common subsequence, common ends trimmed first).
pub fn diff<T: PartialEq>(old: &[T], new: &[T]) -> Vec<Op> {
    let prefix = old.iter().zip(new).take_while(|(a, b)| a == b).count();
    let suffix = old[prefix..].iter().rev().zip(new[prefix..].iter().rev()).take_while(|(a, b)| a == b).count();
    let (a, b) = (&old[prefix..old.len() - suffix], &new[prefix..new.len() - suffix]);
    let mut ops: Vec<Op> = (0..prefix).map(|i| Op::Same(i, i)).collect();
    if (a.len() + 1).saturating_mul(b.len() + 1) > MAX_CELLS {
        ops.extend((0..a.len()).map(|i| Op::Removed(prefix + i)));
        ops.extend((0..b.len()).map(|j| Op::Added(prefix + j)));
    } else {
        ops.extend(middle(a, b).into_iter().map(|op| shift(op, prefix)));
    }
    let (from_old, from_new) = (old.len() - suffix, new.len() - suffix);
    ops.extend((0..suffix).map(|k| Op::Same(from_old + k, from_new + k)));
    ops
}

fn shift(op: Op, by: usize) -> Op {
    match op {
        Op::Same(a, b) => Op::Same(a + by, b + by),
        Op::Removed(a) => Op::Removed(a + by),
        Op::Added(b) => Op::Added(b + by),
    }
}

/// The plain LCS walk: `rest[i][j]` is the longest common run of `a[i..]` and `b[j..]`.
fn middle<T: PartialEq>(a: &[T], b: &[T]) -> Vec<Op> {
    let width = b.len() + 1;
    let mut rest = vec![0u32; (a.len() + 1) * width];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            rest[i * width + j] = if a[i] == b[j] { rest[(i + 1) * width + j + 1] + 1 } else { rest[(i + 1) * width + j].max(rest[i * width + j + 1]) };
        }
    }
    let (mut i, mut j, mut ops) = (0, 0, Vec::new());
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            ops.push(Op::Same(i, j));
            (i, j) = (i + 1, j + 1);
        } else if rest[(i + 1) * width + j] >= rest[i * width + j + 1] {
            ops.push(Op::Removed(i));
            i += 1;
        } else {
            ops.push(Op::Added(j));
            j += 1;
        }
    }
    ops.extend((i..a.len()).map(Op::Removed));
    ops.extend((j..b.len()).map(Op::Added));
    ops
}

/// What a line of the view is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Same,
    Added,
    Removed,
    /// Unchanged lines folded away (`skipped` says how many).
    Gap,
}

/// A piece of an edited line: its text, and whether it is what changed.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Part {
    pub text: String,
    pub changed: bool,
}

/// One line of the before/after view the draft panel draws.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Line {
    pub kind: Kind,
    pub text: String,
    /// For an edited line (a removed line answered by an added one): its pieces, changed words marked.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub parts: Vec<Part>,
    /// For a gap: how many unchanged lines it stands for.
    #[serde(skip_serializing_if = "is_zero")]
    pub skipped: usize,
}

fn is_zero(n: &usize) -> bool {
    *n == 0
}

impl Line {
    fn plain(kind: Kind, text: &str) -> Line {
        Line { kind, text: text.to_string(), parts: Vec::new(), skipped: 0 }
    }
    fn gap(skipped: usize) -> Line {
        Line { kind: Kind::Gap, text: String::new(), parts: Vec::new(), skipped }
    }
}

/// The view of `old` becoming `new`: every line marked same, removed or added (edited lines with
/// their changed words), unchanged runs folded to `CONTEXT` lines either side of a change. With
/// no change at all, the whole text (up to `MAX_VIEW_LINES`), so a file being looked at shows.
pub fn view(old: &str, new: &str) -> Vec<Line> {
    let (a, b): (Vec<&str>, Vec<&str>) = (old.lines().collect(), new.lines().collect());
    let ops = diff(&a, &b);
    let mut lines = Vec::with_capacity(ops.len());
    let mut k = 0;
    while k < ops.len() {
        if let Op::Same(i, _) = ops[k] {
            lines.push(Line::plain(Kind::Same, a[i]));
            k += 1;
            continue;
        }
        // One change: its removed lines, then its added lines; pair them up for word marks.
        let removed: Vec<usize> = ops[k..].iter().map_while(|op| if let Op::Removed(i) = op { Some(*i) } else { None }).collect();
        k += removed.len();
        let added: Vec<usize> = ops[k..].iter().map_while(|op| if let Op::Added(j) = op { Some(*j) } else { None }).collect();
        k += added.len();
        let paired = removed.len().min(added.len());
        for (n, &i) in removed.iter().enumerate() {
            lines.push(if n < paired { edited(Kind::Removed, a[i], b[added[n]]) } else { Line::plain(Kind::Removed, a[i]) });
        }
        for (n, &j) in added.iter().enumerate() {
            lines.push(if n < paired { edited(Kind::Added, b[j], a[removed[n]]) } else { Line::plain(Kind::Added, b[j]) });
        }
    }
    fold(lines)
}

/// An edited line's pieces: `line` against `other` (the line it replaced, or that replaced it).
fn edited(kind: Kind, line: &str, other: &str) -> Line {
    let (mine, theirs) = (words(line), words(other));
    // Ops are written old → new; for the removed line "mine" is the old side.
    let ops = if kind == Kind::Removed { diff(&mine, &theirs) } else { diff(&theirs, &mine) };
    let mut parts: Vec<Part> = Vec::new();
    for op in ops {
        let (piece, changed) = match (kind, op) {
            (Kind::Removed, Op::Same(i, _)) | (Kind::Added, Op::Same(_, i)) => (mine[i], false),
            (Kind::Removed, Op::Removed(i)) | (Kind::Added, Op::Added(i)) => (mine[i], true),
            _ => continue,
        };
        match parts.last_mut() {
            Some(last) if last.changed == changed => last.text.push_str(piece),
            _ => parts.push(Part { text: piece.to_string(), changed }),
        }
    }
    Line { kind, text: line.to_string(), parts, skipped: 0 }
}

/// A line cut into words and the single characters between them; joined, they are the line again.
pub fn words(line: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = None;
    for (at, c) in line.char_indices() {
        let wordy = c.is_alphanumeric() || c == '\'';
        match (wordy, start) {
            (true, None) => start = Some(at),
            (false, Some(s)) => {
                out.push(&line[s..at]);
                out.push(&line[at..at + c.len_utf8()]);
                start = None;
            }
            (false, None) => out.push(&line[at..at + c.len_utf8()]),
            (true, Some(_)) => {}
        }
    }
    if let Some(s) = start {
        out.push(&line[s..]);
    }
    out
}

/// Unchanged runs longer than a change's context fold into gaps; a view with no change is cut
/// to `MAX_VIEW_LINES`.
fn fold(lines: Vec<Line>) -> Vec<Line> {
    let changed: Vec<bool> = lines.iter().map(|l| l.kind != Kind::Same).collect();
    if !changed.contains(&true) {
        let total = lines.len();
        let mut kept: Vec<Line> = lines.into_iter().take(MAX_VIEW_LINES).collect();
        if total > MAX_VIEW_LINES {
            kept.push(Line::gap(total - MAX_VIEW_LINES));
        }
        return kept;
    }
    // A same line is kept when a change is within CONTEXT lines of it.
    let near = |i: usize| changed[i.saturating_sub(CONTEXT)..(i + CONTEXT + 1).min(changed.len())].contains(&true);
    let mut out = Vec::new();
    let mut skipped = 0;
    for (i, line) in lines.into_iter().enumerate() {
        if line.kind == Kind::Same && !near(i) {
            skipped += 1;
            continue;
        }
        if skipped > 0 {
            out.push(Line::gap(skipped));
            skipped = 0;
        }
        out.push(line);
    }
    if skipped > 0 {
        out.push(Line::gap(skipped));
    }
    out
}

/// Lines put in and taken out (an edited line counts once each way).
pub fn counts(lines: &[Line]) -> (usize, usize) {
    (lines.iter().filter(|l| l.kind == Kind::Added).count(), lines.iter().filter(|l| l.kind == Kind::Removed).count())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(lines: &[Line]) -> String {
        lines.iter().map(|l| match l.kind { Kind::Same => '=', Kind::Added => '+', Kind::Removed => '-', Kind::Gap => '~' }).collect()
    }

    #[test]
    fn the_diff_keeps_what_is_common_and_marks_the_rest() {
        let (a, b) = (["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
        assert_eq!(diff(&a, &b), vec![Op::Same(0, 0), Op::Removed(1), Op::Added(1), Op::Same(2, 2), Op::Same(3, 3), Op::Added(4)]);
        assert_eq!(diff::<&str>(&[], &[]), vec![]);
        assert_eq!(diff(&["a"], &[]), vec![Op::Removed(0)]);
        assert_eq!(diff(&[], &["a"]), vec![Op::Added(0)]);
        // Every old item is accounted for once, and every new one.
        let (old, new) = (["q", "w", "e", "r", "t", "y"], ["w", "q", "e", "t", "r", "y", "u"]);
        let ops = diff(&old, &new);
        let olds = ops.iter().filter(|o| !matches!(o, Op::Added(_))).count();
        let news = ops.iter().filter(|o| !matches!(o, Op::Removed(_))).count();
        assert_eq!((olds, news), (old.len(), new.len()));
        assert_eq!(ops.iter().filter(|o| matches!(o, Op::Same(..))).count(), 4, "the longest common run is 4");
    }

    #[test]
    fn a_middle_too_big_to_compare_is_shown_out_and_in_whole() {
        let old: Vec<usize> = (0..2100).collect();
        let new: Vec<usize> = (5000..7100).collect();
        let ops = diff(&old, &new);
        assert_eq!(ops.len(), 4200);
        assert!(matches!(ops[0], Op::Removed(0)) && matches!(ops[2100], Op::Added(0)));
    }

    #[test]
    fn a_spelling_fix_marks_only_the_word_that_changed() {
        let lines = view("Dear Sam,\nI recieve teh letter.\nThanks", "Dear Sam,\nI receive the letter.\nThanks");
        assert_eq!(kinds(&lines), "=-+=");
        let removed: Vec<(&str, bool)> = lines[1].parts.iter().map(|p| (p.text.as_str(), p.changed)).collect();
        assert_eq!(removed, vec![("I ", false), ("recieve", true), (" ", false), ("teh", true), (" letter.", false)]);
        let added: String = lines[2].parts.iter().filter(|p| p.changed).map(|p| p.text.as_str()).collect::<Vec<_>>().join("|");
        assert_eq!(added, "receive|the");
        assert_eq!(counts(&lines), (1, 1));
    }

    #[test]
    fn words_join_back_into_the_line() {
        for line in ["don't stop, ok?", "", "  two  spaces", "naïve café 42"] {
            assert_eq!(words(line).concat(), line);
        }
        assert_eq!(words("don't go"), vec!["don't", " ", "go"]);
    }

    #[test]
    fn long_unchanged_runs_fold_around_a_change() {
        let old: String = (1..=20).map(|n| format!("line {n}\n")).collect();
        let new = old.replace("line 10\n", "line ten\n");
        let lines = view(&old, &new);
        assert_eq!(kinds(&lines), "~==-+==~");
        assert_eq!((lines[0].skipped, lines[7].skipped), (7, 8));
        // Nothing changed: the whole text shows, so a file being looked at can be read.
        assert_eq!(kinds(&view("a\nb", "a\nb")), "==");
    }

    #[test]
    fn added_and_removed_lines_that_do_not_pair_stay_whole() {
        let lines = view("a\nb\nc", "a\nB\nnew\nc");
        assert_eq!(kinds(&lines), "=-++=");
        assert!(!lines[1].parts.is_empty() && !lines[2].parts.is_empty() && lines[3].parts.is_empty());
    }
}
