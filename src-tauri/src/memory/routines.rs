//! Routines: a request the person wants to give again by name ("my Friday tidy"). One
//! `desk:Routine` asset per name in the keeper's graph: the name and the request's own words.
//! Running a routine gives the keeper those words again, so it goes through everything a
//! typed request does (the mode's tools, the plan to approve); a routine can never do more than
//! the person could ask for by typing it.

use serde::Serialize;

use crate::dkg::ontology::{entity, pred, ASSISTANT};
use crate::dkg::{AssetBuilder, Layer, Quad};
use crate::kernel::Result;

use super::records::Record;
use super::Memory;

const PREFIXES: &str = "PREFIX desk: <https://umojaark.com/ns/desk#> PREFIX schema: <http://schema.org/> PREFIX prov: <http://www.w3.org/ns/prov#> ";
/// The most routines a keeper lists.
pub const MOST: usize = 30;
const MAX_NAME: usize = 40;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Routine {
    pub id: String,
    pub name: String,
    pub request: String,
    pub at: String,
}

/// A routine's name as kept: letters, digits and single spaces, a sane length; None when
/// nothing usable is left.
pub fn clean_name(name: &str) -> Option<String> {
    let kept: String = name.chars().map(|c| if c.is_alphanumeric() || c == '\'' { c } else { ' ' }).collect();
    let name: String = kept.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(MAX_NAME).collect();
    (name.chars().filter(|c| c.is_alphanumeric()).count() >= 2).then_some(name)
}

/// The id a name takes: two spellings of one name ("Friday Tidy", "friday tidy") are one routine.
pub fn id_of(name: &str) -> String {
    name.to_lowercase().chars().map(|c| if c.is_alphanumeric() { c } else { '-' }).collect::<String>().split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-")
}

impl Routine {
    pub fn new(name: &str, request: &str, at: &str) -> Option<Routine> {
        let name = clean_name(name)?;
        let request = request.trim();
        (!request.is_empty()).then(|| Routine { id: id_of(&name), name, request: request.to_string(), at: at.to_string() })
    }
}

impl Record for Routine {
    fn asset_name(&self) -> String {
        format!("desk-routine-{}", self.id)
    }
    fn quads(&self) -> Vec<Quad> {
        AssetBuilder::new(&entity("routine", &self.id)).a("desk:Routine").text(pred::NAME, &self.name).text("desk:request", &self.request).link(pred::BY, ASSISTANT).time(pred::AT, &self.at).build()
    }
}

impl Memory {
    /// The keeper's routines, by name (one bounded query naming its class).
    pub async fn routines(&self) -> Result<Vec<Routine>> {
        let sparql = format!("{PREFIXES}SELECT ?r ?name ?request ?at WHERE {{ ?r a desk:Routine ; schema:name ?name ; desk:request ?request ; prov:generatedAtTime ?at }} ORDER BY ?name LIMIT {MOST}");
        let rows = self.client().query(self.graph(), &sparql, Layer::Working).await?;
        Ok(rows
            .iter()
            .filter_map(|r| {
                let name = r.get("name")?.clone();
                Some(Routine { id: id_of(&name), name, request: r.get("request")?.clone(), at: r.get("at").cloned().unwrap_or_default() })
            })
            .collect())
    }

    /// Save a routine under its name; one already kept under that name is replaced.
    pub async fn save_routine(&self, routine: &Routine) -> Result<()> {
        let _ = self.client().discard(self.graph(), &routine.asset_name()).await;
        self.client().write_asset(self.graph(), &routine.asset_name(), &routine.quads()).await?;
        Ok(())
    }

    /// Erase a routine from the graph.
    pub async fn forget_routine(&self, id: &str) -> Result<()> {
        self.client().discard(self.graph(), &format!("desk-routine-{id}")).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_routine_has_one_name_however_it_is_spelled() {
        let a = Routine::new("  Friday   Tidy! ", "Tidy my Downloads folder", "2026-11-26T10:00:00Z").unwrap();
        assert_eq!((a.name.as_str(), a.id.as_str(), a.asset_name().as_str()), ("Friday Tidy", "friday-tidy", "desk-routine-friday-tidy"));
        assert_eq!(id_of("friday tidy"), a.id);
        assert!(Routine::new("?", "x", "t").is_none(), "a name needs letters");
        assert!(Routine::new("Friday tidy", "   ", "t").is_none(), "and something to run");
        assert!(a.quads().iter().any(|q| q.predicate.ends_with("request")));
        assert_eq!(clean_name("../../etc").as_deref(), Some("etc"));
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::dkg::{node, DkgClient, Place};

    /// The real node: a routine is saved, replaced under the same name, listed and forgotten.
    /// `cargo test --lib live_routines -- --ignored --nocapture` (writes only to `umoja-desk-routinetest-*`).
    #[tokio::test]
    #[ignore]
    async fn live_routines_save_replace_list_and_forget() {
        let loc = node::locate(&dirs::home_dir().unwrap().join(".dkg")).expect("a DKG node in ~/.dkg");
        let client = DkgClient::new(&loc);
        let graph = format!("umoja-desk-routinetest-{}", chrono::Utc::now().timestamp_millis());
        client.ensure_graph(&graph, "routine test").await.unwrap();
        let memory = Memory::at(client, Place::from(graph.as_str()));
        memory.save_routine(&Routine::new("Friday tidy", "Tidy my Downloads folder", "2026-11-26T10:00:00Z").unwrap()).await.unwrap();
        memory.save_routine(&Routine::new("friday TIDY", "Tidy my Downloads and Desktop", "2026-11-26T11:00:00Z").unwrap()).await.unwrap();
        memory.save_routine(&Routine::new("Morning setup", "Open Notes and my calendar", "2026-11-26T11:00:00Z").unwrap()).await.unwrap();
        let list = memory.routines().await.unwrap();
        println!("{list:?}");
        assert_eq!(list.len(), 2, "the same name is one routine");
        assert_eq!(list.iter().find(|r| r.id == "friday-tidy").unwrap().request, "Tidy my Downloads and Desktop", "the later save replaced the first");
        assert_eq!(crate::fastlane::routines::expand(&memory, "run my Friday tidy").await.as_deref(), Some("Tidy my Downloads and Desktop"));
        assert_eq!(crate::fastlane::routines::expand(&memory, "run my tests").await, None, "no such routine: left as said");
        memory.forget_routine("friday-tidy").await.unwrap();
        assert_eq!(memory.routines().await.unwrap().len(), 1);
    }
}
