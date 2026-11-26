//! The question catalog: every question a keeper can ask its own Context Graph, named and
//! bounded. This is how a keeper remembers: the window's Questions tab, the `ask-memory` skill
//! and the built-in mind all go through `run`, and every answer carries the exact SPARQL it ran.
//!
//! Rules (DKG reference §6, LES-013, LES-001): each question reads ONE record class of ONE
//! graph's Working Memory, carries a LIMIT or is a GROUP BY, and never interpolates free text.
//! Parameters are typed and validated (`Param`): a number of days becomes a computed timestamp,
//! a category comes from a fixed list, a chat is a 16-hex id, a skill matches `[a-z:-]{1,40}`.
//! Matching words ("anything about Maya") is done in Rust over the rows, never inside SPARQL.

use std::collections::HashMap;

use chrono::Duration;
use serde::Serialize;

use crate::kernel::{time, DeskError, Result};

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> ";

/// Categories a fact may carry (the brain's prompt names the same list).
pub const CATEGORIES: &[&str] = &["identity", "preference", "person", "place", "work", "health", "schedule", "general"];

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Param {
    /// Whole days back from now, 1–3650.
    Days,
    /// One of `CATEGORIES`.
    Category,
    /// A chat id (16 hex characters).
    Chat,
    /// A skill name (`open-app`, `agent:Bash`, …).
    Skill,
    /// A mode id (`keepers::kit::roles`).
    Mode,
}

pub struct Question {
    pub id: &'static str,
    pub title: &'static str,
    pub group: &'static str,
    pub params: &'static [Param],
    /// The query with `{days}`, `{category}`, `{chat}`, `{skill}` placeholders (filled only with validated values).
    pub body: &'static str,
}

