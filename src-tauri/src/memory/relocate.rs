//! Moving a keeper's memory into its sub-graph of the ONE home context graph (and the kit into
//! `kit`): docs/design/keeper-memory-graph.md.
//!
//! Exact and fail-safe:
//! - every live asset is listed from the node's own `_meta` records (name and data graph), so
//!   each one is copied under the SAME name (erasure goes by name) with its triples as written;
//! - names already in the target are skipped, so a move that stopped runs again cleanly;
//! - `verified` only when every listed name is in the target afterwards;
//! - the originals are left where they were (a backup); erasure removes both copies (`Memory`'s
//!   legacy place) until a separate, confirmed clean-up removes the originals.

use std::collections::HashSet;

use crate::dkg::{DkgClient, Layer, Place, Quad};
use crate::kernel::Result;

const DKG: &str = "http://dkg.io/ontology/";
/// Far above any keeper's asset count; a graph with more is moved over several starts.
const MAX_ASSETS: usize = 20_000;

/// What a move did.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct MoveReport {
    pub listed: usize,
    pub copied: usize,
    pub already: usize,
    pub failed: usize,
    /// Every listed asset is in the target now.
    pub verified: bool,
}

/// The node's `_meta` graph: one per context graph, listing its sub-graphs' assets too.
fn meta_graph(place: &Place) -> String {
    format!("did:dkg:context-graph:{}/_meta", place.graph)
}

/// Where a place's Working Memory data graphs start: the graph's own, or its sub-graph's.
fn data_prefix(place: &Place) -> String {
    match &place.sub {
        Some(sub) => format!("did:dkg:context-graph:{}/{sub}/_working_memory/", place.graph),
        None => format!("did:dkg:context-graph:{}/_working_memory/", place.graph),
    }
}

/// Live Working Memory assets at a place: (name, data graph).
async fn assets(client: &DkgClient, place: &Place) -> Result<Vec<(String, String)>> {
    let sparql = format!(
        "SELECT ?name ?ag WHERE {{ GRAPH <{meta}> {{ ?a <{DKG}assertionName> ?name ; <{DKG}assertionGraph> ?ag ; <{DKG}memoryLayer> \"WM\" . }} }} LIMIT {MAX_ASSETS}",
        meta = meta_graph(place)
    );
    let rows = client.query_terms(Place::from(place.graph.as_str()), &sparql, None).await?;
    let prefix = data_prefix(place);
    Ok(rows.into_iter().filter_map(|r| Some((unquote(r.get("name")?), r.get("ag")?.clone()))).filter(|(n, g)| !n.is_empty() && g.starts_with(&prefix)).collect())
}

/// `"desk-fact-1"` (a plain literal as bound) -> `desk-fact-1`.
fn unquote(term: &str) -> String {
    term.strip_prefix('"').and_then(|t| t.split('"').next()).unwrap_or(term).to_string()
}

/// One asset's triples, exactly as written.
async fn triples(client: &DkgClient, graph: &str, data_graph: &str) -> Result<Vec<Quad>> {
    let sparql = format!("SELECT ?s ?p ?o WHERE {{ GRAPH <{data_graph}> {{ ?s ?p ?o }} }} LIMIT 5000");
    let rows = client.query_terms(Place::from(graph), &sparql, Some(Layer::Working)).await?;
    Ok(rows.into_iter().filter_map(|r| Some(Quad { subject: r.get("s")?.clone(), predicate: r.get("p")?.clone(), object: r.get("o")?.clone() })).collect())
}

/// Copy every live asset at `from` into `to` (a sub-graph, created if needed).
pub async fn move_assets(client: &DkgClient, from: &Place, to: &Place) -> Result<MoveReport> {
    if let Some(sub) = &to.sub {
        client.ensure_sub_graph(&to.graph, sub).await?;
    }
    // A source graph the node never had holds nothing: moved, trivially.
    if from.sub.is_none() && !client.has_graph(&from.graph).await? {
        return Ok(MoveReport { verified: true, ..MoveReport::default() });
    }
    let listed = assets(client, from).await?;
    let mut have: HashSet<String> = assets(client, to).await?.into_iter().map(|(n, _)| n).collect();
    let mut report = MoveReport { listed: listed.len(), ..MoveReport::default() };
    for (name, data_graph) in &listed {
        if have.contains(name) {
            report.already += 1;
            continue;
        }
        let quads = match triples(client, &from.graph, data_graph).await {
            Ok(q) if !q.is_empty() => q,
            _ => {
                report.failed += 1;
                continue;
            }
        };
        match client.write_asset(to, name, &quads).await {
            Ok(_) | Err(crate::kernel::DeskError::Exists(_)) => {
                report.copied += 1;
                have.insert(name.clone());
            }
            Err(_) => report.failed += 1,
        }
    }
    let now: HashSet<String> = assets(client, to).await?.into_iter().map(|(n, _)| n).collect();
    report.verified = report.failed == 0 && listed.iter().all(|(n, _)| now.contains(n));
    Ok(report)
}

