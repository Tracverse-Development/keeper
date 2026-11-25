//! The Stage: what an engine may ask Keeper to SHOW inside its own window (panels), instead of
//! building a web page or a file. Mirrors `src/stage/panel-spec.ts` (serde tag "kind").
//!
//! Engines are untrusted writers: every panel is parsed into this closed set of kinds, unknown
//! kinds and malformed panels are dropped (never shown as raw text), and every string, list and
//! table is capped (`cap`) so one answer cannot flood the window. The window renders text only.

pub mod stream;

use serde::{Deserialize, Serialize};

const MAX_PANELS: usize = 6;
const MAX_TEXT: usize = 2400;
const MAX_SHORT: usize = 160;
const MAX_ITEMS: usize = 24;
const MAX_COLUMNS: usize = 14;
const MAX_ROWS: usize = 24;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Step {
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub math: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormulaPart {
    pub symbol: String,
    pub meaning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Card {
    pub title: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Cell {
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileAction {
    Open,
    Create,
    Move,
    Edit,
    Delete,
    Find,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileItem {
    pub action: FileAction,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Panel {
    Text { #[serde(default)] id: String, title: String, body: String, #[serde(default)] bullets: Vec<String> },
    Table { #[serde(default)] id: String, title: String, #[serde(default)] caption: Option<String>, columns: Vec<String>, rows: Vec<Vec<serde_json::Value>>, #[serde(default)] highlight: Vec<Cell> },
    Steps { #[serde(default)] id: String, title: String, steps: Vec<Step> },
    Formula { #[serde(default)] id: String, title: String, expression: String, #[serde(default)] parts: Vec<FormulaPart> },
    Cards { #[serde(default)] id: String, title: String, cards: Vec<Card> },
    Quiz { #[serde(default)] id: String, title: String, question: String, choices: Vec<String>, answer: usize, #[serde(default)] explain: String },
    Chart { #[serde(default)] id: String, title: String, labels: Vec<String>, values: Vec<f64>, #[serde(default)] unit: Option<String> },
    Files { #[serde(default)] id: String, title: String, items: Vec<FileItem> },
}

fn clip(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

fn clip_opt(s: &Option<String>, max: usize) -> Option<String> {
    s.as_ref().map(|v| clip(v, max)).filter(|v| !v.trim().is_empty())
}

/// A table cell as text (models write numbers and strings alike).
fn cell_text(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => clip(s, MAX_SHORT),
        serde_json::Value::Null => String::new(),
        other => clip(&other.to_string(), MAX_SHORT),
    }
}

impl Panel {
    /// The same panel with every field capped and its id set; None when it is unusable.
    fn cap(self, index: usize) -> Option<Panel> {
        let id = |given: &str| if given.trim().is_empty() { format!("panel-{index}") } else { clip(given, 40) };
        let p = match self {
            Panel::Text { id: i, title, body, bullets } => Panel::Text { id: id(&i), title: clip(&title, MAX_SHORT), body: clip(&body, MAX_TEXT), bullets: bullets.iter().take(MAX_ITEMS).map(|b| clip(b, 400)).collect() },
            Panel::Table { id: i, title, caption, columns, rows, highlight } => {
                let columns: Vec<String> = columns.iter().take(MAX_COLUMNS).map(|c| clip(c, MAX_SHORT)).collect();
                if columns.is_empty() {
                    return None;
                }
                let rows: Vec<Vec<serde_json::Value>> = rows.iter().take(MAX_ROWS).map(|r| r.iter().take(columns.len()).map(|c| serde_json::Value::String(cell_text(c))).collect()).collect();
                let highlight = highlight.into_iter().filter(|c| c.row < rows.len() && c.col < columns.len()).take(MAX_ITEMS).collect();
                Panel::Table { id: id(&i), title: clip(&title, MAX_SHORT), caption: clip_opt(&caption, 400), columns, rows, highlight }
            }
            Panel::Steps { id: i, title, steps } => Panel::Steps {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                steps: steps.iter().take(MAX_ITEMS).map(|s| Step { label: clip(&s.label, 400), detail: clip_opt(&s.detail, 800), math: clip_opt(&s.math, 200) }).collect(),
            },
            Panel::Formula { id: i, title, expression, parts } => Panel::Formula {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                expression: clip(&expression, 200),
                parts: parts.iter().take(12).map(|p| FormulaPart { symbol: clip(&p.symbol, 20), meaning: clip(&p.meaning, 200) }).collect(),
            },
            Panel::Cards { id: i, title, cards } => Panel::Cards {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                cards: cards.iter().take(12).map(|c| Card { title: clip(&c.title, MAX_SHORT), body: clip(&c.body, 600), emoji: clip_opt(&c.emoji, 8) }).collect(),
            },
            Panel::Quiz { id: i, title, question, choices, answer, explain } => {
                let choices: Vec<String> = choices.iter().take(6).map(|c| clip(c, 200)).collect();
                if choices.len() < 2 || answer >= choices.len() {
                    return None;
                }
                Panel::Quiz { id: id(&i), title: clip(&title, MAX_SHORT), question: clip(&question, 600), choices, answer, explain: clip(&explain, 800) }
            }
            Panel::Chart { id: i, title, labels, values, unit } => {
                let n = labels.len().min(values.len()).min(MAX_ITEMS);
                if n == 0 || values.iter().take(n).any(|v| !v.is_finite()) {
                    return None;
                }
                Panel::Chart { id: id(&i), title: clip(&title, MAX_SHORT), labels: labels.iter().take(n).map(|l| clip(l, 60)).collect(), values: values[..n].to_vec(), unit: clip_opt(&unit, 12) }
            }
            Panel::Files { id: i, title, items } => Panel::Files {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                items: items.iter().take(40).map(|f| FileItem { action: f.action.clone(), path: clip(&f.path, 400), to: clip_opt(&f.to, 400) }).collect(),
            },
        };
        Some(p)
    }
}

impl Panel {
    /// Give the panel its id (streamed panels are numbered in arrival order).
    pub fn set_id(&mut self, new: &str) {
        let (Panel::Text { id, .. } | Panel::Table { id, .. } | Panel::Steps { id, .. } | Panel::Formula { id, .. } | Panel::Cards { id, .. } | Panel::Quiz { id, .. } | Panel::Chart { id, .. } | Panel::Files { id, .. }) = self;
        *id = new.to_string();
    }
}

/// Does the person want this answer shown visually? Their own words win ("just text", "show me
/// visually"); otherwise their setting (`default`). Matching is on whole phrases, never single
/// common words.
pub fn wants_visual(said: &str, default: bool) -> bool {
    let s = said.to_lowercase();
    let text_only = ["just text", "in text", "text only", "only text", "no panels", "plain text", "wall of text", "just tell me", "no visuals", "without visuals"];
    let visual = ["visually", "show me", "visual", "diagram", "draw it", "draw me", "picture of", "chart", "make a table", "in a table", "on the stage", "in panels"];
    if text_only.iter().any(|p| s.contains(p)) {
        return false;
    }
    if visual.iter().any(|p| s.contains(p)) {
        return true;
    }
    default
}

/// Read the engine's `panels` value: keep the valid ones (capped), drop the rest silently, at most six.
pub fn read(raw: &serde_json::Value) -> Vec<Panel> {
    raw.as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| serde_json::from_value::<Panel>(v.clone()).ok())
        .enumerate()
        .filter_map(|(i, p)| p.cap(i))
        .take(MAX_PANELS)
        .collect()
}

/// What engines are told when the person wants text this time.
pub const TEXT_RULES: &str = "SHOWING THINGS: answer in words this time (\"panels\": []), unless you must report files you changed, \
then one \"files\" panel. NEVER create HTML files, web pages or documents and NEVER open a browser just to show something.";

/// The instructions every engine gets about showing things (visual mode, the default).
pub const RULES: &str = "SHOWING THINGS: you have a stage inside this app, and the person likes to see things. When you teach, explain, compare, list, calculate or report \
what you did, put it in \"panels\" (shown beautifully inside Keeper, clickable so the person can ask about any piece). NEVER create HTML \
files, web pages or documents and NEVER open a browser just to show something: use panels. Panel kinds (JSON objects in the \"panels\" \
array, at most 6): {\"kind\":\"text\",\"title\",\"body\",\"bullets\":[]}, {\"kind\":\"table\",\"title\",\"caption\",\"columns\":[],\"rows\":[[]],\"highlight\":[{\"row\":0,\"col\":0}]}, \
{\"kind\":\"steps\",\"title\",\"steps\":[{\"label\",\"detail\",\"math\"}]}, {\"kind\":\"formula\",\"title\",\"expression\",\"parts\":[{\"symbol\",\"meaning\"}]}, \
{\"kind\":\"cards\",\"title\",\"cards\":[{\"title\",\"body\",\"emoji\"}]}, {\"kind\":\"quiz\",\"title\",\"question\",\"choices\":[],\"answer\":0,\"explain\"}, \
{\"kind\":\"chart\",\"title\",\"labels\":[],\"values\":[],\"unit\"}, {\"kind\":\"files\",\"title\",\"items\":[{\"action\":\"open|create|move|edit|delete|find\",\"path\",\"to\"}]}. \
With panels, keep \"reply\" to one or two spoken sentences that point at them, and write \"reply\" BEFORE \"panels\" in the JSON.";

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_valid_panels_and_drops_the_rest() {
        let raw = json!([
            {"kind": "table", "title": "Times table", "columns": ["×", "1", "2"], "rows": [["1", 1, 2], ["2", 2, 4]], "highlight": [{"row": 1, "col": 2}, {"row": 9, "col": 9}]},
            {"kind": "html", "title": "nope", "body": "<script>"},
            {"kind": "quiz", "title": "Q", "question": "2+2?", "choices": ["3", "4"], "answer": 7},
            {"kind": "steps", "title": "Solve", "steps": [{"label": "Subtract 4", "math": "2x = 6"}]},
            "not a panel"
        ]);
        let panels = read(&raw);
        assert_eq!(panels.len(), 2, "{panels:?}");
        match &panels[0] {
            Panel::Table { rows, highlight, id, .. } => {
                assert_eq!(rows[1][2], json!("4"));
                assert_eq!(highlight.len(), 1);
                assert_eq!(id, "panel-0");
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn the_persons_words_win_over_the_setting() {
        assert!(!wants_visual("Explain fractions, just text please", true));
        assert!(wants_visual("show me visually how fractions work", false));
        assert!(wants_visual("what is a fraction", true));
        assert!(!wants_visual("what is a fraction", false));
    }

    #[test]
    fn everything_is_capped() {
        let long = "x".repeat(10_000);
        let raw = json!([{"kind": "text", "title": long, "body": long}]);
        if let Panel::Text { title, body, .. } = &read(&raw)[0] {
            assert!(title.len() <= MAX_SHORT && body.len() <= MAX_TEXT);
        }
        let many: Vec<_> = (0..20).map(|i| json!({"kind": "text", "title": format!("t{i}"), "body": "b"})).collect();
        assert_eq!(read(&json!(many)).len(), MAX_PANELS);
    }
}
