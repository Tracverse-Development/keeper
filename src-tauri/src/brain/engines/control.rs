//! Pause, resume and redirect the engine runs in progress (State machine).
//!
//! Every engine process `cli::drive` runs is registered here for as long as it runs. The person
//! can then:
//! - **pause**: every run is stopped in place (its process group gets SIGSTOP) and its time limit
//!   stops counting;
//! - **resume**: every paused run carries on (SIGCONT) and its clock starts again;
//! - **redirect** with a correction: the run is stopped and the correction waits here until the
//!   brain takes it (`take_correction`) and starts again with it (`brain::redirect`);
//! - **cancel** (Stop): paused runs are continued first, so nothing is left frozen, then stopped.
//!
//! `Runs` is the pure machine (time is passed in, no signals): `idle → running ⇄ paused`, and
//! back to idle when the last run finishes. The free functions apply it to the one shared
//! instance and send the signals (`platform::signal_group`).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::platform::{self, GroupSignal};

/// What the window is told about the work in progress.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkState {
    /// No engine is running.
    Idle,
    Running,
    /// Stopped in place by the person; resumes where it was.
    Paused,
}

/// Why a pause, resume or redirect could not happen, in the person's words.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ControlError {
    NothingRunning,
    AlreadyPaused,
    NotPaused,
}

impl ControlError {
    pub fn words(&self) -> &'static str {
        match self {
            ControlError::NothingRunning => "Nothing is running right now.",
            ControlError::AlreadyPaused => "It's already paused.",
            ControlError::NotPaused => "It isn't paused.",
        }
    }
}

struct Run {
    id: u64,
    /// The process group's leader (the engine process), when the system gave one.
    leader: Option<u32>,
    paused_since: Option<Instant>,
    paused_for: Duration,
    started: Instant,
}

/// The runs in progress and a correction waiting to be taken (pure; tested below).
#[derive(Default)]
pub struct Runs {
    runs: Vec<Run>,
    next_id: u64,
    correction: Option<String>,
}

impl Runs {
    /// A run started (`leader` = its process group). Returns its id for `finish` and `active_for`.
    /// A run that starts while others are paused starts running: pausing is something the
    /// person does to what they can see, not a rule for later work.
    pub fn start(&mut self, leader: Option<u32>, now: Instant) -> u64 {
        self.next_id += 1;
        self.runs.push(Run { id: self.next_id, leader, paused_since: None, paused_for: Duration::ZERO, started: now });
        self.next_id
    }

    /// A run ended. Returns its leader when it was still paused (it must be continued so the
    /// commands in its group are not left frozen).
    pub fn finish(&mut self, id: u64) -> Option<u32> {
        let at = self.runs.iter().position(|r| r.id == id)?;
        // A waiting correction stays: the run it stopped has just ended, and the brain takes
        // the correction next to start again (Stop drops it: `cancel`).
        let run = self.runs.remove(at);
        run.paused_since.and(run.leader)
    }

    pub fn state(&self) -> WorkState {
        if self.runs.is_empty() {
            WorkState::Idle
        } else if self.runs.iter().all(|r| r.paused_since.is_some()) {
            WorkState::Paused
        } else {
            WorkState::Running
        }
    }

    /// Pause every running run. Returns the groups to stop.
    pub fn pause(&mut self, now: Instant) -> Result<Vec<u32>, ControlError> {
        match self.state() {
            WorkState::Idle => return Err(ControlError::NothingRunning),
            WorkState::Paused => return Err(ControlError::AlreadyPaused),
            WorkState::Running => {}
        }
        let mut leaders = Vec::new();
        for run in self.runs.iter_mut().filter(|r| r.paused_since.is_none()) {
            run.paused_since = Some(now);
            leaders.extend(run.leader);
        }
        Ok(leaders)
    }

    /// Resume every paused run; its paused time no longer counts against its time limit.
    /// Returns the groups to continue.
    pub fn resume(&mut self, now: Instant) -> Result<Vec<u32>, ControlError> {
        if self.runs.is_empty() {
            return Err(ControlError::NothingRunning);
        }
        let leaders = self.unpause_all(now);
        if leaders.is_empty() && self.runs.iter().all(|r| r.leader.is_some()) {
            return Err(ControlError::NotPaused);
        }
        Ok(leaders)
    }

