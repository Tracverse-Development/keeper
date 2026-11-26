/**
 * The keeper's simulated mood in its body: how a pleasure and arousal reading (the core's
 * `feelings` PAD point, each -1..1) turns the shared face and breathing dials.
 *
 *   glad     the smile and the light lift
 *   low      they only quiet a little (never a frown: the smile has a floor)
 *   lively   faster breathing and blinking, eyes a touch wider
 *   tired    slower, deeper breathing, heavier lids, slower blinks
 *
 * It is a layer on top of the mood table, like a touch or an emote: at (0, 0) every dial is
 * left exactly as it was, so a keeper with no mood looks as it always did. Pure (no three.js,
 * no DOM): tested by `feeling.test.ts`.
 */
import { damp, type MoodParams } from './moods.ts';

/** The mood as the animator holds it (mutable, already clamped). */
export interface FeelingDials {
  pleasure: number;
  arousal: number;
}

/** How fast the body follows a change of mood (1/s): a couple of seconds, never a snap. */
export const FEELING_RATE = 0.9;
/** The lowest the resting smile goes for a low mood: a flat, quiet mouth. */
export const SMILE_FLOOR = 0;

function unit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, -1), 1) : 0;
}

/** A mood arriving from outside, clamped; anything that is not one reads as no mood. */
export function readFeeling(value: unknown): FeelingDials {
  const v = (value ?? {}) as { pleasure?: unknown; arousal?: unknown };
  return { pleasure: unit(v.pleasure), arousal: unit(v.arousal) };
}

/** Eases `current` toward `target` in place and returns it. */
export function easeFeeling(current: FeelingDials, target: Readonly<FeelingDials>, dt: number): FeelingDials {
  current.pleasure = damp(current.pleasure, target.pleasure, FEELING_RATE, dt);
  current.arousal = damp(current.arousal, target.arousal, FEELING_RATE, dt);
  return current;
}

/**
 * Folds the mood into `out` (the blended mood with touch already folded). `awake` 0..1 scales
 * it (0 while asleep: a sleeping keeper shows no mood).
 */
export function foldFeeling(out: MoodParams, feeling: Readonly<FeelingDials>, awake = 1): MoodParams {
  const p = feeling.pleasure * awake;
  const a = feeling.arousal * awake;
  if (p !== 0) {
    // A low mood quiets the smile but never below a flat mouth, and never past where it was.
    out.smile = p > 0 ? Math.min(out.smile + 0.4 * p, 1) : Math.max(out.smile + 0.4 * p, Math.min(out.smile, SMILE_FLOOR));
    out.glow *= 1 + 0.14 * p;
    if (p > 0) out.eyeBend -= 0.1 * p;
  }
  if (a > 0) {
    out.bobSpeed *= 1 + 0.45 * a;
    out.bobAmp *= 1 + 0.15 * a;
    out.eyeOpen *= 1 + 0.06 * a;
  } else if (a < 0) {
    out.bobSpeed *= 1 + 0.4 * a;
    out.bobAmp *= 1 - 0.3 * a;
    out.eyeOpen *= 1 + 0.24 * a;
  }
  return out;
}

/** How fast the blink clock runs for a mood: lively blinks more often, tired less. */
export function blinkPace(feeling: Readonly<FeelingDials>): number {
  return 1 + 0.5 * feeling.arousal;
}