/// On start: each keeper not yet in its sub-graph moves there, then the kit moves into `kit`.
/// Each switches only after a VERIFIED move; a second pass then copies anything written in
/// between. A move that fails or does not verify changes nothing and runs again next start.
/// The local log keeps the counts (never content).
pub async fn settle(state: &crate::state::AppState) {
    let Ok(client) = state.client() else { return };
    let home = crate::keepers::graph_id_for("", true);
    if client.ensure_graph(&home, "Keeper: your keepers' memory and kit").await.is_err() {
        return;
    }
    for keeper in state.settings().keepers {
        if keeper.memory_sub.is_some() {
            continue;
        }
        let sub = keeper_sub(&keeper.id);
        let (from, to) = (Place::from(keeper.graph_id.as_str()), Place::new(&home, Some(&sub)));
        let started = std::time::Instant::now();
        match move_assets(&client, &from, &to).await {
            Ok(report) if report.verified => {
                eprintln!("[memory] moved {} in {} ms: {report:?}", keeper.id, started.elapsed().as_millis());
                let (id, old) = (keeper.id.clone(), keeper.graph_id.clone());
                let _ = state.update_settings(|s| {
                    if let Some(k) = s.keeper_mut(&id) {
                        k.graph_id = home.clone();
                        k.memory_sub = Some(sub.clone());
                        k.legacy_graph = Some(old);
                    }
                });
                let _ = move_assets(&client, &from, &to).await;
            }
            Ok(report) => eprintln!("[memory] not moved yet {} (will retry): {report:?}", keeper.id),
            Err(e) => eprintln!("[memory] not moved yet {} (will retry): {e}", keeper.id),
        }
    }
    if !state.settings().kit_moved {
        let from = Place::from(crate::keepers::kit::inventory::graph_id().as_str());
        let to = Place::new(&home, Some(crate::keepers::kit::inventory::KIT_SUB));
        match move_assets(&client, &from, &to).await {
            Ok(report) if report.verified => {
                eprintln!("[memory] moved the kit: {report:?}");
                let _ = state.update_settings(|s| s.kit_moved = true);
                let _ = move_assets(&client, &from, &to).await;
            }
            Ok(report) => eprintln!("[memory] kit not moved yet (will retry): {report:?}"),
            Err(e) => eprintln!("[memory] kit not moved yet (will retry): {e}"),
        }
    }
}

/// The sub-graph a keeper's memory lives in (its id: letters, digits, dashes).
pub fn keeper_sub(keeper_id: &str) -> String {
    let id: String = keeper_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-').take(40).collect();
    if id.is_empty() { "keeper".into() } else { id }
}

#[cfg(test)]
mod tests {
    use crate::dkg::Place;

    #[test]
    fn meta_graphs_and_names() {
        assert_eq!(super::meta_graph(&Place::new("g", Some("keeper-1"))), "did:dkg:context-graph:g/_meta");
        assert_eq!(super::data_prefix(&Place::new("g", None)), "did:dkg:context-graph:g/_working_memory/");
        assert_eq!(super::data_prefix(&Place::new("g", Some("keeper-1"))), "did:dkg:context-graph:g/keeper-1/_working_memory/");
        assert_eq!(super::unquote("\"desk-fact-1\""), "desk-fact-1");
        assert_eq!(super::keeper_sub("keeper-1"), "keeper-1");
        assert_eq!(super::keeper_sub("../x y"), "xy");
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::node;

    /// The real node: a graph's records move into a sub-graph of another graph, names intact,
    /// and a second move copies nothing. `cargo test live_relocate -- --ignored`
    /// (writes only to `umoja-desk-movetest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_relocate_moves_every_record_once() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let stamp = chrono::Utc::now().timestamp_millis();
        let (src, home) = (format!("umoja-desk-movetest-src-{stamp}"), format!("umoja-desk-movetest-home-{stamp}"));
        client.ensure_graph(&src, "move test source").await.unwrap();
        client.ensure_graph(&home, "move test home").await.unwrap();
        for i in 0..3 {
            let quads = crate::dkg::AssetBuilder::new(&format!("urn:umoja:desk:fact:mv{i}")).a("https://umojaark.com/ns/desk#Fact").text("https://umojaark.com/ns/desk#text", &format!("fact {i}")).build();
            client.write_asset(src.as_str(), &format!("desk-fact-mv{i}"), &quads).await.unwrap();
        }
        let to = Place::new(&home, Some("keeper-1"));
        let first = move_assets(&client, &Place::from(src.as_str()), &to).await.unwrap();
        assert_eq!((first.listed, first.copied, first.verified), (3, 3, true), "{first:?}");
        let again = move_assets(&client, &Place::from(src.as_str()), &to).await.unwrap();
        assert_eq!((again.copied, again.already, again.verified), (0, 3, true), "{again:?}");
        let rows = client.query(&to, "SELECT ?t WHERE { ?s <https://umojaark.com/ns/desk#text> ?t } LIMIT 10", Layer::Working).await.unwrap();
        assert_eq!(rows.len(), 3, "readable in the sub-graph");
        client.discard(&to, "desk-fact-mv0").await.unwrap();
        let rows = client.query(&to, "SELECT ?t WHERE { ?s <https://umojaark.com/ns/desk#text> ?t } LIMIT 10", Layer::Working).await.unwrap();
        assert_eq!(rows.len(), 2, "erasable by its original name");
    }
}
