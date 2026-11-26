//! Signed packs: every pack this computer shares is signed with this person's own key (Ed25519,
//! made on first use, kept in Keeper's private store), so a person receiving it can tell it is
//! unchanged and whether it comes from the same maker as packs they had before. Keeper remembers
//! which key each maker's packs were signed with (trust on first use) and warns when a pack names
//! a maker it knows but is signed by a different key.
//!
//! What is signed: the whole pack as compact JSON with its keys sorted, without the `signature`
//! field itself. A pack that says it is signed but does not check out is refused.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::Serialize;
use serde_json::Value;

use crate::kernel::{secrets, DeskError, Result};

/// The name the signing key is kept under in the private store.
const KEY_NAME: &str = "pack-signing-key";

/// This person's signing key, made the first time a pack is shared.
fn own_key() -> Result<SigningKey> {
    if let Some(bytes) = secrets::get(KEY_NAME).and_then(|h| hex::decode(h).ok()).and_then(|b| <[u8; 32]>::try_from(b).ok()) {
        return Ok(SigningKey::from_bytes(&bytes));
    }
    let mut seed = [0u8; 32];
    getrandom::getrandom(&mut seed).map_err(|_| DeskError::Io("This computer gave no random numbers.".into()))?;
    secrets::set(KEY_NAME, &hex::encode(seed))?;
    Ok(SigningKey::from_bytes(&seed))
}

/// The bytes a signature covers: the pack without its `signature`, compact, keys sorted.
fn signed_bytes(pack: &Value) -> Vec<u8> {
    let mut copy = pack.clone();
    if let Some(object) = copy.as_object_mut() {
        object.remove("signature");
    }
    // serde_json's map keeps keys sorted (no preserve_order feature), so this is canonical.
    serde_json::to_vec(&copy).unwrap_or_default()
}

/// A short, readable form of a key for people to compare ("3f9a 21c0").
pub fn fingerprint(key_hex: &str) -> String {
    let k: String = key_hex.chars().take(8).collect();
    format!("{} {}", &k[..k.len().min(4)], k.get(4..).unwrap_or(""))
}

/// Sign a pack (as JSON) with this person's key: adds `signature: {key, sig}`.
pub fn sign(pack: &mut Value) -> Result<()> {
    let key = own_key()?;
    let sig = key.sign(&signed_bytes(pack));
    if let Some(object) = pack.as_object_mut() {
        object.insert("signature".into(), serde_json::json!({ "key": hex::encode(key.verifying_key().to_bytes()), "sig": hex::encode(sig.to_bytes()) }));
    }
    Ok(())
}

/// What a pack's signature says.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Check {
    /// No signature (made before packs were signed, or by hand).
    Unsigned,
    /// Signed and unchanged since; `key` is the full key, `fingerprint` its short form.
    Valid { key: String, fingerprint: String },
    /// Says it is signed, but the signature does not match: changed since, or forged.
    Broken,
}

/// Check a pack's signature (the pack as text).
pub fn check(text: &str) -> Check {
    let Ok(pack) = serde_json::from_str::<Value>(text) else { return Check::Unsigned };
    let Some(signature) = pack.get("signature") else { return Check::Unsigned };
    let parts = (signature["key"].as_str().and_then(|k| hex::decode(k).ok()), signature["sig"].as_str().and_then(|s| hex::decode(s).ok()));
    let (Some(key_bytes), Some(sig_bytes)) = parts else { return Check::Broken };
    let (Ok(key_arr), Ok(sig_arr)) = (<[u8; 32]>::try_from(key_bytes.as_slice()), <[u8; 64]>::try_from(sig_bytes.as_slice())) else { return Check::Broken };
    let Ok(key) = VerifyingKey::from_bytes(&key_arr) else { return Check::Broken };
    match key.verify(&signed_bytes(&pack), &Signature::from_bytes(&sig_arr)) {
        Ok(()) => {
            let hex_key = hex::encode(key_arr);
            Check::Valid { fingerprint: fingerprint(&hex_key), key: hex_key }
        }
        Err(_) => Check::Broken,
    }
}

