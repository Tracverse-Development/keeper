//! One error type for the whole core. Commands hand it to the window as plain text:
//! a sentence a person can read, never a stack trace or a token.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum DeskError {
    /// The DKG node could not be reached or refused the request.
    #[error("The memory node did not answer: {0}")]
    Node(String),
    /// A brain (Ollama, Hermes) failed or answered something unusable.
    #[error("The assistant's mind did not answer: {0}")]
    Brain(String),
    /// Input that failed validation at the boundary.
    #[error("{0}")]
    Invalid(String),
    /// A local file or process problem.
    #[error("{0}")]
    Io(String),
}

pub type Result<T> = std::result::Result<T, DeskError>;

impl From<std::io::Error> for DeskError {
    fn from(e: std::io::Error) -> Self {
        DeskError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for DeskError {
    fn from(e: serde_json::Error) -> Self {
        DeskError::Io(format!("bad data: {e}"))
    }
}

impl Serialize for DeskError {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}
