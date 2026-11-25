//! The person's kit on the DKG: souls and part variants they made or imported, each a Knowledge
//! Asset (`desk:Soul`, `desk:KitItem`) in their own kit graph, with the item's validated
//! definition as a JSON literal plus its name for reading at a glance. Listing is a bounded query
//! per class (one asset each, LES-001); the definition is re-validated when read back.

use crate::dkg::ontology::{pred, ASSISTANT};
use crate::dkg::{AssetBuilder, DkgClient, Layer};
use crate::kernel::slug::short_hash;
use crate::kernel::{time, Result};

use super::packs::Variant;
use super::souls::{self, Soul};

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> ";

/// The kit graph's id: names no person, one per computer account.
pub fn graph_id() -> String {
    let home = dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default();
    format!("keeper-kit-{}", short_hash(&format!("{home}\u{0}{}", crate::platform::computer_name()), 10))
}

/// Create the kit graph `id` if needed (idempotent) and return its id.
pub async fn ensure(client: &DkgClient, id: &str) -> Result<String> {
    client.ensure_graph(id, "Keeper kit: souls and parts").await?;
    Ok(id.to_string())
}

/// The person's kit graph, created if needed.
pub async fn kit(client: &DkgClient) -> Result<String> {
    ensure(client, &graph_id()).await
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::node;
    use crate::keepers::kit::souls;

    /// The real node: a soul saved to a kit graph comes back from it, re-validated.
    /// `cargo test live_kit -- --ignored` (writes only to `keeper-kit-livetest`).
    #[tokio::test]
    #[ignore]
    async fn live_kit_soul_round_trip() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = ensure(&client, "keeper-kit-livetest").await.unwrap();
        let soul = souls::sanitize(&Soul { id: "test-vibes".into(), name: "Test Vibes".into(), summary: "Cheery tester".into(), catchphrases: vec!["Leh we go!".into()], ..Soul::default() }).unwrap();
        assert!(save_soul(&client, &graph, &soul).await.unwrap().starts_with("did:dkg:"));
        let back = souls(&client, &graph).await.unwrap();
        assert!(back.iter().any(|s| s.id == "test-vibes" && s.catchphrases == vec!["Leh we go!".to_string()]), "{back:?}");
    }
}

/// A finalized asset never changes (the node answers 409 to a second write under its name), so
/// every save is a new version named by its time; readers keep the newest per id (FIX-0005).
fn version_name(kind: &str, id: &str, at: &str) -> String {
    format!("desk-{kind}-{id}-{}", short_hash(at, 10))
}

pub async fn save_soul(client: &DkgClient, graph: &str, soul: &Soul) -> Result<String> {
    let at = time::now_iso();
    let quads = AssetBuilder::new(&format!("urn:umoja:desk:soul:{}", soul.id))
        .a("desk:Soul")
        .text(pred::NAME, &soul.name)
        .text("desk:definition", &serde_json::to_string(soul)?)
        .link(pred::BY, ASSISTANT)
        .time(pred::AT, &at)
        .build();
    Ok(client.write_asset(graph, &version_name("soul", &soul.id, &at), &quads).await?.ka_ual)
}

pub async fn save_variant(client: &DkgClient, graph: &str, variant: &Variant) -> Result<String> {
    let at = time::now_iso();
    let quads = AssetBuilder::new(&format!("urn:umoja:desk:kit:{}", variant.id))
        .a("desk:KitItem")
        .text(pred::NAME, &variant.name)
        .text("desk:definition", &serde_json::to_string(variant)?)
        .link(pred::BY, ASSISTANT)
        .time(pred::AT, &at)
        .build();
    Ok(client.write_asset(graph, &version_name("kit", &variant.id, &at), &quads).await?.ka_ual)
}

async fn definitions(client: &DkgClient, graph: &str, class: &str) -> Result<Vec<String>> {
    // Newest first, so the limit drops old versions; returned oldest first so the newest wins.
    let sparql = format!("{PREFIXES}SELECT ?def ?at WHERE {{ ?s a desk:{class} ; desk:definition ?def ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT 300");
    let mut defs: Vec<String> = client.query(graph, &sparql, Layer::Working).await?.into_iter().filter_map(|r| r.get("def").cloned()).collect();
    defs.reverse();
    Ok(defs)
}

/// The person's own souls (newest write per id wins; invalid ones are skipped).
pub async fn souls(client: &DkgClient, graph: &str) -> Result<Vec<Soul>> {
    let mut out: Vec<Soul> = Vec::new();
    for def in definitions(client, graph, "Soul").await? {
        if let Some(s) = serde_json::from_str::<Soul>(&def).ok().and_then(|s| souls::sanitize(&s).ok()) {
            out.retain(|o| o.id != s.id);
            out.push(s);
        }
    }
    Ok(out)
}

pub async fn variants(client: &DkgClient, graph: &str) -> Result<Vec<Variant>> {
    let mut out: Vec<Variant> = Vec::new();
    for def in definitions(client, graph, "KitItem").await? {
        if let Some(v) = serde_json::from_str::<Variant>(&def).ok() {
            out.retain(|o| o.id != v.id);
            out.push(v);
        }
    }
    Ok(out)
}
