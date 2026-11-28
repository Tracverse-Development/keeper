//! Capping: every panel an engine writes is cut down to the limits in `panel.rs` and given an id,
//! or dropped when it is unusable (a quiz without a valid answer, a chart without numbers…).

use super::panel::*;

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

/// What a live panel can show.
pub const LIVE_METRICS: [&str; 5] = ["cpu", "memory", "network", "disk", "apps"];

/// A plain web address (https or http; no spaces, quotes or angle brackets).
pub fn web_address(url: &str) -> bool {
    let u = url.trim();
    (u.starts_with("https://") || u.starts_with("http://")) && u.len() > 10 && u.len() <= 500 && !u.chars().any(|c| c.is_whitespace() || c == '"' || c == '<' || c == '>')
}

/// A source worth showing: a plain http(s) web address (no spaces, no other schemes), a title.
fn web_source(s: &Source) -> Option<Source> {
    let url = s.url.trim();
    let ok = web_address(url);
    (ok && !s.title.trim().is_empty()).then(|| Source { title: clip(&s.title, 200), url: url.to_string(), note: clip_opt(&s.note, 300) })
}

/// Another video worth offering: a web address or a plausible local media file, with a title.
fn media_choice(c: &MediaChoice) -> Option<MediaChoice> {
    let path = c.path.as_ref().map(|p| p.trim().to_string()).filter(|p| super::local_media::plausible(p));
    let ok = (path.is_some() || web_address(&c.url)) && !c.title.trim().is_empty();
    ok.then(|| MediaChoice {
        title: clip(&c.title, MAX_SHORT),
        url: if path.is_some() { String::new() } else { c.url.trim().to_string() },
        path,
        channel: clip_opt(&c.channel, 80),
        length: clip_opt(&c.length, 12),
    })
}

/// Does a capped panel show anything? A table with no rows, steps with no step, a chart with no
/// numbers or a text panel with no words is an empty card on the Stage: it is dropped.
fn has_content(p: &Panel) -> bool {
    let words = |s: &str| !s.trim().is_empty();
    match p {
        Panel::Text { body, bullets, .. } => words(body) || bullets.iter().any(|b| words(b)),
        Panel::Table { rows, .. } => rows.iter().any(|r| r.iter().any(|c| c.as_str().is_some_and(words))),
        Panel::Steps { steps, .. } => steps.iter().any(|s| words(&s.label)),
        Panel::Formula { expression, .. } => words(expression),
        Panel::Cards { cards, .. } => !cards.is_empty(),
        Panel::Quiz { choices, .. } => choices.len() >= 2,
        Panel::Chart { values, .. } => !values.is_empty(),
        Panel::Files { items, .. } => !items.is_empty(),
        Panel::Diagram { nodes, .. } => !nodes.is_empty(),
        Panel::Timeline { events, .. } => !events.is_empty(),
        Panel::Folder { entries, .. } => !entries.is_empty(),
        Panel::Sliders { variables, .. } => !variables.is_empty(),
        Panel::Flashcards { cards, .. } => !cards.is_empty(),
        Panel::Agenda { items, .. } => !items.is_empty(),
        Panel::Checklist { items, .. } => !items.is_empty(),
        Panel::Form { fields, .. } => !fields.is_empty(),
        Panel::Sources { items, .. } => !items.is_empty(),
        Panel::Live { .. } | Panel::Media { .. } | Panel::Web { .. } | Panel::File { .. } | Panel::Approval { .. } | Panel::Facts { .. } => true,
    }
}