    fn unpause_all(&mut self, now: Instant) -> Vec<u32> {
        let mut leaders = Vec::new();
        for run in self.runs.iter_mut() {
            if let Some(since) = run.paused_since.take() {
                run.paused_for += now.saturating_duration_since(since);
                leaders.extend(run.leader);
            }
        }
        leaders
    }

    /// Change course: keep `correction` for the brain and continue any paused run (it is about
    /// to be stopped and started again). Returns the groups to continue.
    pub fn redirect(&mut self, correction: &str, now: Instant) -> Result<Vec<u32>, ControlError> {
        if self.runs.is_empty() {
            return Err(ControlError::NothingRunning);
        }
        self.correction = Some(correction.to_string());
        Ok(self.unpause_all(now))
    }

    /// Stop: forget any waiting correction and continue paused runs. Returns the groups to continue.
    pub fn cancel(&mut self, now: Instant) -> Vec<u32> {
        self.correction = None;
        self.unpause_all(now)
    }

    /// Is a correction waiting (a stopped run should say it was redirected, not stopped)?
    pub fn redirect_pending(&self) -> bool {
        self.correction.is_some()
    }

    /// The waiting correction, once (the brain starts again with it).
    pub fn take_correction(&mut self) -> Option<String> {
        self.correction.take()
    }

    /// How long a run has been WORKING (time paused not counted): what its time limit measures.
    pub fn active_for(&self, id: u64, now: Instant) -> Duration {
        let Some(run) = self.runs.iter().find(|r| r.id == id) else { return Duration::ZERO };
        let paused_now = run.paused_since.map(|s| now.saturating_duration_since(s)).unwrap_or_default();
        now.saturating_duration_since(run.started).saturating_sub(run.paused_for + paused_now)
    }
}

static RUNS: Mutex<Option<Runs>> = Mutex::new(None);

fn with<T>(f: impl FnOnce(&mut Runs) -> T) -> T {
    let mut guard = RUNS.lock().unwrap_or_else(|e| e.into_inner());
    f(guard.get_or_insert_with(Runs::default))
}

fn send(leaders: &[u32], signal: GroupSignal) {
    for &leader in leaders {
        // A group that already ended has nothing left to signal.
        let _ = platform::signal_group(leader, signal);
    }
}

/// A run in progress; dropping it ends the registration (and continues the group if it was paused).
pub struct Registered(u64);

impl Registered {
    pub fn id(&self) -> u64 {
        self.0
    }
}

impl Drop for Registered {
    fn drop(&mut self) {
        if let Some(leader) = with(|r| r.finish(self.0)) {
            send(&[leader], GroupSignal::Continue);
        }
    }
}

/// Register a run whose process group is led by `leader`.
pub fn register(leader: Option<u32>) -> Registered {
    Registered(with(|r| r.start(leader, Instant::now())))
}

/// The work in progress, as the window shows it.
pub fn state() -> WorkState {
    with(|r| r.state())
}

/// Pause the work in progress (the Pause button).
pub fn pause() -> Result<WorkState, ControlError> {
    let leaders = with(|r| r.pause(Instant::now()))?;
    send(&leaders, GroupSignal::Pause);
    Ok(state())
}

/// Resume paused work (the Resume button).
pub fn resume() -> Result<WorkState, ControlError> {
    let leaders = with(|r| r.resume(Instant::now()))?;
    send(&leaders, GroupSignal::Continue);
    Ok(state())
}

/// Change course with `correction`; the caller then stops the run (`cli::stop_runs`).
pub fn redirect(correction: &str) -> Result<(), ControlError> {
    let leaders = with(|r| r.redirect(correction, Instant::now()))?;
    send(&leaders, GroupSignal::Continue);
    Ok(())
}

/// Stop: continue anything paused and drop a waiting correction; the caller stops the runs.
pub fn cancel() {
    let leaders = with(|r| r.cancel(Instant::now()));
    send(&leaders, GroupSignal::Continue);
}

pub fn redirect_pending() -> bool {
    with(|r| r.redirect_pending())
}

pub fn take_correction() -> Option<String> {
    with(|r| r.take_correction())
}

/// Resolves once run `id` has WORKED for `limit` (paused time does not count), checking often
/// enough that a time limit is kept to within a second.
pub async fn worked_for(id: u64, limit: Duration) {
    loop {
        let left = limit.saturating_sub(with(|r| r.active_for(id, Instant::now())));
        if left.is_zero() {
            return;
        }
        tokio::time::sleep(left.min(Duration::from_secs(1))).await;
    }
}

