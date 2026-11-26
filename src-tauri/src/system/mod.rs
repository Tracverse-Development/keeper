//! How hard the computer is working right now (CPU and memory, 0–100), so the keeper can look
//! busy, hot or calm. Read on demand while the keeper works; one shared `sysinfo` reader (CPU use
//! is the difference between two readings, so the reader is kept between calls).

use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use sysinfo::{MemoryRefreshKind, RefreshKind, System, CpuRefreshKind};

static READER: OnceLock<Option<Mutex<System>>> = OnceLock::new();

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Load {
    /// Average CPU use across cores, 0–100.
    pub cpu: f32,
    /// Memory in use, 0–100.
    pub memory: f32,
}

pub fn read() -> Load {
    let reader = READER.get_or_init(|| {
        let kinds = RefreshKind::nothing().with_cpu(CpuRefreshKind::nothing().with_usage()).with_memory(MemoryRefreshKind::nothing().with_ram());
        System::new_with_specifics(kinds).ok().map(Mutex::new)
    });
    // A system that cannot be read reports a calm machine (the keeper just doesn't heat up).
    let Some(Ok(mut sys)) = reader.as_ref().map(|r| r.lock()) else { return Load { cpu: 0.0, memory: 0.0 } };
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    let memory = if sys.total_memory() == 0 { 0.0 } else { (sys.used_memory() as f64 / sys.total_memory() as f64 * 100.0) as f32 };
    Load { cpu: sys.global_cpu_usage().clamp(0.0, 100.0), memory: memory.clamp(0.0, 100.0) }
}

#[tauri::command]
pub fn system_load() -> Load {
    read()
}

/// A live reading for the Stage's live panel: load, memory, network speed, disk, the busiest apps.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Live {
    pub cpu: f32,
    pub memory: f32,
    pub memory_used_gb: f64,
    pub memory_total_gb: f64,
    /// Kilobytes per second, all interfaces, since the last reading.
    pub net_down_kbps: f64,
    pub net_up_kbps: f64,
    /// This computer's own address on its network (IPv4 of the interface that has carried the
    /// most traffic); empty when it is on no network.
    pub net_address: String,
    /// Gigabytes received and sent since the computer started (all real interfaces).
    pub net_total_down_gb: f64,
    pub net_total_up_gb: f64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    /// The apps using the most CPU now (name and percent of one core).
    pub top: Vec<(String, f32)>,
}

struct Readers {
    sys: System,
    nets: sysinfo::Networks,
    last: std::time::Instant,
}

static LIVE: OnceLock<Option<Mutex<Readers>>> = OnceLock::new();

const GB: f64 = 1024.0 * 1024.0 * 1024.0;

pub fn live() -> Live {
    let readers = LIVE.get_or_init(|| Some(Mutex::new(Readers { sys: System::new().ok()?, nets: sysinfo::Networks::new_with_refreshed_list().ok()?, last: std::time::Instant::now() })));
    let Some(Ok(mut r)) = readers.as_ref().map(|m| m.lock()) else { return Live { cpu: 0.0, memory: 0.0, memory_used_gb: 0.0, memory_total_gb: 0.0, net_down_kbps: 0.0, net_up_kbps: 0.0, net_address: String::new(), net_total_down_gb: 0.0, net_total_up_gb: 0.0, disk_used_gb: 0.0, disk_total_gb: 0.0, top: vec![] } };
    r.sys.refresh_cpu_usage();
    r.sys.refresh_memory();
    r.sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let secs = r.last.elapsed().as_secs_f64().max(0.1);
    r.last = std::time::Instant::now();
    r.nets.refresh(true);
    let (down, up) = r.nets.iter().fold((0u64, 0u64), |(d, u), (_, n)| (d + n.received(), u + n.transmitted()));
    // The interfaces that reach a network: not the loopback, and holding a private or public IPv4.
    let real: Vec<(&sysinfo::NetworkData, std::net::Ipv4Addr)> = r.nets.iter().filter_map(|(_, n)| n.ip_networks().iter().find_map(|ip| match ip.addr { std::net::IpAddr::V4(v4) if on_a_network(v4) => Some((n, v4)), _ => None })).collect();
    let net_address = real.iter().max_by_key(|(n, _)| n.total_received() + n.total_transmitted()).map(|(_, ip)| ip.to_string()).unwrap_or_default();
    let (total_down, total_up) = real.iter().fold((0u64, 0u64), |(d, u), (n, _)| (d + n.total_received(), u + n.total_transmitted()));
    let disks = sysinfo::Disks::new_with_refreshed_list().ok();
    let list: Vec<&sysinfo::Disk> = disks.as_ref().map(|d| d.into_iter().collect()).unwrap_or_default();
    // The startup disk (mounted at /), or the biggest one.
    let disk = list.iter().copied().find(|d| d.mount_point() == std::path::Path::new("/")).or_else(|| list.iter().copied().max_by_key(|d| d.total_space()));
    let (disk_total, disk_free) = disk.map(|d| (d.total_space() as f64, d.available_space() as f64)).unwrap_or((0.0, 0.0));
    let mut top: Vec<(String, f32)> = r.sys.processes().values().map(|p| (p.name().to_string_lossy().to_string(), p.cpu_usage())).filter(|(_, c)| *c > 0.5).collect();
    top.sort_by(|a, b| b.1.total_cmp(&a.1));
    top.truncate(5);
    let (used, total) = (r.sys.used_memory() as f64, r.sys.total_memory() as f64);
    Live {
        cpu: r.sys.global_cpu_usage().clamp(0.0, 100.0),
        memory: if total == 0.0 { 0.0 } else { (used / total * 100.0) as f32 },
        memory_used_gb: used / GB,
        memory_total_gb: total / GB,
        net_down_kbps: down as f64 / 1024.0 / secs,
        net_up_kbps: up as f64 / 1024.0 / secs,
        net_address,
        net_total_down_gb: total_down as f64 / GB,
        net_total_up_gb: total_up as f64 / GB,
        disk_used_gb: (disk_total - disk_free) / GB,
        disk_total_gb: disk_total / GB,
        top,
    }
}

/// An address that means "on a network": not loopback, not the self-assigned 169.254 range.
fn on_a_network(ip: std::net::Ipv4Addr) -> bool {
    !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified()
}

/// The live panel asks for a reading every second or two while it is on screen.
#[tauri::command]
pub fn system_live() -> Live {
    live()
}

#[cfg(test)]
mod tests {
    #[test]
    fn readings_are_percentages() {
        let a = super::read();
        let b = super::read();
        for v in [a.cpu, a.memory, b.cpu, b.memory] {
            assert!((0.0..=100.0).contains(&v));
        }
        assert!(b.memory > 0.0);
    }

    #[test]
    fn a_live_reading_has_memory_and_a_disk() {
        let _ = super::live();
        let l = super::live();
        assert!(l.memory_total_gb > 1.0 && l.disk_total_gb > 1.0, "{l:?}");
        assert!(l.net_down_kbps >= 0.0 && l.top.len() <= 5);
        assert!(l.net_total_down_gb >= 0.0 && (l.net_address.is_empty() || l.net_address.parse::<std::net::Ipv4Addr>().is_ok()), "{l:?}");
        assert!(!super::on_a_network("127.0.0.1".parse().unwrap()) && !super::on_a_network("169.254.3.4".parse().unwrap()) && super::on_a_network("192.168.1.20".parse().unwrap()));
    }
}
