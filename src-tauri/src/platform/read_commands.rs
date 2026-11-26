//! Which shell commands only READ the machine (macOS): the vocabulary the plan guard
//! (`brain::guard`) uses to let a keeper look without asking. A tool here never changes anything
//! in the forms allowed: report tools are allowed only with their reading sub-commands. OS tool
//! names live in `platform/` (structure.test.ts: only platform names an OS tool).

pub const READ_COMMANDS: [&str; 32] = ["ls", "cat", "head", "tail", "find", "grep", "rg", "wc", "file", "stat", "mdfind", "pwd", "cd", "echo", "sort", "uniq", "du", "df", "date", "mdls", "ps", "pgrep", "lsof", "uptime", "whoami", "which", "sw_vers", "uname", "system_profiler", "basename", "dirname", "realpath"];

/// Tools that read only with certain sub-commands ("diskutil info" reads; "diskutil erase" does not).
pub const READ_SUBCOMMANDS: &[(&str, &[&str])] = &[
    ("diskutil", &["list", "info", "apfs"]),
    ("defaults", &["read", "domains"]),
    ("launchctl", &["list", "print"]),
    ("networksetup", &["-listallnetworkservices", "-getinfo", "-getairportnetwork", "-listallhardwareports"]),
    ("scutil", &["--get", "--dns", "--proxy"]),
];

/// Commands that only report on the machine (no arguments can make them change it).
pub const REPORT_COMMANDS: [&str; 6] = ["sysctl", "vm_stat", "memory_pressure", "ioreg", "pmset", "top"];

/// One piece of a shell chain that only reads.
pub fn piece_reads(piece: &str) -> bool {
    let mut w = piece.split(|c: char| c.is_whitespace() || "\"'`;|&()<>=,".contains(c)).filter(|w| !w.is_empty());
    let Some(first) = w.next() else { return true };
    if READ_COMMANDS.contains(&first) {
        return true;
    }
    if let Some((_, subs)) = READ_SUBCOMMANDS.iter().find(|(c, _)| *c == first) {
        let second = w.next().unwrap_or("");
        // "diskutil apfs list" but never "diskutil apfs deleteVolume".
        return subs.contains(&second) && (second != "apfs" || w.next() == Some("list"));
    }
    match first {
        // pmset and sysctl change settings only with these flags; top only reads.
        "pmset" => piece.contains("-g"),
        "sysctl" => !piece.contains('='),
        _ => REPORT_COMMANDS.contains(&first) && first != "pmset",
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn service_and_network_tools_read_only_with_their_reading_forms() {
        assert!(super::piece_reads("launchctl list"));
        assert!(!super::piece_reads("launchctl unload x"));
        assert!(super::piece_reads("scutil --get ComputerName"));
        assert!(!super::piece_reads("scutil --set ComputerName x"));
        assert!(super::piece_reads("networksetup -listallnetworkservices"));
        assert!(!super::piece_reads("networksetup -setairportpower en0 off"));
    }
}