impl Panel {
    /// The same panel with every field capped and its id set; None when it is unusable.
    pub(super) fn cap(self, index: usize) -> Option<Panel> {
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
            Panel::Diagram { id: i, title, nodes, edges } => {
                let nodes: Vec<Node> = nodes.iter().take(30).map(|n| Node { id: clip(&n.id, 40), label: clip(&n.label, 80), group: clip_opt(&n.group, 30) }).collect();
                if nodes.is_empty() {
                    return None;
                }
                let known = |x: &str| nodes.iter().any(|n| n.id == x);
                let edges = edges.iter().filter(|e| known(&e.from) && known(&e.to)).take(60).map(|e| Edge { from: e.from.clone(), to: e.to.clone(), label: clip_opt(&e.label, 40) }).collect();
                Panel::Diagram { id: id(&i), title: clip(&title, MAX_SHORT), nodes, edges }
            }
            Panel::Timeline { id: i, title, events } => Panel::Timeline {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                events: events.iter().take(MAX_ITEMS).map(|e| Moment { when: clip(&e.when, 40), title: clip(&e.title, 160), detail: clip_opt(&e.detail, 400) }).collect(),
            },
            Panel::Folder { id: i, title, path, entries } => Panel::Folder {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                path: clip(&path, 400),
                entries: entries.into_iter().take(60).map(|e| Entry { name: clip(&e.name, 200), to: clip_opt(&e.to, 400), ..e }).collect(),
            },
            Panel::Sliders { id: i, title, expression, result_label, unit, variables } => {
                let variables: Vec<Variable> = variables
                    .into_iter()
                    .filter(|v| v.min.is_finite() && v.max.is_finite() && v.step.is_finite() && v.value.is_finite() && v.min < v.max && v.step > 0.0)
                    .filter(|v| !v.name.is_empty() && v.name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
                    .take(6)
                    .map(|v| Variable { name: clip(&v.name, 24), label: clip(&v.label, 60), value: v.value.clamp(v.min, v.max), ..v })
                    .collect();
                if variables.is_empty() || expression.trim().is_empty() {
                    return None;
                }
                Panel::Sliders { id: id(&i), title: clip(&title, MAX_SHORT), expression: clip(&expression, 200), result_label: clip(&result_label, 60), unit: clip_opt(&unit, 12), variables }
            }
            Panel::Flashcards { id: i, title, cards } => Panel::Flashcards {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                cards: cards.iter().take(40).map(|c| Flashcard { front: clip(&c.front, 300), back: clip(&c.back, 600) }).collect(),
            },
            Panel::Agenda { id: i, title, items } => Panel::Agenda {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                items: items.into_iter().take(MAX_ITEMS).map(|a| AgendaItem { time: clip_opt(&a.time, 30), title: clip(&a.title, 160), detail: clip_opt(&a.detail, 300), kind: a.kind }).collect(),
            },
            Panel::Checklist { id: i, title, items } => Panel::Checklist {
                id: id(&i),
                title: clip(&title, MAX_SHORT),
                items: items.iter().take(30).enumerate().map(|(n, c)| CheckItem { id: if c.id.is_empty() { format!("item-{n}") } else { clip(&c.id, 40) }, text: clip(&c.text, 200), done: c.done }).collect(),
            },
            Panel::Form { id: i, title, fields, submit } => {
                let fields: Vec<Field> = fields
                    .into_iter()
                    .take(10)
                    .enumerate()
                    .map(|(n, f)| Field { id: if f.id.is_empty() { format!("field-{n}") } else { clip(&f.id, 40) }, label: clip(&f.label, 100), choices: f.choices.iter().take(12).map(|c| clip(c, 80)).collect(), placeholder: clip_opt(&f.placeholder, 80), kind: f.kind })
                    .collect();
                if fields.is_empty() {
                    return None;
                }
                Panel::Form { id: id(&i), title: clip(&title, MAX_SHORT), fields, submit: if submit.trim().is_empty() { "Send".into() } else { clip(&submit, 30) } }
            }
            Panel::Sources { id: i, title, items } => {
                let items: Vec<Source> = items.into_iter().filter_map(|s| web_source(&s)).take(12).collect();
                if items.is_empty() {
                    return None;
                }
                Panel::Sources { id: id(&i), title: if title.trim().is_empty() { "Sources".into() } else { clip(&title, MAX_SHORT) }, items }
            }
            Panel::Live { id: i, title, metrics } => {
                let metrics: Vec<String> = metrics.into_iter().filter(|m| LIVE_METRICS.contains(&m.as_str())).take(LIVE_METRICS.len()).collect();
                Panel::Live { id: id(&i), title: if title.trim().is_empty() { "Your computer, live".into() } else { clip(&title, MAX_SHORT) }, metrics }
            }
            Panel::Media { id: i, title, url, caption, path, channel, length, choices } => {
                let path = path.map(|p| p.trim().to_string()).filter(|p| super::local_media::plausible(p));
                if path.is_none() && !web_address(&url) {
                    return None;
                }
                let url = if path.is_some() { String::new() } else { url.trim().to_string() };
                let choices = choices.iter().filter_map(media_choice).take(MAX_MEDIA_CHOICES).collect();
                Panel::Media { id: id(&i), title: clip(&title, MAX_SHORT), url, caption: clip_opt(&caption, 300), path, channel: clip_opt(&channel, 80), length: clip_opt(&length, 12), choices }
            }
            Panel::Web { id: i, title, url, summary } => {
                if !web_address(&url) {
                    return None;
                }
                Panel::Web { id: id(&i), title: clip(&title, MAX_SHORT), url: url.trim().to_string(), summary: clip_opt(&summary, 400) }
            }
            Panel::File { id: i, title, path, note } => {
                let p = path.trim();
                if !(p.starts_with("~/") || p.starts_with("/Users/")) || p.contains("..") || p.len() > 500 {
                    return None;
                }
                Panel::File { id: id(&i), title: clip(&title, MAX_SHORT), path: p.to_string(), note: clip_opt(&note, 300) }
            }
            // The plan to approve and the person's facts come only from the core, never an engine.
            Panel::Approval { .. } | Panel::Facts { .. } => return None,
        };
        has_content(&p).then_some(p)
    }
}