/// What a person is told about a pack's origin before adding it.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trust {
    pub signature: Check,
    /// The maker's name the pack gives (a label), if any.
    pub maker: Option<String>,
    /// This key signed a pack the person added before.
    pub seen_before: bool,
    /// The pack names a maker whose earlier packs were signed by a DIFFERENT key.
    pub other_key_for_name: bool,
}

/// Judge a pack against the keys already known (`known`: key hex → maker name).
pub fn trust(text: &str, known: &std::collections::BTreeMap<String, String>) -> Trust {
    let signature = check(text);
    let maker = super::packs::maker_of(text).map(|m| m.name);
    let (seen_before, other_key_for_name) = match (&signature, &maker) {
        (Check::Valid { key, .. }, name) => {
            let seen = known.contains_key(key);
            let clash = name.as_ref().is_some_and(|n| known.iter().any(|(k, v)| k != key && v.eq_ignore_ascii_case(n)));
            (seen, clash)
        }
        (_, Some(n)) => (false, known.values().any(|v| v.eq_ignore_ascii_case(n))),
        _ => (false, false),
    };
    Trust { signature, maker, seen_before, other_key_for_name }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signed_with(seed: [u8; 32], pack: &mut Value) {
        let key = SigningKey::from_bytes(&seed);
        let sig = key.sign(&signed_bytes(pack));
        pack.as_object_mut().unwrap().insert("signature".into(), serde_json::json!({ "key": hex::encode(key.verifying_key().to_bytes()), "sig": hex::encode(sig.to_bytes()) }));
    }

    #[test]
    fn a_signed_pack_checks_out_and_any_change_breaks_it() {
        let mut pack = serde_json::json!({ "kind": "soul", "format": "keeper-pack/1", "soul": { "name": "Calm" }, "maker": { "name": "Amos" } });
        signed_with([7u8; 32], &mut pack);
        let text = serde_json::to_string_pretty(&pack).unwrap();
        assert!(matches!(check(&text), Check::Valid { .. }), "pretty-printed, still valid");
        let changed = text.replace("Calm", "Evil");
        assert_eq!(check(&changed), Check::Broken, "the content changed");
        let renamed = text.replace("Amos", "Someone else");
        assert_eq!(check(&renamed), Check::Broken, "the maker's name is signed too");
        assert_eq!(check(r#"{"kind":"soul"}"#), Check::Unsigned);
        assert_eq!(check(r#"{"kind":"soul","signature":{"key":"zz","sig":"00"}}"#), Check::Broken);
    }

    #[test]
    fn a_known_makers_name_on_another_key_is_flagged() {
        let mut pack = serde_json::json!({ "kind": "soul", "format": "keeper-pack/1", "soul": { "name": "Calm" }, "maker": { "name": "Amos" } });
        signed_with([3u8; 32], &mut pack);
        let text = pack.to_string();
        let Check::Valid { key, .. } = check(&text) else { panic!() };
        let mut known = std::collections::BTreeMap::new();
        let first = trust(&text, &known);
        assert!(!first.seen_before && !first.other_key_for_name && first.maker.as_deref() == Some("Amos"));
        known.insert(key.clone(), "Amos".to_string());
        assert!(trust(&text, &known).seen_before, "the same maker's key, seen before");
        let mut imposter = serde_json::json!({ "kind": "soul", "format": "keeper-pack/1", "soul": { "name": "Calm" }, "maker": { "name": "amos" } });
        signed_with([4u8; 32], &mut imposter);
        let t = trust(&imposter.to_string(), &known);
        assert!(t.other_key_for_name && !t.seen_before, "Amos's name, someone else's key");
        let unsigned = r#"{"kind":"soul","maker":{"name":"Amos"}}"#;
        assert!(trust(unsigned, &known).other_key_for_name, "an unsigned pack using a known maker's name is flagged too");
    }

    #[test]
    fn two_keys_have_different_fingerprints() {
        let (mut a, mut b) = (serde_json::json!({ "x": 1 }), serde_json::json!({ "x": 1 }));
        signed_with([1u8; 32], &mut a);
        signed_with([2u8; 32], &mut b);
        let fp = |v: &Value| match check(&v.to_string()) {
            Check::Valid { fingerprint, .. } => fingerprint,
            other => panic!("{other:?}"),
        };
        assert_ne!(fp(&a), fp(&b));
        assert_eq!(fp(&a).len(), 9, "two groups of four");
    }
}
