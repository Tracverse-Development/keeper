//! Where a record lives: ONE context graph and, inside it, a named sub-graph (founder 2026-11-26:
//! "use ONE context graph and then have your stuff organized into subgraphs"). Every Keeper read,
//! write and erasure names its place, because an unscoped query sees every sub-graph.
//! See docs/design/keeper-memory-graph.md.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A context graph and, optionally, one of its sub-graphs (`kit`, `keeper-1`…).
#[derive(Debug, Clone, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Place {
    pub graph: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
}

impl Place {
    pub fn new(graph: &str, sub: Option<&str>) -> Place {
        Place { graph: graph.to_string(), sub: sub.filter(|s| !s.is_empty()).map(str::to_string) }
    }

    /// A stable key for caches kept per place ("graph" or "graph/sub").
    pub fn key(&self) -> String {
        match &self.sub {
            Some(sub) => format!("{}/{sub}", self.graph),
            None => self.graph.clone(),
        }
    }

    /// Adds the place to a request body: `contextGraphId`, and `subGraphName` when it has one.
    pub fn into_body(&self, mut body: Value) -> Value {
        body["contextGraphId"] = Value::String(self.graph.clone());
        if let Some(sub) = &self.sub {
            body["subGraphName"] = Value::String(sub.clone());
        }
        body
    }
}

impl From<&str> for Place {
    fn from(graph: &str) -> Place {
        Place::new(graph, None)
    }
}

impl From<&String> for Place {
    fn from(graph: &String) -> Place {
        Place::new(graph, None)
    }
}

impl From<&Place> for Place {
    fn from(place: &Place) -> Place {
        place.clone()
    }
}

/// A sub-graph name the node accepts and that names no person: letters, digits and dashes.
pub fn valid_sub(name: &str) -> bool {
    !name.is_empty() && name.len() <= 48 && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::{valid_sub, Place};

    #[test]
    fn a_place_names_its_graph_and_sub_graph() {
        let p = Place::new("umoja-desk-x", Some("kit"));
        assert_eq!(p.key(), "umoja-desk-x/kit");
        let body = p.into_body(serde_json::json!({ "sparql": "SELECT" }));
        assert_eq!((body["contextGraphId"].as_str(), body["subGraphName"].as_str()), (Some("umoja-desk-x"), Some("kit")));
        let root: Place = "umoja-desk-x".into();
        assert!(root.into_body(serde_json::json!({})).get("subGraphName").is_none());
        assert_eq!(Place::new("g", Some("")).sub, None, "an empty name is no sub-graph");
        assert!(valid_sub("keeper-1") && !valid_sub("my notes") && !valid_sub(""));
    }
}
