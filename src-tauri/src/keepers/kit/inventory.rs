//! The person's kit on the DKG: souls and part variants they made or imported (the wardrobe's own
//! items, `wardrobe.rs`), each a Knowledge Asset (`desk:Soul`, `desk:KitItem`) in their own kit graph, with the item's validated
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

    /// The real node: a one-of-a-kind wardrobe item saved twice comes back once, as its newest
    /// version, re-validated into the wardrobe. `cargo test live_wardrobe -- --ignored`
    /// (writes only to `umoja-desk-livetest`).
    #[tokio::test]
    #[ignore]
    async fn live_wardrobe_item_versions_read_newest_first() {
        use crate::keepers::kit::{packs::Variant, parts::WornPart, wardrobe};
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = ensure(&client, "umoja-desk-livetest").await.unwrap();
        let stamp = time::now_iso();
        let id = format!("live-jacket-{}", short_hash(&stamp, 6));
        let jacket = |colour: &str| Variant {
            id: id.clone(),
            name: "Live Jacket".into(),
            worn: serde_json::from_value::<WornPart>(serde_json::json!({"part": "ark-jacket", "effects": {"color": colour}})).unwrap(),
            one_of_a_kind: true,
        };
        assert!(save_variant(&client, &graph, &jacket("#151c33")).await.unwrap().starts_with("did:dkg:"));
        tokio::time::sleep(std::time::Duration::from_millis(1100)).await; // the next second: a later version
        assert!(save_variant(&client, &graph, &jacket("#d39744")).await.unwrap().starts_with("did:dkg:"));
        let items = wardrobe::items(&variants(&client, &graph).await.unwrap());
        let mine: Vec<_> = items.iter().filter(|i| i.id == format!("kit:{id}")).collect();
        assert_eq!(mine.len(), 1, "one item per id");
        assert!(mine[0].one_of_a_kind && mine[0].slot == "torso");
        assert_eq!(mine[0].effects.get("color"), Some(&serde_json::json!("#d39744")), "the newest version wins");
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
        .text("desk:definition", &with_seq(serde_json::to_value(soul)?))
        .link(pred::BY, ASSISTANT)
        .time(pred::AT, &at)
        .build();
    Ok(client.write_asset(graph, &version_name("soul", &soul.id, &at), &quads).await?.ka_ual)
}

/// Save one of the person's modes (an edited built-in or their own), or with `removed` its
/// tombstone (a reset built-in or a deleted mode): each save is the id's next version.
pub async fn save_mode(client: &DkgClient, graph: &str, mode: &super::roles::Role, removed: bool) -> Result<String> {
    let at = time::now_iso();
    // Versions are ordered by this counter: timestamps have one-second steps, and an edit then a
    // reset within a second must still end reset.
    let record = if removed { serde_json::json!({ "id": mode.id, "removed": true }) } else { serde_json::to_value(mode)? };
    let definition = with_seq(record);
    let quads = AssetBuilder::new(&format!("urn:umoja:desk:mode:{}", mode.id))
        .a("desk:Mode")
        .text(pred::NAME, &mode.title)
        .text("desk:definition", &definition)
        .link(pred::BY, ASSISTANT)
        .time(pred::AT, &at)
        .build();
    Ok(client.write_asset(graph, &version_name("mode", &format!("{}-{}", mode.id, short_hash(&definition, 6)), &at), &quads).await?.ka_ual)
}

/// The person's modes, newest version per id; tombstones drop the id (back to Keeper's own).
pub async fn modes(client: &DkgClient, graph: &str, known_skills: &[&str]) -> Result<Vec<super::roles::Role>> {
    let mut out: Vec<super::roles::Role> = Vec::new();
    let records: Vec<serde_json::Value> = definitions(client, graph, "Mode").await?.iter().filter_map(|d| serde_json::from_str(d).ok()).collect();
    for v in records {
        let id = v["id"].as_str().unwrap_or_default().to_string();
        out.retain(|m| m.id != id);
        if v["removed"].as_bool() == Some(true) {
            continue;
        }
        if let Some(m) = serde_json::from_value::<super::roles::Role>(v).ok().and_then(|m| super::roles::sanitize(&m, known_skills).ok()) {
            out.push(m);
        }
    }
    Ok(out)
}

/// Save a wardrobe item (a part variant). A save of an existing id is its next version: the asset
/// name hashes the time AND the definition, so two different saves in one second never collide.
pub async fn save_variant(client: &DkgClient, graph: &str, variant: &Variant) -> Result<String> {
    let at = time::now_iso();
    let definition = with_seq(serde_json::to_value(variant)?);
    let quads = AssetBuilder::new(&format!("urn:umoja:desk:kit:{}", variant.id))
        .a("desk:KitItem")
        .text(pred::NAME, &variant.name)
        .text("desk:definition", &definition)
        .link(pred::BY, ASSISTANT)
        .time(pred::AT, &at)
        .build();
    Ok(client.write_asset(graph, &version_name("kit", &variant.id, &format!("{at}\u{0}{definition}")), &quads).await?.ka_ual)
}

/// A definition with its save counter (milliseconds): versions are ordered by it, because the
/// node's timestamps have one-second steps and two saves in one second must keep their order.
fn with_seq(mut record: serde_json::Value) -> String {
    record["seq"] = serde_json::json!(chrono::Utc::now().timestamp_millis());
    record.to_string()
}

async fn definitions(client: &DkgClient, graph: &str, class: &str) -> Result<Vec<String>> {
    // Newest first, so the limit drops old versions; returned oldest first so the newest wins.
    let sparql = format!("{PREFIXES}SELECT ?def ?at WHERE {{ ?s a desk:{class} ; desk:definition ?def ; prov:generatedAtTime ?at }} ORDER BY DESC(?at) LIMIT 300");
    let mut defs: Vec<String> = client.query(graph, &sparql, Layer::Working).await?.into_iter().filter_map(|r| r.get("def").cloned()).collect();
    defs.reverse();
    // Within the same second, the save counter decides (stable: older records without one keep
    // the node's order and come first).
    defs.sort_by_key(|d| serde_json::from_str::<serde_json::Value>(d).ok().and_then(|v| v["seq"].as_i64()).unwrap_or(0));
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
