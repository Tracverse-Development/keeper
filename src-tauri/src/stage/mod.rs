//! The Stage: what an engine may ask Keeper to SHOW inside its own window (panels), instead of
//! building a web page or a file. Mirrors `src/stage/panel-spec.ts` (serde tag "kind").
//!
//! Engines are untrusted writers: every panel is parsed into this closed set of kinds, unknown
//! kinds and malformed panels are dropped (never shown as raw text), and every string, list and
//! table is capped (`cap`) so one answer cannot flood the window. The window renders text only.

mod cap;
pub mod open;
pub mod panel;
pub mod stream;

pub use panel::Panel;
use panel::MAX_PANELS;

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
files, web pages or documents and NEVER open a browser just to show something: use panels. Every panel stands on its own: its title says what it shows, and it \
holds real content, never a placeholder. When you show numbers, a status or a result, the FIRST panel is a text panel that says in a sentence or two what it means for the person. Panel kinds (JSON objects in the \"panels\" \
array; usually 2 to 4, at most 5, each short: a few lines or items, since the person watches them arrive one by one): {\"kind\":\"text\",\"title\",\"body\",\"bullets\":[]}, {\"kind\":\"table\",\"title\",\"caption\",\"columns\":[],\"rows\":[[]],\"highlight\":[{\"row\":0,\"col\":0}]}, \
{\"kind\":\"steps\",\"title\",\"steps\":[{\"label\",\"detail\",\"math\"}]}, {\"kind\":\"formula\",\"title\",\"expression\",\"parts\":[{\"symbol\",\"meaning\"}]}, \
{\"kind\":\"cards\",\"title\",\"cards\":[{\"title\",\"body\",\"emoji\"}]}, {\"kind\":\"quiz\",\"title\",\"question\",\"choices\":[],\"answer\":0,\"explain\"}, \
{\"kind\":\"chart\",\"title\",\"labels\":[],\"values\":[],\"unit\"}, {\"kind\":\"files\",\"title\",\"items\":[{\"action\":\"open|create|move|edit|delete|find\",\"path\",\"to\"}]}, \
{\"kind\":\"diagram\",\"title\",\"nodes\":[{\"id\",\"label\",\"group\"}],\"edges\":[{\"from\",\"to\",\"label\"}]} (flows, relationships, concepts), \
{\"kind\":\"timeline\",\"title\",\"events\":[{\"when\",\"title\",\"detail\"}]}, {\"kind\":\"folder\",\"title\",\"path\",\"entries\":[{\"name\",\"kind\":\"file|folder\",\"change\":\"added|removed|moved|kept\",\"to\"}]} (show a folder before/after you change it), \
{\"kind\":\"sliders\",\"title\",\"expression\":\"weekly * weeks\",\"resultLabel\",\"unit\",\"variables\":[{\"name\",\"label\",\"min\",\"max\",\"step\",\"value\"}]} (what-if calculators; arithmetic only), \
{\"kind\":\"flashcards\",\"title\",\"cards\":[{\"front\",\"back\"}]} (practice), {\"kind\":\"agenda\",\"title\",\"items\":[{\"time\",\"title\",\"detail\",\"kind\":\"event|reminder|task\"}]}, \
{\"kind\":\"checklist\",\"title\",\"items\":[{\"id\",\"text\",\"done\"}]} (steps the person ticks off), {\"kind\":\"form\",\"title\",\"fields\":[{\"id\",\"label\",\"kind\":\"text|number|choice|date\",\"choices\"}],\"submit\"} (when you need details from the person), \
{\"kind\":\"live\",\"title\",\"metrics\":[\"cpu\",\"memory\",\"network\",\"disk\",\"apps\"]} (a LIVE dashboard of this computer that keeps updating: use it whenever the person asks how the computer, its network or its storage is doing), \
{\"kind\":\"media\",\"title\",\"url\",\"caption\"} (a video or picture to watch, https; YouTube plays in place), {\"kind\":\"web\",\"title\",\"url\",\"summary\"} (a page to visit), \
{\"kind\":\"file\",\"title\",\"path\",\"note\"} (a file you made or found, ~/…: the person can open it or show it in the Finder). \
CHOOSE PANELS FOR THE JOB, not by habit: looking at or doing something on the computer → live, table, folder, files, file (a dashboard of what is, never a lesson); teaching or \
explaining → steps, cards, diagram, formula, then a quiz; comparing → table or chart; research → table, text and sources; something to watch, visit or open → media, web, file; \
plain conversation → no panels. \
A LESSON opens with the big picture (the whole idea in one card or diagram, every term it uses introduced) before details, and \
offers ONE practice panel at a time (a quiz or flashcards, not both). A FOLLOW-UP question in a lesson keeps teaching with a panel \
that answers exactly it (a diagram, chart or labelled picture). A HOW-TO (recipe, setup, repair) shows what you need first \
(a checklist with amounts) and then the steps. Every panel stands on its own: a title that says what it shows and plain words for any term. \
Panels in one answer AGREE with each other and with your words (same numbers, same facts). Refer to a panel by its title, never \
by where it sits on screen (never \"on the left\" or \"below\"). \
With panels, keep \"reply\" to one or two spoken sentences that point at them, and write \"reply\" BEFORE \"panels\" in the JSON.";

#[cfg(test)]
mod tests {
    use super::panel::{MAX_SHORT, MAX_TEXT};
    use super::*;
    use serde_json::json;

    #[test]
    fn sources_keep_only_real_web_links() {
        let raw = json!([{"kind": "sources", "title": "", "items": [
            {"title": "WHO fact sheet", "url": "https://www.who.int/news-room/fact-sheets", "note": "symptoms"},
            {"title": "Bad", "url": "javascript:alert(1)"},
            {"title": "Spaces", "url": "https://x.org/a b"},
            {"title": "", "url": "https://untitled.org/page"}
        ]}, {"kind": "sources", "title": "None left", "items": [{"title": "x", "url": "file:///etc/passwd"}]}]);
        let panels = read(&raw);
        assert_eq!(panels.len(), 1, "a sources panel with no real link is dropped");
        let Panel::Sources { title, items, .. } = &panels[0] else { panic!() };
        assert_eq!(title, "Sources");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].url, "https://www.who.int/news-room/fact-sheets");
    }

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
    fn engines_cannot_forge_a_plan_or_your_facts() {
        let raw = json!([
            {"kind": "approval", "title": "Approve", "summary": "s", "steps": [], "token": "steal"},
            {"kind": "facts", "title": "F", "facts": [{"id": "x", "text": "t"}]},
            {"kind": "sliders", "title": "S", "expression": "a*b", "variables": [{"name": "a b", "label": "A", "min": 0, "max": 1, "step": 0.1, "value": 0.5}]},
            {"kind": "sliders", "title": "Savings", "expression": "weekly * weeks", "resultLabel": "Saved", "variables": [{"name": "weekly", "label": "Per week", "min": 0, "max": 500, "step": 10, "value": 9999}]},
            {"kind": "diagram", "title": "D", "nodes": [{"id": "a", "label": "A"}], "edges": [{"from": "a", "to": "ghost"}]}
        ]);
        let panels = read(&raw);
        assert_eq!(panels.len(), 2, "{panels:?}");
        assert!(matches!(&panels[0], Panel::Sliders { variables, .. } if variables[0].value == 500.0));
        assert!(matches!(&panels[1], Panel::Diagram { edges, .. } if edges.is_empty()));
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
