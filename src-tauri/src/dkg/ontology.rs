//! The vocabulary Keeper writes on the DKG. Classes live under the Umoja Ark namespace
//! (`https://umojaark.com/ns/desk#`) and are also typed with schema.org and PROV-O so any
//! DKG reader understands them without knowing Umoja.

pub const RDF_TYPE: &str = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
pub const XSD_DATETIME: &str = "http://www.w3.org/2001/XMLSchema#dateTime";

pub const DESK: &str = "https://umojaark.com/ns/desk#";
pub const SCHEMA: &str = "http://schema.org/";
pub const PROV: &str = "http://www.w3.org/ns/prov#";

/// Expand `desk:Fact`, `schema:text`, `prov:generatedAtTime` into full IRIs.
pub fn iri(curie: &str) -> String {
    let (prefix, local) = curie.split_once(':').unwrap_or(("", curie));
    let base = match prefix {
        "desk" => DESK,
        "schema" => SCHEMA,
        "prov" => PROV,
        _ => return curie.to_string(),
    };
    format!("{base}{local}")
}

/// Classes.
pub mod class {
    /// Something the assistant learned about the person ("You like sorrel").
    pub const FACT: &str = "desk:Fact";
    /// One exchange: what the person said and what the assistant answered.
    pub const TURN: &str = "desk:Turn";
    /// Something the assistant DID (opened an app, set a reminder), with its outcome.
    pub const ACTION: &str = "desk:Action";
    /// A reminder the assistant will speak at a time.
    pub const REMINDER: &str = "desk:Reminder";
    /// A fact the person asked the assistant to forget (writes are additive; see memory::forget).
    pub const RETRACTION: &str = "desk:Retraction";
    /// The person this memory graph belongs to.
    pub const PERSON: &str = "schema:Person";
    /// The assistant itself.
    pub const AGENT: &str = "prov:SoftwareAgent";
}

/// Predicates.
pub mod pred {
    pub const TEXT: &str = "schema:text";
    pub const NAME: &str = "schema:name";
    pub const CATEGORY: &str = "desk:category";
    pub const SAID: &str = "desk:said";
    pub const REPLIED: &str = "desk:replied";
    pub const MIND: &str = "desk:mind";
    pub const SKILL: &str = "desk:skill";
    pub const INPUT: &str = "desk:input";
    pub const OUTCOME: &str = "desk:outcome";
    pub const SUCCEEDED: &str = "desk:succeeded";
    pub const DUE_AT: &str = "desk:dueAt";
    pub const RETRACTS: &str = "desk:retracts";
    pub const ABOUT: &str = "schema:about";
    pub const AT: &str = "prov:generatedAtTime";
    pub const BY: &str = "prov:wasAttributedTo";
    pub const FROM: &str = "prov:wasDerivedFrom";
}

/// Entity IRIs: `urn:umoja:desk:<kind>:<id>`.
pub fn entity(kind: &str, id: &str) -> String {
    format!("urn:umoja:desk:{kind}:{id}")
}

/// The assistant as a PROV agent (the author of everything it writes).
pub const ASSISTANT: &str = "urn:umoja:desk:agent:assistant";
/// The person whose memory this is.
pub const OWNER: &str = "urn:umoja:desk:person:owner";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curies_expand() {
        assert_eq!(iri("desk:Fact"), "https://umojaark.com/ns/desk#Fact");
        assert_eq!(iri("schema:text"), "http://schema.org/text");
        assert_eq!(iri("urn:x:y"), "urn:x:y");
    }
}
