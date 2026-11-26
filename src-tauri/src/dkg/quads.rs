//! Builder pattern: one record → the RDF quads of one Knowledge Asset.
//!
//! ```ignore
//! let quads = AssetBuilder::new(&entity("fact", id))
//!     .a(class::FACT).a("schema:Thing")
//!     .text(pred::TEXT, "You like sorrel")
//!     .time(pred::AT, &now_iso())
//!     .link(pred::BY, ASSISTANT)
//!     .build();
//! ```

use serde::{Deserialize, Serialize};

use super::{literal, ontology};

/// One quad in the shape `POST /api/knowledge-assets` takes (`object` is an IRI or an encoded literal).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Quad {
    pub subject: String,
    pub predicate: String,
    pub object: String,
}

pub struct AssetBuilder {
    subject: String,
    quads: Vec<Quad>,
}

impl AssetBuilder {
    pub fn new(subject: &str) -> Self {
        AssetBuilder { subject: subject.to_string(), quads: Vec::new() }
    }

    fn push(mut self, predicate: &str, object: String) -> Self {
        self.quads.push(Quad { subject: self.subject.clone(), predicate: ontology::iri(predicate), object });
        self
    }

    /// `rdf:type` (a CURIE such as `desk:Fact`).
    pub fn a(self, class: &str) -> Self {
        let object = ontology::iri(class);
        self.push(ontology::RDF_TYPE, object)
    }

    /// A string literal; empty strings are skipped (no blank facts on the graph).
    pub fn text(self, predicate: &str, value: &str) -> Self {
        if value.trim().is_empty() {
            return self;
        }
        self.push(predicate, literal::text(value))
    }

    pub fn time(self, predicate: &str, iso: &str) -> Self {
        self.push(predicate, literal::datetime(iso))
    }

    /// A link to another entity (an IRI).
    pub fn link(self, predicate: &str, iri: &str) -> Self {
        let object = ontology::iri(iri);
        self.push(predicate, object)
    }

    pub fn build(self) -> Vec<Quad> {
        self.quads
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dkg::ontology::{class, pred};

    #[test]
    fn builds_typed_quads_and_skips_blanks() {
        let quads = AssetBuilder::new("urn:umoja:desk:fact:1")
            .a(class::FACT)
            .text(pred::TEXT, "likes sorrel")
            .text(pred::CATEGORY, "  ")
            .time(pred::AT, "2026-11-25T10:00:00Z")
            .build();
        assert_eq!(quads.len(), 3);
        assert_eq!(quads[0].object, "https://umojaark.com/ns/desk#Fact");
        assert_eq!(quads[1].predicate, "http://schema.org/text");
        assert!(quads[2].object.ends_with("#dateTime>"));
    }
}
