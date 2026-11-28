/**
 * Pausing, resuming and redirecting a keeper's work, as pure rules (tested in
 * work-control.test.ts; the hook is `useWorkControl`):
 * - `WorkClock`: how long the keeper has WORKED this turn (time paused does not count, like the
 *   core's own time limit);
 * - `dockAction`: what Enter does in the message box while the keeper works;
 * - `afterCorrection`: what to do when a correction could not be sent.
 */

/** Work time so far: `pausedMs` already spent paused, plus the pause in progress (`pausedAt`). */
export interface WorkClock {
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

export const startClock = (now: number): WorkClock => ({ startedAt: now, pausedAt: null, pausedMs: 0 });

export function pauseClock(c: WorkClock, now: number): WorkClock {
  return c.pausedAt === null ? { ...c, pausedAt: now } : c;
}

export function resumeClock(c: WorkClock, now: number): WorkClock {
  return c.pausedAt === null ? c : { ...c, pausedAt: null, pausedMs: c.pausedMs + Math.max(0, now - c.pausedAt) };
}

/** Milliseconds worked by `now` (frozen while paused). */
export function workedMs(c: WorkClock, now: number): number {
  const pausedNow = c.pausedAt === null ? 0 : Math.max(0, now - c.pausedAt);
  return Math.max(0, now - c.startedAt - c.pausedMs - pausedNow);
}

/**
 * What sending does: while the keeper works, a message is a correction by default (Enter), and
 * "Queue it" keeps it for after the turn; when it is free, a message is simply sent.
 */
export function dockAction(busy: boolean, canCorrect: boolean): 'send' | 'correct' | 'queue' {
  if (!busy) return 'send';
  return canCorrect ? 'correct' : 'queue';
}

/**
 * A correction the core refused: when nothing is running any more (the turn was between engine
 * runs, or just finished), the words are not lost: they are queued as the next message.
 * Anything else is shown to the person.
 */
export function afterCorrection(error: string): 'queue' | 'show' {
  return /nothing is running/i.test(error) ? 'queue' : 'show';
}

/** The line shown on the exchange and the working card for one correction. */
export const correctionWords = (correction: string) => `Changed course: ${correction.trim()}`;

/** Work time as a calm clock: "0:07", "4:32", "1:02:05". */
export function elapsedWords(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
