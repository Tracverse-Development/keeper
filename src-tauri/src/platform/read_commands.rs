//! Which shell commands only READ the machine (macOS): the vocabulary the plan guard
//! (`brain::guard`) uses to let a keeper look without asking. A tool here never changes anything
//! in the forms allowed: report tools are allowed only with their reading sub-commands. OS tool
//! names live in `platform/` (structure.test.ts: only platform names an OS tool).

pub const READ_COMMANDS: [&str; 47] = ["ls", "cat", "head", "tail", "find", "grep", "rg", "wc", "file", "stat", "mdfind", "pwd", "cd", "echo", "sort", "uniq", "du", "df", "date", "mdls", "ps", "pgrep", "lsof", "uptime", "whoami", "which", "sw_vers", "uname", "system_profiler", "basename", "dirname", "realpath", "netstat", "nslookup", "dig", "host", "traceroute", "cut", "tr", "column", "nl", "jq", "fold", "paste", "rev", "comm", "diff"];

/// Tools that read only with certain sub-commands ("diskutil info" reads; "diskutil erase" does not).
pub const READ_SUBCOMMANDS: &[(&str, &[&str])] = &[
    ("diskutil", &["list", "info", "apfs"]),
    ("defaults", &["read", "domains"]),
    ("launchctl", &["list", "print"]),
    ("networksetup", &["-listallnetworkservices", "-getinfo", "-getairportnetwork", "-listallhardwareports"]),
    ("scutil", &["--get", "--dns", "--proxy", "--nwi"]),
    ("ipconfig", &["getifaddr", "getpacket", "getsummary", "ifcount", "getoption"]),
    ("route", &["get", "-n"]),
    ("arp", &["-a", "-an", "-na"]),
    ("ndp", &["-a", "-an", "-na"]),
    ("dscacheutil", &["-q"]),
    ("tailscale", &["status", "ip", "netcheck", "version", "whois", "ping"]),
];

/// Commands that only report on the machine (no arguments can make them change it).
pub const REPORT_COMMANDS: [&str; 6] = ["sysctl", "vm_stat", "memory_pressure", "ioreg", "pmset", "top"];

/// One piece of a shell chain that only reads.
/// A command named by its full path counts as its name only from the system's own folders or an
/// installed app (`/Applications/Tailscale.app/Contents/MacOS/Tailscale` is `tailscale`); a path
/// anywhere else (a script in the home folder called `ls`) stays its full path and never matches.
fn program_name(word: &str) -> String {
    const TRUSTED: [&str; 6] = ["/bin/", "/usr/bin/", "/usr/sbin/", "/sbin/", "/Applications/", "/opt/homebrew/bin/"];
    match word.rsplit_once('/') {
        Some((_, name)) if TRUSTED.iter().any(|t| word.starts_with(t)) && !word.contains("..") => name.to_lowercase(),
        _ => word.to_string(),
    }
}

pub fn piece_reads(piece: &str) -> bool {
    let mut w = piece.split(|c: char| c.is_whitespace() || "\"'`;|&()<>=,".contains(c)).filter(|w| !w.is_empty());
    let Some(first) = w.next() else { return true };
    let first = &program_name(first);
    let first = first.as_str();
    if READ_COMMANDS.contains(&first) {
        return true;
    }
    if let Some((_, subs)) = READ_SUBCOMMANDS.iter().find(|(c, _)| *c == first) {
        let second = w.next().unwrap_or("");
        // "diskutil apfs list" but never "diskutil apfs deleteVolume".
        return subs.contains(&second) && (second != "apfs" || w.next() == Some("list"));
    }
    match first {
        // ifconfig changes an interface only with more words (up, down, an address…).
        "ifconfig" => piece.split_whitespace().count() <= 2 && !piece.contains("up") && !piece.contains("down"),
        // Text filters in a pipe: sed only without in-place editing, awk only without running
        // commands, plutil only printing or checking.
        "sed" => !piece.split_whitespace().any(|w| w.starts_with("-i") || w == "--in-place") && !piece.contains("w "),
        "awk" => !piece.contains("system") && !piece.contains("getline") && !piece.contains('|'),
        "plutil" => piece.contains("-p") || piece.contains("-lint"),
        // ping sends a few packets and reads the replies, only with a count.
        "ping" => piece.contains("-c"),
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
        for read in ["ifconfig", "ifconfig en0", "ifconfig -a", "netstat -rn", "arp -a", "route get default", "ipconfig getifaddr en0", "ping -c 3 1.1.1.1", "scutil --nwi"] {
            assert!(super::piece_reads(read), "{read} reads");
        }
        for read in ["dscacheutil -q host -a ip_address 192.168.1.1", "arp -a -i en0", "tailscale status", "/Applications/Tailscale.app/Contents/MacOS/Tailscale status", "/usr/sbin/netstat -rn", "ndp -an", "ping -c 2 -t 3 192.168.1.255", "awk '{print $1}'", "sed -n 1,20p", "cut -d: -f1", "tr -d ' '", "plutil -p ~/Library/Preferences/x.plist"] {
            assert!(super::piece_reads(read), "{read} reads");
        }
        for change in ["dscacheutil -flushcache", "tailscale up", "tailscale logout", "~/bin/ls", "/Users/x/ls -la", "/usr/bin/../../Users/x/ls", "ndp -c", "sed -i '' s/a/b/ f.txt", "awk 'BEGIN{system(\"rm x\")}'", "plutil -replace k -string v x.plist", "ifconfig en0 down", "ifconfig en0 inet 10.0.0.2", "arp -d 10.0.0.1", "route add default 10.0.0.1", "ipconfig set en0 DHCP", "ping 1.1.1.1"] {
            assert!(!super::piece_reads(change), "{change} changes or never ends");
        }
    }
}
