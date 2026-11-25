/**
 * Speech bars: the robot's screen mouth becomes a little equaliser while it speaks or
 * listens, five bars whose heights follow the voice (`mouth` while speaking, the microphone
 * level while listening), centre bars tallest, each flickering at its own rate so the bars
 * never move in lockstep.
 *
 * Pure (no three.js, no DOM): tested by `speech-bars.test.ts`.
 */

export const BAR_COUNT = 5;
/** Height share per bar (centre tallest), flicker rates (rad/s) and phase offsets. */
const PROFILE = [0.5, 0.82, 1, 0.82, 0.5] as const;
const RATES = [9.1, 12.7, 7.3, 11.3, 8.9] as const;
const PHASES = [0.0, 1.7, 3.1, 4.4, 5.6] as const;

/** Writes the five bar heights 0..1 for voice `level` 0..1 at `time` into `out`; returns it. */
export function speechBars<T extends { [index: number]: number }>(level: number, time: number, out: T): T {
  const l = Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : 0;
  for (let i = 0; i < BAR_COUNT; i++) {
    const flicker = 0.5 + 0.5 * Math.sin(time * RATES[i] + PHASES[i]);
    out[i] = l * PROFILE[i] * (0.45 + 0.55 * flicker);
  }
  return out;
}
