/**
 * The frame-time governor: keeps the keeper smooth on a slow or busy GPU by stepping the stage's
 * render cost down when frames keep missing their budget, and back up when there is headroom.
 *
 * Pattern: State (a small state machine over quality tiers) with hysteresis, pure and node-tested;
 * `create-character.ts` feeds it the time between drawn frames and applies the tier it names to
 * the stage (`scene.ts` `Stage.setQuality`).
 *
 * How it decides (all times in milliseconds):
 * - Each sample is the interval between two drawn frames. Intervals longer than `GAP_MS` are not
 *   samples (the window was hidden, the Mac slept, a one-off stall) and are ignored.
 * - An exponential average of the intervals (`AVERAGE_RATE`) smooths single slow frames away.
 * - SLOW: the average stays above `budget × SLOW_FACTOR` for `SLOW_HOLD_MS` → one tier cheaper.
 * - HEADROOM: the average stays below `budget × FAST_FACTOR` for the current wait → one tier
 *   dearer. The wait starts at `RISE_HOLD_MS` and doubles (to `RISE_HOLD_MAX_MS`) each time a step
 *   up is followed by a step back down within `RELAPSE_MS`, so it never flips back and forth.
 * - Between the two bands nothing changes (the hysteresis band), and after any change the
 *   average restarts from the next samples (`SETTLE_MS` of quiet first).
 *
 * The budget is a 60 fps frame (`BUDGET_MS`): a 120 Hz screen running at 60 is smooth enough
 * and is left alone, so the governor never trades the look for frames nobody misses.
 *
 * Usage:
 *   const governor = new FrameGovernor();
 *   // each drawn frame: const tier = governor.sample(intervalMs, nowMs);
 *   // if (tier !== null) stage.setQuality(QUALITY_TIERS[tier]);
 *   governor.reset(); // after a pause: the next interval is not a sample
 */

/** What one quality tier costs the stage. Tier 0 is the full look. */
export interface QualityTier {
  /** The highest device pixel ratio drawn (the screen's own is used when lower). */
  readonly maxPixelRatio: number;
  /** MSAA samples on the HDR buffers (0 = none). */
  readonly samples: number;
  /** Whether the bloom pass runs (the eyes, mouth and halo glow). */
  readonly bloom: boolean;
}

/** From the full look (0) to the cheapest (last). Each step removes one cost. */
export const QUALITY_TIERS: readonly QualityTier[] = [
  { maxPixelRatio: 2, samples: 4, bloom: true },
  { maxPixelRatio: 1.5, samples: 4, bloom: true },
  { maxPixelRatio: 1.25, samples: 2, bloom: true },
  { maxPixelRatio: 1, samples: 2, bloom: true },
  { maxPixelRatio: 1, samples: 0, bloom: false },
];

/** A 60 fps frame. */
export const BUDGET_MS = 1000 / 60;
/** Slower than ~44 fps on average is too slow. */
export const SLOW_FACTOR = 1.35;
/** Faster than ~54 fps on average is headroom. */
export const FAST_FACTOR = 1.1;
/** An interval this long is a pause, not a frame. */
export const GAP_MS = 250;
export const SLOW_HOLD_MS = 1500;
export const RISE_HOLD_MS = 6000;
export const RISE_HOLD_MAX_MS = 60000;
/** A step down this soon after a step up means the step up did not hold. */
export const RELAPSE_MS = 5000;
/** After a change, samples are ignored this long (buffers are being remade). */
export const SETTLE_MS = 500;
const AVERAGE_RATE = 0.1;

export class FrameGovernor {
  private tierIndex: number;
  private average: number | null = null;
  private slowSince: number | null = null;
  private fastSince: number | null = null;
  private changedAt = Number.NEGATIVE_INFINITY;
  private lastRiseAt = Number.NEGATIVE_INFINITY;
  private riseHold = RISE_HOLD_MS;
  private readonly tiers: number;

  /** `tiers` = how many quality tiers there are; it starts at `start` (default 0, the full look). */
  constructor(tiers: number = QUALITY_TIERS.length, start = 0) {
    this.tiers = Math.max(1, Math.floor(tiers));
    this.tierIndex = Math.min(Math.max(0, Math.floor(start)), this.tiers - 1);
  }

  /** The tier in use now (0 = full look). */
  get tier(): number {
    return this.tierIndex;
  }

  /** The smoothed interval between frames, ms (null before any sample). */
  get averageMs(): number | null {
    return this.average;
  }

  /** Forget the running measurement (after a pause or a photo); the tier is kept. */
  reset(): void {
    this.average = null;
    this.slowSince = null;
    this.fastSince = null;
  }

  /**
   * One frame drew `intervalMs` after the one before, at `nowMs` (any steady clock). Returns the
   * new tier when it changes, else null.
   */
  sample(intervalMs: number, nowMs: number): number | null {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > GAP_MS) {
      this.reset();
      return null;
    }
    if (nowMs - this.changedAt < SETTLE_MS) return null;
    this.average = this.average === null ? intervalMs : this.average + (intervalMs - this.average) * AVERAGE_RATE;

    if (this.average > BUDGET_MS * SLOW_FACTOR) {
      this.fastSince = null;
      this.slowSince ??= nowMs;
      if (nowMs - this.slowSince >= SLOW_HOLD_MS && this.tierIndex < this.tiers - 1) {
        if (nowMs - this.lastRiseAt < RELAPSE_MS) this.riseHold = Math.min(this.riseHold * 2, RISE_HOLD_MAX_MS);
        return this.change(this.tierIndex + 1, nowMs);
      }
      return null;
    }
    this.slowSince = null;
    if (this.average < BUDGET_MS * FAST_FACTOR) {
      this.fastSince ??= nowMs;
      if (nowMs - this.fastSince >= this.riseHold && this.tierIndex > 0) {
        this.lastRiseAt = nowMs;
        return this.change(this.tierIndex - 1, nowMs);
      }
      return null;
    }
    this.fastSince = null;
    return null;
  }

  private change(next: number, nowMs: number): number {
    this.tierIndex = next;
    this.changedAt = nowMs;
    this.reset();
    return next;
  }
}

/**
 * The screen's pixel ratio as a tier draws it: the device's own (1 when unknown), never above
 * the tier's cap, never below 1.
 */
export function tierPixelRatio(devicePixelRatio: number, tier: QualityTier): number {
  const device = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.min(device, tier.maxPixelRatio));
}
