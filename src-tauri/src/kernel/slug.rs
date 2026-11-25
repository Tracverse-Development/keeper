//! Stable short hashes for names. A Knowledge Asset's name is derived from what it holds, so writing
//! the same record twice updates one asset instead of minting a duplicate (DKG reference §3).

use sha2::{Digest, Sha256};

/// The first `len` hex characters of SHA-256 over `input`.
pub fn short_hash(input: &str, len: usize) -> String {
    let digest = Sha256::digest(input.as_bytes());
    hex::encode(digest)[..len.min(64)].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_stable() {
        assert_eq!(short_hash("a", 8), short_hash("a", 8));
        assert_ne!(short_hash("a", 8), short_hash("b", 8));
    }
}
