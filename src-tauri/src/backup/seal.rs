//! Sealing a backup with the person's passphrase: Argon2id turns the passphrase into a key
//! (slow on purpose, with a fresh random salt), XChaCha20-Poly1305 encrypts and authenticates.
//! A wrong passphrase, a changed byte or a file that is not a backup all fail the same way:
//! nothing is ever half-read.
//!
//! File layout: `KEEPERBAK1` (10 bytes) · salt (16) · nonce (24) · ciphertext with its tag.

use argon2::Argon2;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};

use crate::kernel::{DeskError, Result};

const MAGIC: &[u8; 10] = b"KEEPERBAK1";
const SALT: usize = 16;
const NONCE: usize = 24;
/// The shortest passphrase taken: a backup holds everything a keeper knows.
pub const MIN_PASSPHRASE: usize = 8;

fn refused() -> DeskError {
    DeskError::Invalid("That passphrase doesn't open this backup, or the file isn't a Keeper backup.".into())
}

pub fn check_passphrase(passphrase: &str) -> Result<()> {
    if passphrase.chars().count() < MIN_PASSPHRASE {
        return Err(DeskError::Invalid(format!("Use a passphrase of at least {MIN_PASSPHRASE} characters.")));
    }
    Ok(())
}

fn key(passphrase: &str, salt: &[u8]) -> Result<Key> {
    let mut key = Key::default();
    Argon2::default().hash_password_into(passphrase.as_bytes(), salt, &mut key).map_err(|_| DeskError::Io("I couldn't prepare the key.".into()))?;
    Ok(key)
}

fn random<const N: usize>() -> Result<[u8; N]> {
    let mut bytes = [0u8; N];
    getrandom::getrandom(&mut bytes).map_err(|_| DeskError::Io("This computer gave no random numbers.".into()))?;
    Ok(bytes)
}

/// Encrypt `plain` under `passphrase`.
pub fn seal(passphrase: &str, plain: &[u8]) -> Result<Vec<u8>> {
    check_passphrase(passphrase)?;
    let (salt, nonce) = (random::<SALT>()?, random::<NONCE>()?);
    let cipher = XChaCha20Poly1305::new(&key(passphrase, &salt)?);
    let sealed = cipher.encrypt(XNonce::from_slice(&nonce), plain).map_err(|_| DeskError::Io("I couldn't seal the backup.".into()))?;
    Ok([MAGIC.as_slice(), &salt, &nonce, &sealed].concat())
}

/// Decrypt a sealed backup; any failure reads the same (no hint which part was wrong).
pub fn open(passphrase: &str, sealed: &[u8]) -> Result<Vec<u8>> {
    let body = sealed.strip_prefix(MAGIC.as_slice()).filter(|b| b.len() > SALT + NONCE).ok_or_else(refused)?;
    let (salt, rest) = body.split_at(SALT);
    let (nonce, cipher_text) = rest.split_at(NONCE);
    let cipher = XChaCha20Poly1305::new(&key(passphrase, salt)?);
    cipher.decrypt(XNonce::from_slice(nonce), cipher_text).map_err(|_| refused())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_backup_opens_only_with_its_passphrase_and_only_unchanged() {
        let sealed = seal("correct horse battery", b"everything a keeper knows").unwrap();
        assert_eq!(open("correct horse battery", &sealed).unwrap(), b"everything a keeper knows");
        assert!(open("correct horse batterx", &sealed).is_err(), "a wrong passphrase");
        let mut changed = sealed.clone();
        *changed.last_mut().unwrap() ^= 1;
        assert!(open("correct horse battery", &changed).is_err(), "one changed byte");
        assert!(open("correct horse battery", b"not a backup at all").is_err());
        assert!(open("correct horse battery", &sealed[..20]).is_err(), "a cut-off file");
    }

    #[test]
    fn the_file_shows_nothing_of_its_content_and_no_two_are_alike() {
        let (a, b) = (seal("a long passphrase", b"Your sister is Maya").unwrap(), seal("a long passphrase", b"Your sister is Maya").unwrap());
        assert_ne!(a, b, "a fresh salt and nonce every time");
        assert!(!a.windows(4).any(|w| w == b"Maya"));
        assert!(seal("short", b"x").is_err(), "a short passphrase is refused");
    }
}
