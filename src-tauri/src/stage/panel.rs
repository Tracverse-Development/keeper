//! The Stage panel kinds (mirrors `src/kernel/panel-spec.ts`, serde tag "kind") and the limits
//! every panel is capped to. Capping lives in `cap.rs`; reading engine output in `mod.rs`.

use serde::{Deserialize, Serialize};

pub const MAX_PANELS: usize = 6;
pub const MAX_TEXT: usize = 2400;
pub const MAX_SHORT: usize = 160;
pub const MAX_ITEMS: usize = 24;
pub const MAX_COLUMNS: usize = 14;
pub const MAX_ROWS: usize = 24;

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
pub struct Node {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Edge {
    pub from: String,
    pub to: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Moment {
    pub when: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Folder,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Change {
    Added,
    Removed,
    Moved,
    Kept,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Entry {
    pub name: String,
    pub kind: EntryKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub change: Option<Change>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Variable {
    pub name: String,
    pub label: String,
    pub min: f64,
    pub max: f64,
    pub step: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Flashcard {
    pub front: String,
    pub back: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AgendaKind {
    Event,
    Reminder,
    Task,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgendaItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<AgendaKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CheckItem {
    #[serde(default)]
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FieldKind {
    Text,
    Number,
    Choice,
    Date,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Field {
    #[serde(default)]
    pub id: String,
    pub label: String,
    pub kind: FieldKind,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub choices: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PlanStep {
    pub action: String,
    pub target: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FactRow {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub category: String,
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
    Diagram { #[serde(default)] id: String, title: String, nodes: Vec<Node>, #[serde(default)] edges: Vec<Edge> },
    Timeline { #[serde(default)] id: String, title: String, events: Vec<Moment> },
    Folder { #[serde(default)] id: String, title: String, path: String, entries: Vec<Entry> },
    Sliders { #[serde(default)] id: String, title: String, expression: String, #[serde(rename = "resultLabel", default)] result_label: String, #[serde(default)] unit: Option<String>, variables: Vec<Variable> },
    Flashcards { #[serde(default)] id: String, title: String, cards: Vec<Flashcard> },
    Agenda { #[serde(default)] id: String, title: String, items: Vec<AgendaItem> },
    Checklist { #[serde(default)] id: String, title: String, items: Vec<CheckItem> },
    Form { #[serde(default)] id: String, title: String, fields: Vec<Field>, #[serde(default)] submit: String },
    /// Only the core writes these (the plan before acting); engines' approval panels are dropped.
    Approval { #[serde(default)] id: String, title: String, summary: String, steps: Vec<PlanStep>, token: String },
    /// Only the core writes these (from the graph); engines' facts panels are dropped.
    Facts { #[serde(default)] id: String, title: String, facts: Vec<FactRow> },
}

