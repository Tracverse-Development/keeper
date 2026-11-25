//! The DKG seam: every call to the OriginTrail DKG V10 node goes through this module.
//!
//! - `node`     finds, installs and starts the node (its home folder, port and token)
//! - `client`   the node's HTTP API: context graphs, Knowledge Assets, SPARQL by memory layer
//! - `quads`    the Builder that turns a record into RDF quads
//! - `literal`  RDF literal encoding and decoding (the node's binding format)
//! - `ontology` the vocabulary Umoja Desk writes (`desk:` on top of schema.org and PROV-O)

pub mod client;
pub mod literal;
pub mod node;
pub mod ontology;
pub mod quads;

pub use client::{DkgClient, Layer, Row};
pub use quads::{AssetBuilder, Quad};
