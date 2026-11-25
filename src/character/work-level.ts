/**
 * The work dial: how hard the keeper is working, 0 (idle) .. 1 (flat out, "overheating").
 *
 * The window passes a level (the turn's phase blended with the computer's CPU and memory
 * load); the animator eases it (`easeWork`: rises a little faster than it cools, so effort
 * shows promptly and calms down gracefully) and hands the eased value to the worn species
 * and parts. Each of them reads it through the small curves below, so "starts to show at
 * 0.3, full by 0.9" is one call, and the same numbers are testable without a GPU.
 *
 * `work` is independent of the mood: it is applied on top of any mood, and a species may
 * boost it while thinking (`effectiveWork`).
 *
 * Pure (no three.js, no DOM): tested by `work-level.test.ts`.
 */

/** Easing rates (1/s): how fast the eased level follows a rising and a falling input. */
export const WORK_RISE_RATE = 2.4;
export const WORK_FALL_RATE = 1.3;

/** Clamps an incoming level into 0..1 (NaN and infinities become 0). */
export function clampWork(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(Math.max(level, 0), 1);
}

/** One frame of frame-rate independent easing toward `target` (no snapping, no overshoot). */
export function easeWork(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current;
  const rate = target > current ? WORK_RISE_RATE : WORK_FALL_RATE;
  return target + (current - target) * Math.exp(-rate * dt);
}

/**
 * A smooth 0..1 ramp of `level` between `from` and `to` (0 at or below `from`, 1 at or
 * above `to`, smoothstep between). Exactly 0 at level 0 whenever `from >= 0`.
 */
export function band(level: number, from: number, to: number): number {
  if (level <= from) return 0;
  if (level >= to) return 1;
  const x = (level - from) / (to - from);
  return x * x * (3 - 2 * x);
}

/** The work level a species shows: thinking amplifies it by `boost` (never above 1). */
export function effectiveWork(work: number, thinkingWeight: number, boost: number): number {
  return Math.min(1, work * (1 + Math.max(boost, 0) * clampWork(thinkingWeight)));
}

/** How far a working tint has moved: `cool` toward the working colour, then `hot` over it. */
export interface WorkTint {
  cool: number;
  hot: number;
}

/**
 * The two-stage colour shift of working eyes: cool (0..1) rises over [coolFrom, coolTo],
 * hot (0..1) over [hotFrom, hotTo]. Writes into `out` (no allocation per frame).
 */
export function workTint(
  level: number,
  ranges: { coolFrom: number; coolTo: number; hotFrom: number; hotTo: number },
  out: WorkTint,
): WorkTint {
  out.cool = band(level, ranges.coolFrom, ranges.coolTo);
  out.hot = band(level, ranges.hotFrom, ranges.hotTo);
  return out;
}

/** Linear interpolation (used by parts for "idle value .. working value"). */
export function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