/// End a stopped run's whole group: continue it (a stopped process cannot act on TERM) and
/// ask it to end, so a command it was running does not outlive the run.
pub fn end_group(leader: Option<u32>) {
    if let Some(leader) = leader {
        send(&[leader], GroupSignal::Continue);
        send(&[leader], GroupSignal::End);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(start: Instant, secs: u64) -> Instant {
        start + Duration::from_secs(secs)
    }

    #[test]
    fn running_paused_running_done() {
        let t0 = Instant::now();
        let mut runs = Runs::default();
        assert_eq!(runs.state(), WorkState::Idle);
        let id = runs.start(Some(41), t0);
        assert_eq!(runs.state(), WorkState::Running);
        assert_eq!(runs.pause(at(t0, 10)), Ok(vec![41]));
        assert_eq!(runs.state(), WorkState::Paused);
        assert_eq!(runs.pause(at(t0, 11)), Err(ControlError::AlreadyPaused));
        assert_eq!(runs.resume(at(t0, 70)), Ok(vec![41]));
        assert_eq!(runs.state(), WorkState::Running);
        assert_eq!(runs.resume(at(t0, 71)), Err(ControlError::NotPaused));
        assert_eq!(runs.finish(id), None, "a running run needs no continue");
        assert_eq!(runs.state(), WorkState::Idle);
    }

    #[test]
    fn paused_time_does_not_count_against_the_time_limit() {
        let t0 = Instant::now();
        let mut runs = Runs::default();
        let id = runs.start(Some(7), t0);
        runs.pause(at(t0, 100)).unwrap();
        // Paused for ten minutes: still 100 s of work, at any moment of the pause.
        assert_eq!(runs.active_for(id, at(t0, 400)), Duration::from_secs(100));
        assert_eq!(runs.active_for(id, at(t0, 700)), Duration::from_secs(100));
        runs.resume(at(t0, 700)).unwrap();
        assert_eq!(runs.active_for(id, at(t0, 750)), Duration::from_secs(150));
    }

    #[test]
    fn cancel_while_paused_continues_the_group_and_cleans_up() {
        let t0 = Instant::now();
        let mut runs = Runs::default();
        let id = runs.start(Some(9), t0);
        runs.pause(at(t0, 1)).unwrap();
        runs.redirect("use metric", at(t0, 2)).unwrap();
        runs.pause(at(t0, 3)).unwrap();
        assert_eq!(runs.cancel(at(t0, 4)), vec![9], "the frozen group is continued before it is stopped");
        assert!(!runs.redirect_pending(), "Stop drops a waiting correction");
        assert_eq!(runs.state(), WorkState::Running);
        runs.finish(id);
        assert_eq!(runs.state(), WorkState::Idle);
    }

    #[test]
    fn a_run_that_ends_while_paused_is_continued() {
        let t0 = Instant::now();
        let mut runs = Runs::default();
        let id = runs.start(Some(12), t0);
        runs.pause(at(t0, 1)).unwrap();
        assert_eq!(runs.finish(id), Some(12));
    }

    #[test]
    fn nothing_running_says_so() {
        let mut runs = Runs::default();
        let now = Instant::now();
        assert_eq!(runs.pause(now), Err(ControlError::NothingRunning));
        assert_eq!(runs.resume(now), Err(ControlError::NothingRunning));
        assert_eq!(runs.redirect("x", now), Err(ControlError::NothingRunning));
        assert_eq!(ControlError::NothingRunning.words(), "Nothing is running right now.");
    }

    #[test]
    fn a_correction_is_taken_once_and_continues_a_paused_run() {
        let t0 = Instant::now();
        let mut runs = Runs::default();
        let id = runs.start(Some(5), t0);
        runs.pause(at(t0, 1)).unwrap();
        assert_eq!(runs.redirect("leave the heading alone", at(t0, 2)), Ok(vec![5]));
        assert!(runs.redirect_pending());
        assert_eq!(runs.take_correction().as_deref(), Some("leave the heading alone"));
        assert_eq!(runs.take_correction(), None);
        // The stopped run ends before the brain takes the correction: it must still be there.
        runs.redirect("again", at(t0, 3)).unwrap();
        runs.finish(id);
        assert_eq!(runs.take_correction().as_deref(), Some("again"));
    }
}