impl Panel {
    /// Give the panel its id (streamed panels are numbered in arrival order).
    pub fn set_id(&mut self, new: &str) {
        let (Panel::Text { id, .. }
        | Panel::Table { id, .. }
        | Panel::Steps { id, .. }
        | Panel::Formula { id, .. }
        | Panel::Cards { id, .. }
        | Panel::Quiz { id, .. }
        | Panel::Chart { id, .. }
        | Panel::Files { id, .. }
        | Panel::Diagram { id, .. }
        | Panel::Timeline { id, .. }
        | Panel::Folder { id, .. }
        | Panel::Sliders { id, .. }
        | Panel::Flashcards { id, .. }
        | Panel::Agenda { id, .. }
        | Panel::Checklist { id, .. }
        | Panel::Form { id, .. }
        | Panel::Sources { id, .. }
        | Panel::Live { id, .. }
        | Panel::Media { id, .. }
        | Panel::Web { id, .. }
        | Panel::File { id, .. }
        | Panel::Approval { id, .. }
        | Panel::Facts { id, .. }) = self;
        *id = new.to_string();
    }
}

#[cfg(test)]
mod empty_tests {
    use super::*;

    #[test]
    fn a_panel_with_nothing_in_it_is_dropped() {
        let table = Panel::Table { id: String::new(), title: "Devices".into(), caption: None, columns: vec!["Name".into()], rows: vec![], highlight: vec![] };
        assert!(table.cap(0).is_none(), "a table with no rows");
        let blank_rows = Panel::Table { id: String::new(), title: "Devices".into(), caption: None, columns: vec!["Name".into()], rows: vec![vec![serde_json::json!("")]], highlight: vec![] };
        assert!(blank_rows.cap(0).is_none(), "rows with only empty cells");
        assert!(Panel::Text { id: String::new(), title: "Note".into(), body: "  ".into(), bullets: vec![] }.cap(0).is_none());
        assert!(Panel::Steps { id: String::new(), title: "How".into(), steps: vec![] }.cap(0).is_none());
        assert!(Panel::Text { id: String::new(), title: "Note".into(), body: "Real words.".into(), bullets: vec![] }.cap(0).is_some());
        assert!(Panel::Live { id: String::new(), title: "Live".into(), metrics: vec![] }.cap(0).is_some(), "a live panel fills itself");
    }

    #[test]
    fn a_media_panel_plays_a_web_address_or_a_media_file_and_keeps_good_choices() {
        let media = |url: &str, path: Option<&str>, choices: Vec<MediaChoice>| Panel::Media { id: String::new(), title: "Volcanoes".into(), url: url.into(), caption: None, path: path.map(Into::into), channel: Some("Nat Geo".into()), length: Some("4:59".into()), choices };
        let choice = |title: &str, url: &str, path: Option<&str>| MediaChoice { title: title.into(), url: url.into(), path: path.map(Into::into), channel: None, length: None };
        assert!(media("javascript:alert(1)", None, vec![]).cap(0).is_none(), "not a web address");
        assert!(media("", Some("/etc/passwd"), vec![]).cap(0).is_none(), "not a media file in a home");
        let Some(Panel::Media { url, path, .. }) = media("https://evil.example/x", Some("~/Movies/Trip.mp4"), vec![]).cap(0) else { panic!("a local file plays") };
        assert_eq!((url.as_str(), path.as_deref()), ("", Some("~/Movies/Trip.mp4")), "a local panel carries no web address");
        let choices = vec![choice("Good", "https://www.youtube.com/watch?v=abcdefgh", None), choice("Bad", "file:///etc/passwd", None), choice("", "https://x.org/a.mp4", None), choice("Song", "", Some("~/Music/a.mp3"))];
        let Some(Panel::Media { choices, channel, length, .. }) = media("https://www.youtube.com/watch?v=dQw4w9WgXcQ", None, choices).cap(0) else { panic!("kept") };
        assert_eq!(choices.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(), ["Good", "Song"]);
        assert_eq!((channel.as_deref(), length.as_deref()), (Some("Nat Geo"), Some("4:59")));
    }
}
