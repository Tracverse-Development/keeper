//! Warm spares (Object Pool): an engine process started BEFORE the person speaks, waiting for its
//! message on stdin, so a turn skips the program's start-up (Claude Code: 4.7 s cold, 0.93 s warm,
//! measured 2026-11-25). One spare per exact command line (`key`): a turn takes it if it is
//! fresh and alive, and a new spare is started at once for the next turn. A spare older than
//! `MAX_AGE` is retired (its sign-in or settings may have moved on).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tokio::process::Child;

use super::cli;

const MAX_AGE: Duration = Duration::from_secs(20 * 60);

struct Spare {
    child: Child,
    born: Instant,
}

static POOL: Mutex<Option<HashMap<String, Spare>>> = Mutex::new(None);

/// The pool key: the program, its working folder and every argument.
pub fn key(program: &Path, cwd: &Path, args: &[String]) -> String {
    let mut k = format!("{}\u{0}{}", program.display(), cwd.display());
    for a in args {
        k.push('\u{0}');
        k.push_str(a);
    }
    crate::kernel::slug::short_hash(&k, 16)
}

fn alive(spare: &mut Spare) -> bool {
    spare.born.elapsed() < MAX_AGE && matches!(spare.child.try_wait(), Ok(None))
}

/// A ready process for this command line, if one is waiting.
pub fn take(key: &str) -> Option<Child> {
    let mut pool = POOL.lock().ok()?;
    let mut spare = pool.get_or_insert_with(HashMap::new).remove(key)?;
    alive(&mut spare).then_some(spare.child)
}

/// Start a spare for this command line unless a live one is already waiting.
pub fn fill(key: String, program: PathBuf, cwd: PathBuf, args: Vec<String>) {
    let Ok(mut pool) = POOL.lock() else { return };
    let pool = pool.get_or_insert_with(HashMap::new);
    if pool.get_mut(&key).is_some_and(alive) {
        return;
    }
    if let Ok(child) = cli::spawn(&program, &args, &cwd, true) {
        pool.insert(key, Spare { child, born: Instant::now() });
    }
}

/// How many spares are waiting (for the speed panel and tests).
pub fn waiting() -> usize {
    let Ok(mut pool) = POOL.lock() else { return 0 };
    pool.as_mut().map(|m| m.values_mut().map(alive).filter(|&live| live).count()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_key_follows_every_argument() {
        let (p, c) = (std::path::Path::new("/bin/claude"), std::path::Path::new("/tmp"));
        let a = super::key(p, c, &["--model".into(), "haiku".into()]);
        assert_eq!(a, super::key(p, c, &["--model".into(), "haiku".into()]));
        assert_ne!(a, super::key(p, c, &["--model".into(), "sonnet".into()]));
    }
}
