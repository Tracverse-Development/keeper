//! The DKG node's HTTP API (V10, verified against 10.0.26 on 2026-11-25):
//!
//! | call                                 | use                                             |
//! |--------------------------------------|-------------------------------------------------|
//! | `GET  /api/status`                   | is the node up, which version and network       |
//! | `POST /api/context-graph/create`     | the person's memory graph (curated, idempotent) |
//! | `POST /api/knowledge-assets`         | write one KA from inline quads into WM          |
//! | `POST /api/query`                    | SPARQL over one memory layer of one graph       |
//!
//! Everything personal stays in Working Memory (`alsoShareSwm: false`): this node only.
//! Nothing here ever publishes to Verifiable Memory (that spends TRAC and is the person's call).

use std::collections::HashMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{literal, node::NodeLocation, Quad};
use crate::kernel::{DeskError, Result};

/// Which memory layer a query reads (DKG reference §1). Keeper writes WM only.
#[derive(Debug, Clone, Copy, Serialize)]
pub enum Layer {
    #[serde(rename = "working-memory")]
    Working,
    #[allow(dead_code)] // kept for the share step a later version offers (KNOWN_ISSUES DESK-SHARE-001)
    #[serde(rename = "shared-working-memory")]
    Shared,
}

/// One SPARQL result row, values decoded to plain strings.
pub type Row = HashMap<String, String>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStatus {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub network_name: String,
    #[serde(default)]
    pub peer_id: String,
}

/// What the node answered for a KA write.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Written {
    pub name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub ka_ual: String,
    #[serde(default)]
    pub merkle_root: String,
    #[serde(default)]
    pub written: u32,
}

#[derive(Clone)]
pub struct DkgClient {
    base: String,
    token: String,
    http: reqwest::Client,
}

const STATUS_TIMEOUT: Duration = Duration::from_secs(12);
const WRITE_TIMEOUT: Duration = Duration::from_secs(30);
const QUERY_TIMEOUT: Duration = Duration::from_secs(20);

impl DkgClient {
    pub fn new(location: &NodeLocation) -> Self {
        DkgClient {
            base: format!("http://127.0.0.1:{}", location.port),
            token: location.token.clone(),
            http: reqwest::Client::builder().no_proxy().build().unwrap_or_default(),
        }
    }

    async fn call(&self, method: reqwest::Method, path: &str, body: Option<serde_json::Value>, timeout: Duration) -> Result<serde_json::Value> {
        let mut req = self.http.request(method, format!("{}{path}", self.base)).timeout(timeout).bearer_auth(&self.token);
        if let Some(body) = body {
            req = req.json(&body);
        }
        let res = req.send().await.map_err(|e| DeskError::Node(transport_words(&e)))?;
        let status = res.status();
        let text = res.text().await.map_err(|_| DeskError::Node("Your memory node's answer could not be read.".into()))?;
        if !status.is_success() {
            // The node's own message, shortened; never the request (it may carry personal words).
            let short: String = text.chars().take(200).collect();
            if status == reqwest::StatusCode::CONFLICT {
                return Err(DeskError::Exists(format!("{path}: {short}")));
            }
            return Err(DeskError::Node(refused_words(status.as_u16(), &short)));
        }
        if text.trim().is_empty() {
            return Ok(json!({}));
        }
        serde_json::from_str(&text).map_err(|_| DeskError::Node("Your memory node answered something Keeper could not read.".into()))
    }

    pub async fn status(&self) -> Result<NodeStatus> {
        let v = self.call(reqwest::Method::GET, "/api/status", None, STATUS_TIMEOUT).await?;
        Ok(serde_json::from_value(v)?)
    }

    /// Create the curated memory graph; an existing graph with this id is fine (idempotent).
    pub async fn ensure_graph(&self, id: &str, name: &str) -> Result<String> {
        let body = json!({ "id": id, "name": name, "accessPolicy": 1 });
        match self.call(reqwest::Method::POST, "/api/context-graph/create", Some(body), WRITE_TIMEOUT).await {
            Ok(v) => Ok(v["uri"].as_str().map(str::to_string).unwrap_or_else(|| format!("did:dkg:context-graph:{id}"))),
            // The node answers 409 for an existing graph (older nodes said so in a plain error).
            Err(DeskError::Exists(_)) => Ok(format!("did:dkg:context-graph:{id}")),
            Err(DeskError::Node(msg)) if msg.to_lowercase().contains("exist") => Ok(format!("did:dkg:context-graph:{id}")),
            Err(e) => Err(e),
        }
    }