pub const QUESTIONS: &[Question] = &[
    // ---- knowledge (what the keeper knows about you) ----
    Question { id: "facts-all", title: "Everything I know about you", group: "Knowledge", params: &[],
        body: "SELECT ?f ?text ?category ?at WHERE { ?f a desk:Fact ; schema:text ?text ; prov:generatedAtTime ?at . OPTIONAL { ?f desk:category ?category } } ORDER BY DESC(?at) LIMIT 200" },
    Question { id: "facts-by-category", title: "What I know in one area", group: "Knowledge", params: &[Param::Category],
        body: "SELECT ?f ?text ?at WHERE { ?f a desk:Fact ; schema:text ?text ; desk:category \"{category}\" ; prov:generatedAtTime ?at } ORDER BY DESC(?at) LIMIT 100" },
    Question { id: "facts-by-mode", title: "What I learned in one mode", group: "Knowledge", params: &[Param::Mode],
        body: "SELECT ?f ?text ?category ?at WHERE { ?f a desk:Fact ; schema:text ?text ; desk:mode \"{mode}\" ; prov:generatedAtTime ?at . OPTIONAL { ?f desk:category ?category } } ORDER BY DESC(?at) LIMIT 100" },
    Question { id: "facts-recent", title: "What I learned recently", group: "Knowledge", params: &[Param::Days],
        body: "SELECT ?f ?text ?category ?at WHERE { ?f a desk:Fact ; schema:text ?text ; prov:generatedAtTime ?at . OPTIONAL { ?f desk:category ?category } FILTER(?at >= \"{since}\"^^xsd:dateTime) } ORDER BY DESC(?at) LIMIT 100" },
    Question { id: "facts-per-category", title: "How much I know in each area", group: "Knowledge", params: &[],
        body: "SELECT ?category (COUNT(?f) AS ?facts) WHERE { ?f a desk:Fact ; desk:category ?category } GROUP BY ?category" },
    Question { id: "forgotten", title: "What you asked me to forget", group: "Knowledge", params: &[],
        body: "SELECT ?r ?fact ?at WHERE { ?r a desk:Retraction ; desk:retracts ?fact ; prov:generatedAtTime ?at } ORDER BY DESC(?at) LIMIT 200" },
    // ---- conversations ----
    Question { id: "chats", title: "Our chats", group: "Conversations", params: &[],
        body: "SELECT ?c ?title ?at ?pinned WHERE { ?c a desk:Chat ; schema:name ?title ; prov:generatedAtTime ?at . OPTIONAL { ?c desk:pinned ?pinned } } ORDER BY DESC(?at) LIMIT 500" },
    Question { id: "chat-turns", title: "One chat, start to finish", group: "Conversations", params: &[Param::Chat],
        body: "SELECT ?t ?said ?replied ?mind ?at ?panels ?mode WHERE { ?t a desk:Turn ; desk:inChat <urn:umoja:desk:chat:{chat}> ; desk:said ?said ; desk:replied ?replied ; prov:generatedAtTime ?at . OPTIONAL { ?t desk:mind ?mind } OPTIONAL { ?t desk:panels ?panels } OPTIONAL { ?t desk:mode ?mode } } ORDER BY ?at LIMIT 300" },
    Question { id: "turns-recent", title: "What we talked about lately", group: "Conversations", params: &[Param::Days],
        body: "SELECT ?t ?said ?replied ?mind ?at WHERE { ?t a desk:Turn ; desk:said ?said ; desk:replied ?replied ; prov:generatedAtTime ?at . OPTIONAL { ?t desk:mind ?mind } FILTER(?at >= \"{since}\"^^xsd:dateTime) } ORDER BY DESC(?at) LIMIT 200" },
    Question { id: "turns-per-day", title: "How much we talk each day", group: "Conversations", params: &[],
        body: "SELECT ?day (COUNT(?t) AS ?turns) WHERE { ?t a desk:Turn ; prov:generatedAtTime ?at . BIND(SUBSTR(STR(?at), 1, 10) AS ?day) } GROUP BY ?day ORDER BY DESC(?day) LIMIT 60" },
    Question { id: "minds-used", title: "Which brains answered me", group: "Conversations", params: &[],
        body: "SELECT ?mind (COUNT(?t) AS ?turns) WHERE { ?t a desk:Turn ; desk:mind ?mind } GROUP BY ?mind" },
    // ---- actions (what the keeper did) ----
    Question { id: "actions-recent", title: "What I did for you lately", group: "Actions", params: &[Param::Days],
        body: "SELECT ?a ?skill ?input ?outcome ?succeeded ?at WHERE { ?a a desk:Action ; desk:skill ?skill ; desk:outcome ?outcome ; prov:generatedAtTime ?at . OPTIONAL { ?a desk:input ?input } OPTIONAL { ?a desk:succeeded ?succeeded } FILTER(?at >= \"{since}\"^^xsd:dateTime) } ORDER BY DESC(?at) LIMIT 200" },
    Question { id: "actions-by-skill", title: "Every time I used one skill", group: "Actions", params: &[Param::Skill],
        body: "SELECT ?a ?input ?outcome ?at WHERE { ?a a desk:Action ; desk:skill \"{skill}\" ; desk:outcome ?outcome ; prov:generatedAtTime ?at . OPTIONAL { ?a desk:input ?input } } ORDER BY DESC(?at) LIMIT 200" },
    Question { id: "agent-steps", title: "Everything the agent ran on this computer", group: "Actions", params: &[],
        body: "SELECT ?a ?skill ?input ?at WHERE { ?a a desk:Action ; desk:skill ?skill ; prov:generatedAtTime ?at . OPTIONAL { ?a desk:input ?input } FILTER(STRSTARTS(?skill, \"agent:\")) } ORDER BY DESC(?at) LIMIT 300" },
    Question { id: "actions-failed", title: "What didn't work", group: "Actions", params: &[],
        body: "SELECT ?a ?skill ?outcome ?at WHERE { ?a a desk:Action ; desk:skill ?skill ; desk:outcome ?outcome ; desk:succeeded \"no\" ; prov:generatedAtTime ?at } ORDER BY DESC(?at) LIMIT 100" },
    Question { id: "skills-used", title: "Which skills I use most", group: "Actions", params: &[],
        body: "SELECT ?skill (COUNT(?a) AS ?times) WHERE { ?a a desk:Action ; desk:skill ?skill } GROUP BY ?skill ORDER BY DESC(?times) LIMIT 50" },
    Question { id: "brain-changes", title: "When my brain was changed", group: "Actions", params: &[],
        body: "SELECT ?a ?input ?outcome ?at WHERE { ?a a desk:Action ; desk:skill \"switch-engine\" ; desk:outcome ?outcome ; prov:generatedAtTime ?at . OPTIONAL { ?a desk:input ?input } } ORDER BY DESC(?at) LIMIT 50" },
    // ---- reminders ----
    Question { id: "reminders-all", title: "Every reminder", group: "Reminders", params: &[],
        body: "SELECT ?r ?text ?due ?at WHERE { ?r a desk:Reminder ; schema:text ?text ; desk:dueAt ?due ; prov:generatedAtTime ?at } ORDER BY DESC(?due) LIMIT 200" },
    Question { id: "reminders-upcoming", title: "Reminders still ahead", group: "Reminders", params: &[],
        body: "SELECT ?r ?text ?due WHERE { ?r a desk:Reminder ; schema:text ?text ; desk:dueAt ?due . FILTER(?due >= \"{now}\"^^xsd:dateTime) } ORDER BY ?due LIMIT 100" },
    // ---- the keeper itself ----
    Question { id: "profile", title: "Who I am", group: "About me", params: &[],
        body: "SELECT ?name ?domain ?skin ?at WHERE { ?k a prov:SoftwareAgent ; schema:name ?name ; prov:generatedAtTime ?at . OPTIONAL { ?k desk:domain ?domain } OPTIONAL { ?k desk:skin ?skin } } LIMIT 5" },
    Question { id: "memory-size", title: "How much is in my memory", group: "About me", params: &[],
        body: "SELECT ?type (COUNT(?s) AS ?n) WHERE { VALUES ?type { desk:Fact desk:Turn desk:Chat desk:Action desk:Reminder desk:Retraction } ?s a ?type } GROUP BY ?type" },
];

