/**
 * The focus timer in the top bar: shown only while a focus session runs, counting down, with a
 * button to end it early. It reads the session from the core when it appears, whenever
 * `refreshKey` changes (a turn may have started or ended one) and every few seconds.
 */
import { useEffect, useState } from 'react';

import { core } from '../kernel/ipc';
import type { FocusSession } from '../kernel/ipc-studio';
import { clockLeft, isOver } from './focus-view';

const RECHECK_MS = 15_000;

export function FocusChip({ refreshKey }: { refreshKey: number }) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let current = true;
    const read = () =>
      core
        .focusState()
        .then((s) => {
          if (current) setSession(s);
        })
        .catch(() => undefined);
    void read();
    const timer = window.setInterval(read, RECHECK_MS);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!session) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [session]);

  if (!session || isOver(session.endsAt, now)) return null;
  return (
    <span className="pill focus-chip" role="timer" aria-label={`Focus session, ${clockLeft(session.endsAt, now)} left`}>
      <span className="dot ok" />
      Focus {clockLeft(session.endsAt, now)}
      <button type="button" className="focus-end" onClick={() => void core.focusStop().then(() => setSession(null))} aria-label="End the focus session">
        ✕
      </button>
    </span>
  );
}
