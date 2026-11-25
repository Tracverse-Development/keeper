/**
 * The puppy's own mood table: the dials only a puppy has (ears, tail, tongue, curling up),
 * one row per mood, blended by the animator's eased mood weights.
 *
 * Pattern: State as a lookup table, like the shared `moods.ts`: the puppy never branches
 * on a mood, it mixes these rows by how much of each mood is showing. The shared dials
 * (eyes, gaze, bob, bounce, lean) still come from `moods.ts`; this table only adds the
 * body language a robot does not have.
 *
 * Pure (no three.js): tested by `puppy-moods.test.ts`.
 */
import type { Mood } from '../../contract';

export interface PuppyDials {
  /** Ear lift: 0 hanging relaxed, 1 perked up and out, negative droops (sleepy). */
  earPerk: number;
  /** Sideways head tilt in radians (the curious listening tilt). */
  headTilt: number;
  /** Tail wag amplitude (radians) and speed (wags per second). */
  tailWag: number;
  tailSpeed: number;
  /** Resting jaw opening 0..1 (a happy pant); speech opens it further. */
  mouthOpen: number;
  /** How far the tongue shows 0..1. */
  tongue: number;
  /** Curled-up sleep pose 0..1: head lowered, body settled, tail wrapped. */
  curl: number;
  /** Occasional single-ear flick 0..1 (thinking). */
  earTwitch: number;
}

export type PuppyTable = Readonly<Record<Mood, Readonly<PuppyDials>>>;

const IDLE: PuppyDials = {
  earPerk: 0.1,
  headTilt: 0,
  tailWag: 0.22,
  tailSpeed: 1.1,
  mouthOpen: 0,
  tongue: 0,
  curl: 0,
  earTwitch: 0,
};

export const PUPPY_TABLE: PuppyTable = {
  idle: IDLE,
  listening: { ...IDLE, earPerk: 1, headTilt: 0.2, tailWag: 0.16, tailSpeed: 0.9 },
  thinking: { ...IDLE, earPerk: 0.35, headTilt: -0.1, tailWag: 0.08, tailSpeed: 0.7, earTwitch: 1 },
  speaking: { ...IDLE, earPerk: 0.3, tailWag: 0.3, tailSpeed: 1.6, tongue: 0.5 },
  happy: { ...IDLE, earPerk: 0.5, headTilt: 0.06, tailWag: 0.75, tailSpeed: 3.2, mouthOpen: 0.5, tongue: 1 },
  asleep: { ...IDLE, earPerk: -0.2, tailWag: 0, tailSpeed: 0.3, curl: 1 },
};

const DIAL_NAMES = Object.keys(IDLE) as (keyof PuppyDials)[];

/** A fresh mutable set of dials (the skin keeps one and blends into it every frame). */
export function puppyDials(): PuppyDials {
  return { ...IDLE };
}

/**
 * Writes the weighted mix of the table rows into `out`. Weights need not sum to 1 (they
 * are normalised); all-zero weights fall back to idle.
 */
export function blendPuppyDials(weights: Readonly<Record<Mood, number>>, out: PuppyDials): PuppyDials {
  let total = 0;
  for (const mood of Object.keys(PUPPY_TABLE) as Mood[]) total += Math.max(weights[mood] ?? 0, 0);
  for (const dial of DIAL_NAMES) {
    if (total <= 1e-6) {
      out[dial] = IDLE[dial];
      continue;
    }
    let sum = 0;
    for (const mood of Object.keys(PUPPY_TABLE) as Mood[]) sum += PUPPY_TABLE[mood][dial] * Math.max(weights[mood] ?? 0, 0);
    out[dial] = sum / total;
  }
  return out;
}
