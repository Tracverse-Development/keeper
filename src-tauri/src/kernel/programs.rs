//! Finding command-line programs (node, npm, dkg, claude, codex, gemini, hermes) the same way on
//! every OS: the PATH split with the OS's own separator, the usual install folders, and on
//! Windows the PATHEXT extensions (`claude.cmd`, `node.exe`). One implementation for the DKG node
//! installer and the agent engines (it used to be two copies that only understood macOS).

use std::ffi::OsString;
use std::path::PathBuf;

/// The folders a GUI app does not inherit on PATH but where CLIs usually live.
fn usual_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        for sub in [".local/bin", ".npm-global/bin", ".bun/bin", ".cargo/bin"] {
            dirs.push(home.join(sub));
        }
        #[cfg(windows)]
        if let Some(data) = dirs::data_dir() {
            dirs.push(data.join("npm"));
        }
    }
    #[cfg(not(windows))]
    dirs.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].map(PathBuf::from));
    #[cfg(target_os = "macos")]
    dirs.push(PathBuf::from("/Applications/Foreman.app/Contents/Resources/node/bin"));
    dirs
}

/// Every folder to search: PATH first, then the usual ones.
pub fn search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    for d in usual_dirs() {
        if !dirs.contains(&d) {
            dirs.push(d);
        }
    }
    dirs
}

/// The file names a program may have here (`claude`, or on Windows also `claude.cmd`, `claude.exe`, …).
fn candidates(name: &str) -> Vec<String> {
    let mut names = vec![name.to_string()];
    if cfg!(windows) {
        let exts = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into());
        names.extend(exts.split(';').filter(|e| !e.is_empty()).map(|e| format!("{name}{}", e.to_lowercase())));
    }
    names
}

/// The program's full path, or None when it is not installed.
pub fn find(name: &str) -> Option<PathBuf> {
    let names = candidates(name);
    search_dirs().into_iter().find_map(|d| names.iter().map(|n| d.join(n)).find(|p| p.is_file()))
}

/// PATH for a child process: `first` (when given), then every search folder.
pub fn child_path(first: Option<&std::path::Path>) -> OsString {
    let mut dirs = search_dirs();
    if let Some(f) = first {
        dirs.insert(0, f.to_path_buf());
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    #[test]
    fn finds_a_system_program_and_misses_a_fake_one() {
        let shell = if cfg!(windows) { "cmd" } else { "sh" };
        assert!(super::find(shell).is_some());
        assert!(super::find("definitely-not-a-program-xyz").is_none());
        assert!(!super::child_path(None).is_empty());
    }
}
