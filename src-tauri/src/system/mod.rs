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
}
