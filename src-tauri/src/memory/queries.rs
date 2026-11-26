//! Every SPARQL query Keeper runs. Bounded by construction (DKG reference §6, LES-013):
//! each names the class it reads, carries a LIMIT or is a GROUP BY, and NEVER interpolates
//! a person's words. Ranking against what was said happens in Rust (`rank.rs`), not in SPARQL.
//!
//! Each Knowledge Asset is its own scope in Working Memory (node 10.0.26): a pattern that joins
//! two assets (a fact and the retraction that names it) matches nothing, so `FILTER NOT EXISTS`
//! over another asset silently keeps everything. Every query here reads ONE class, and joins
//! across records happen in Rust (LES-001).

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> ";

/// A named query, so the window can show the person exactly what was asked of their graph.
pub struct Query {
    pub label: &'static str,
    pub body: &'static str,
}

impl Query {
    pub fn sparql(&self) -> String {
        format!("{PREFIXES}{}", self.body)
    }
}

pub const FACTS: Query = Query {
    label: "What do I know about you?",
    body: "SELECT ?f ?text ?category ?at ?mode ?topics WHERE { ?f a desk:Fact ; schema:text ?text ; prov:generatedAtTime ?at . OPTIONAL { ?f desk:category ?category } OPTIONAL { ?f desk:mode ?mode } OPTIONAL { ?f desk:topics ?topics } } ORDER BY DESC(?at) LIMIT 5000",
};

/// The facts the person asked to forget (filtered out of `FACTS` in Rust, see the module note).
pub const RETRACTIONS: Query = Query {
    label: "What did you ask me to forget?",
    body: "SELECT ?fact WHERE { ?r a desk:Retraction ; desk:retracts ?fact } LIMIT 5000",
};

pub const RECENT_TURNS: Query = Query {
    label: "What did we just talk about?",
    // Enough recent turns, from every chat, to give this chat its own last exchanges and to
    // name the other chats going on (`Memory::recall` splits them).
    body: "SELECT ?t ?said ?replied ?mind ?at ?c WHERE { ?t a desk:Turn ; desk:said ?said ; desk:replied ?replied ; prov:generatedAtTime ?at . OPTIONAL { ?t desk:mind ?mind } OPTIONAL { ?t desk:inChat ?c } } ORDER BY DESC(?at) LIMIT 40",
};

pub const HISTORY: Query = Query {
    label: "What have we talked about?",
    body: "SELECT ?t ?said ?replied ?mind ?at WHERE { ?t a desk:Turn ; desk:said ?said ; desk:replied ?replied ; prov:generatedAtTime ?at . OPTIONAL { ?t desk:mind ?mind } } ORDER BY DESC(?at) LIMIT 200",
};

pub const RECENT_ACTIONS: Query = Query {
    label: "What have I done for you?",
    body: "SELECT ?a ?skill ?input ?outcome ?succeeded ?at WHERE { ?a a desk:Action ; desk:skill ?skill ; desk:outcome ?outcome ; prov:generatedAtTime ?at . OPTIONAL { ?a desk:input ?input } OPTIONAL { ?a desk:succeeded ?succeeded } } ORDER BY DESC(?at) LIMIT 25",
};

pub const REMINDERS: Query = Query {
    label: "Which reminders are coming up?",
    body: "SELECT ?r ?text ?due ?at WHERE { ?r a desk:Reminder ; schema:text ?text ; desk:dueAt ?due ; prov:generatedAtTime ?at } ORDER BY ?due LIMIT 50",
};

pub const COUNTS: Query = Query {
    label: "How much is in my memory?",
    body: "SELECT ?type (COUNT(?s) AS ?n) WHERE { VALUES ?type { desk:Fact desk:Turn desk:Action desk:Reminder desk:Retraction } ?s a ?type } GROUP BY ?type",
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_query_is_bounded_and_typed() {
        for q in [&FACTS, &RETRACTIONS, &RECENT_TURNS, &HISTORY, &RECENT_ACTIONS, &REMINDERS, &COUNTS] {
            let s = q.sparql();
            assert!(s.contains("LIMIT") || s.contains("GROUP BY"), "{} is unbounded", q.label);
            assert!(s.contains(" a desk:") || s.contains("VALUES ?type"), "{} does not name a class", q.label);
            assert!(!s.contains("?s ?p ?o"), "{} scans the whole graph", q.label);
            // LES-001: a cross-asset filter matches nothing in Working Memory.
            assert!(!s.contains("NOT EXISTS") && !s.contains("MINUS"), "{} joins across assets", q.label);
        }
    }
}