pub fn find(id: &str) -> Option<&'static Question> {
    QUESTIONS.iter().find(|q| q.id == id)
}

fn invalid(what: &str) -> DeskError {
    DeskError::Invalid(format!("That question needs a valid {what}."))
}

/// Fill a question's placeholders with validated values; anything invalid is refused.
pub fn build(q: &Question, args: &HashMap<String, String>) -> Result<String> {
    let mut body = q.body.replace("{now}", &time::now_iso());
    for p in q.params {
        let raw = args.get(match p {
            Param::Days => "days",
            Param::Category => "category",
            Param::Chat => "chat",
            Param::Skill => "skill",
            Param::Mode => "mode",
        });
        let value = raw.map(|s| s.trim()).unwrap_or_default();
        match p {
            Param::Days => {
                let days: i64 = value.parse().ok().filter(|d| (1..=3650).contains(d)).ok_or_else(|| invalid("number of days"))?;
                body = body.replace("{since}", &time::iso(time::now() - Duration::days(days)));
            }
            Param::Category => {
                let c = CATEGORIES.iter().find(|c| **c == value).ok_or_else(|| invalid("category"))?;
                body = body.replace("{category}", c);
            }
            Param::Chat => {
                if value.len() != 16 || !value.chars().all(|c| c.is_ascii_hexdigit()) {
                    return Err(invalid("chat"));
                }
                body = body.replace("{chat}", value);
            }
            Param::Mode => {
                if !crate::keepers::kit::roles::exists(value) {
                    return Err(invalid("mode"));
                }
                // Mode ids are slugs (letters, digits, dashes), safe in the literal.
                body = body.replace("{mode}", value);
            }
            Param::Skill => {
                if value.is_empty() || value.len() > 40 || !value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_uppercase() || ":-".contains(c)) {
                    return Err(invalid("skill"));
                }
                body = body.replace("{skill}", value);
            }
        }
    }
    Ok(format!("{PREFIXES}{body}"))
}

/// The catalog as the window shows it.
#[derive(Debug, Serialize)]
pub struct QuestionInfo {
    pub id: &'static str,
    pub title: &'static str,
    pub group: &'static str,
    pub params: &'static [Param],
}

pub fn list() -> Vec<QuestionInfo> {
    QUESTIONS.iter().map(|q| QuestionInfo { id: q.id, title: q.title, group: q.group, params: q.params }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn every_question_is_bounded_typed_and_single_asset() {
        let filled = args(&[("days", "7"), ("category", "preference"), ("chat", "0123456789abcdef"), ("skill", "agent:Bash"), ("mode", "researcher")]);
        let mut ids = std::collections::HashSet::new();
        for q in QUESTIONS {
            assert!(ids.insert(q.id), "{} is listed twice", q.id);
            let s = build(q, &filled).unwrap();
            assert!(s.contains("LIMIT") || s.contains("GROUP BY"), "{} is unbounded", q.id);
            assert!(s.contains(" a desk:") || s.contains(" a prov:") || s.contains("VALUES ?type"), "{} names no class", q.id);
            assert!(!s.contains("?s ?p ?o") && !s.contains("NOT EXISTS") && !s.contains("MINUS"), "{} breaks LES-001/013", q.id);
            assert!(!s.contains('{') || !s.contains("{days}") && !s.contains("{since}") && !s.contains("{chat}"), "{} left a placeholder", q.id);
        }
        assert!(QUESTIONS.len() >= 20);
    }

    #[test]
    fn every_optional_value_is_selected() {
        // FIX-0004: chat-turns read ?panels in an OPTIONAL but did not SELECT it, so scenes never came back.
        for q in QUESTIONS {
            if q.body.contains("COUNT(") {
                continue;
            }
            let select = &q.body[..q.body.find("WHERE").unwrap_or(0)];
            for part in q.body.split("OPTIONAL {").skip(1) {
                let var = part.split('}').next().unwrap_or("").split_whitespace().last().unwrap_or("");
                assert!(select.contains(var), "{}: OPTIONAL {var} is never selected", q.id);
            }
        }
    }

    #[test]
    fn parameters_cannot_carry_sparql() {
        let q = find("facts-by-category").unwrap();
        assert!(build(q, &args(&[("category", "x\" } ?s ?p ?o {")])).is_err());
        assert!(build(find("chat-turns").unwrap(), &args(&[("chat", "> } DELETE {")])).is_err());
        assert!(build(find("actions-by-skill").unwrap(), &args(&[("skill", "a\" . ?x")])).is_err());
        assert!(build(find("facts-recent").unwrap(), &args(&[("days", "-1")])).is_err());
        assert!(build(find("facts-recent").unwrap(), &args(&[])).is_err());
    }
}
