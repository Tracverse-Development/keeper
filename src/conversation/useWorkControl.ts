/**
 * The controls for a keeper at work (Pause / Resume, Change course, Stop) and the work clock,
 * for the working card (`stage/WorkControls`). The core owns the truth (`assistant_pause`,
 * `assistant_resume`, `assistant_redirect`); this hook keeps what the window shows in step
 * with what the core answered, and the clock (`work-control.ts`) frozen while paused.
 *
 * Use: `const work = useWorkControl(assistant.busy, assistant.correct, stop)`.
 */
import { useEffect, useState } from 'react';

import { core, sentence } from '../kernel/ipc';
import { pauseClock, resumeClock, startClock, workedMs, type WorkClock } from './work-control.ts';

/** What the working card needs: the state, the clock, and the four controls. */
export interface WorkControl {
  paused: boolean;
  /** Milliseconds worked this turn (time paused does not count). */
  workedMs: number;
  /** A refusal to show (e.g. "Nothing is running right now."), or null. */
  error: string | null;
  pause: () => void;
  resume: () => void;
  /** Change course; resolves true when the correction was sent (or queued). */
  redirect: (correction: string) => Promise<boolean>;
  stop: () => void;
}

const TICK_MS = 1000;

export function useWorkControl(busy: boolean, correct: (text: string) => Promise<string | null>, stop: () => void): WorkControl {
  const [clock, setClock] = useState<WorkClock | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  // A turn starts the clock; its end clears everything (the next turn starts fresh).
  useEffect(() => {
    const at = Date.now();
    setNow(at);
    setClock(busy ? startClock(at) : null);
    setPaused(false);
    setError(null);
  }, [busy]);

  // The clock ticks once a second while working; never while paused or idle.
  useEffect(() => {
    if (!busy || paused) return;
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, [busy, paused]);

  const settle = (state: 'idle' | 'running' | 'paused') => {
    const at = Date.now();
    setNow(at);
    setPaused(state === 'paused');
    setClock((c) => c && (state === 'paused' ? pauseClock(c, at) : resumeClock(c, at)));
    setError(null);
  };
  const refused = (e: unknown) => setError(sentence(e));

  return {
    paused,
    workedMs: clock ? workedMs(clock, now) : 0,
    error,
    pause: () => void core.pause().then(settle, refused),
    resume: () => void core.resume().then(settle, refused),
    redirect: async (text) => {
      const refusal = await correct(text);
      if (refusal) {
        setError(refusal);
        return false;
      }
      // A paused run is continued and started again by the core.
      settle('running');
      return true;
    },
    stop: () => {
      setPaused(false);
      stop();
    },
  };
}
