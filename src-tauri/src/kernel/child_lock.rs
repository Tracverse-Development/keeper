//! The child profile's lock: a passcode a parent sets when turning the child profile on, and
//! must give to turn it off. Only a slow salted hash of it is kept in the settings file
//! (Argon2id), never the passcode.
//!
//! What the child profile changes lives where each thing is decided (the turn's context, the
//! touch replies, pack import, the settings command); `RULES` is what every mind is told.

use argon2::Argon2;

use super::{DeskError, Result};

/// The shortest passcode taken.
pub const MIN_PASSCODE: usize = 4;
const SALT: usize = 16;
const HASH: usize = 32;

/// Added to who the keeper is on every turn while the child profile is on.
pub const RULES: &str = "You are talking with a CHILD. Keep every answer suitable for a child: simple words, kind, patient, encouraging. \
Never give content about violence, sex, drugs, gambling, self-harm or anything frightening; never ask for or keep personal details such as \
an address, school, phone number or passwords; never suggest meeting or contacting strangers or buying anything. For questions about health, \
safety, money, or anything that worries them, answer gently and tell them to talk to a parent or another adult they trust.";

/// The name the lock is kept under in the private store (`kernel::secrets`).
const KEPT_AS: &str = "child-lock";

/// Is the child profile on? It is on exactly while a lock is kept: there is no separate switch
/// to flip in a settings file.
pub fn on() -> bool {
    super::secrets::get(KEPT_AS).is_some_and(|l| !l.is_empty())
}

/// Turn the child profile on with a new passcode, or off with the passcode that set it.
pub fn set(turn_on: bool, passcode: &str) -> Result<()> {
    match (turn_on, super::secrets::get(KEPT_AS).filter(|l| !l.is_empty())) {
        (true, Some(_)) => Err(DeskError::Invalid("The child profile is already on.".into())),
        (true, None) => super::secrets::set(KEPT_AS, &lock(passcode)?),
        (false, None) => Ok(()),
        (false, Some(kept)) if opens(&kept, passcode) => super::secrets::set(KEPT_AS, ""),
        (false, Some(_)) => Err(DeskError::Invalid("That isn't the passcode.".into())),
    }
}

fn hash(passcode: &str, salt: &[u8]) -> Result<[u8; HASH]> {
    let mut out = [0u8; HASH];
    Argon2::default().hash_password_into(passcode.as_bytes(), salt, &mut out).map_err(|_| DeskError::Io("I couldn't set the passcode.".into()))?;
    Ok(out)
}

/// The lock to keep for `passcode`: `<salt hex>:<hash hex>`.
pub fn lock(passcode: &str) -> Result<String> {
    if passcode.chars().count() < MIN_PASSCODE {
        return Err(DeskError::Invalid(format!("Use a passcode of at least {MIN_PASSCODE} characters.")));
    }
    let mut salt = [0u8; SALT];
    getrandom::getrandom(&mut salt).map_err(|_| DeskError::Io("This computer gave no random numbers.".into()))?;
    Ok(format!("{}:{}", hex::encode(salt), hex::encode(hash(passcode, &salt)?)))
}

/// Does `passcode` open `lock`? A lock that cannot be read opens for nothing.
pub fn opens(lock: &str, passcode: &str) -> bool {
    let Some((salt, kept)) = lock.split_once(':') else { return false };
    let (Ok(salt), Ok(kept)) = (hex::decode(salt), hex::decode(kept)) else { return false };
    let Ok(now) = hash(passcode, &salt) else { return false };
    // Every byte is compared, whatever the first difference.
    kept.len() == HASH && kept.iter().zip(now.iter()).fold(0u8, |diff, (a, b)| diff | (a ^ b)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_passcode_that_set_the_lock_opens_it() {
        let kept = lock("mango7").unwrap();
        assert!(opens(&kept, "mango7"));
        assert!(!opens(&kept, "mango8") && !opens(&kept, ""));
        assert!(!kept.contains("mango7"), "the passcode itself is never kept");
        assert_ne!(kept, lock("mango7").unwrap(), "a fresh salt each time");
        assert!(lock("abc").is_err(), "too short");
        assert!(!opens("", "mango7") && !opens("zz:zz", "mango7") && !opens("00:00", "mango7"));
    }
}
