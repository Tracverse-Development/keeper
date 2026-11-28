//! The DKG seam: every call to the OriginTrail DKG V10 node goes through this module.
//!
//! - `node`     finds, installs and starts the node (its home folder, port and token)
//! - `client`   the node's HTTP API: context graphs, Knowledge Assets, SPARQL by memory layer
//! - `quads`    the Builder that turns a record into RDF quads
//! - `literal`  RDF literal encoding and decoding (the node's binding format)
//! - `ontology` the vocabulary Keeper writes (`desk:` on top of schema.org and PROV-O)

pub mod client;
pub mod literal;
pub mod node;
pub mod node_repair;
pub mod own_node;
pub mod place;
pub mod runtime;
pub mod ontology;
pub mod quads;

pub use client::{DkgClient, Layer, Row};
pub use place::Place;
pub use quads::{AssetBuilder, Quad};