    /// Write one Knowledge Asset into Working Memory (private to this node).
    pub async fn write_asset(&self, place: impl Into<super::Place>, name: &str, quads: &[Quad]) -> Result<Written> {
        let body = place.into().into_body(json!({ "name": name, "quads": quads, "alsoShareSwm": false }));
        let v = self.call(reqwest::Method::POST, "/api/knowledge-assets", Some(body), WRITE_TIMEOUT).await?;
        Ok(serde_json::from_value(v)?)
    }

    /// Discard a Knowledge Asset from Working Memory: its triples leave this node (erasure).
    /// Names are Keeper's own (`desk-…`: letters, digits, dashes), never the person's words.
    pub async fn discard(&self, place: impl Into<super::Place>, name: &str) -> Result<()> {
        if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err(DeskError::Invalid("That isn't a memory name.".into()));
        }
        self.call(reqwest::Method::POST, &format!("/api/knowledge-assets/{name}/wm/discard"), Some(place.into().into_body(json!({}))), WRITE_TIMEOUT).await?;
        Ok(())
    }

    /// True when the node has this context graph (an absent graph has nothing to move or read).
    pub async fn has_graph(&self, id: &str) -> Result<bool> {
        let v = self.call(reqwest::Method::GET, "/api/context-graph/list", None, QUERY_TIMEOUT).await?;
        let list = v["contextGraphs"].as_array().or_else(|| v.as_array()).cloned().unwrap_or_default();
        Ok(list.iter().any(|g| g["id"].as_str() == Some(id)))
    }

    /// Create a sub-graph inside a context graph (idempotent: one that exists is fine).
    pub async fn ensure_sub_graph(&self, graph: &str, sub: &str) -> Result<()> {
        if !super::place::valid_sub(sub) {
            return Err(DeskError::Invalid("That isn't a sub-graph name.".into()));
        }
        match self.call(reqwest::Method::POST, "/api/sub-graph/create", Some(json!({ "contextGraphId": graph, "subGraphName": sub })), WRITE_TIMEOUT).await {
            Ok(_) | Err(DeskError::Exists(_)) => Ok(()),
            Err(DeskError::Node(msg)) if msg.to_lowercase().contains("exist") => Ok(()),
            Err(e) => Err(e),
        }
    }

    /// A bounded SELECT whose bindings come back exactly as the node wrote them (IRIs bare,
    /// literals quoted with their datatype), for copying records as they are. `layer` None reads
    /// without a memory-layer view (the node's own `_meta` records live there).
    pub async fn query_terms(&self, place: impl Into<super::Place>, sparql: &str, layer: Option<Layer>) -> Result<Vec<std::collections::HashMap<String, String>>> {
        let mut body = place.into().into_body(json!({ "sparql": sparql }));
        if let Some(layer) = layer {
            body["view"] = serde_json::to_value(layer)?;
        }
        let v = self.call(reqwest::Method::POST, "/api/query", Some(body), QUERY_TIMEOUT).await?;
        let rows = v["result"]["bindings"].as_array().cloned().unwrap_or_default();
        Ok(rows.into_iter().filter_map(|r| r.as_object().cloned()).map(|r| r.into_iter().map(|(k, v)| (k, v.as_str().unwrap_or_default().to_string())).collect()).collect())
    }

    /// Run one bounded SPARQL SELECT (see `memory::queries`) over one layer.
    pub async fn query(&self, place: impl Into<super::Place>, sparql: &str, layer: Layer) -> Result<Vec<Row>> {
        let body = place.into().into_body(json!({ "sparql": sparql, "view": layer }));
        let v = self.call(reqwest::Method::POST, "/api/query", Some(body), QUERY_TIMEOUT).await?;
        let rows = v["result"]["bindings"].as_array().cloned().unwrap_or_default();
        Ok(rows
            .into_iter()
            .filter_map(|row| row.as_object().cloned())
            .map(|row| row.into_iter().map(|(k, v)| (k, literal::decode(v.as_str().unwrap_or_default()))).collect())
            .collect())
    }
}

fn transport_words(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "Your memory node took too long to answer.".into()
    } else if e.is_connect() {
        "Your memory node is not running, or can't be reached on this computer.".into()
    } else {
        "Your memory node could not be reached.".into()
    }
}

/// A node that answered with an error, as a sentence saying what kind: it refused the sign-in,
/// it is busy, or it rejected the request (with its own short words, never the request's).
pub fn refused_words(status: u16, said: &str) -> String {
    let said = said.trim();
    let its_words = if said.is_empty() { String::new() } else { format!(" It said: {said}") };
    match status {
        401 | 403 => format!("Your memory node refused Keeper's sign-in. Restart Keeper; if it keeps happening, the node's sign-in token has changed.{its_words}"),
        503 => format!("Your memory node is running but busy or still starting. Try again in a moment.{its_words}"),
        _ => format!("Your memory node answered with an error ({status}).{its_words}"),
    }
}
