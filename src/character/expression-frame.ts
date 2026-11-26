/**
 * The expression frame: everything an emote (and drowsiness) adds on top of the mood in one
 * frame, as plain numbers, and how its face channels fold into the shared mood dials.
 *
 * Body channels are offsets a skin adds to its pose (world units and radians); face channels
 * are 0..1 amounts a skin draws its own way (the robot's screen draws hearts and stars, the
 * puppy's catchlights swell). Every channel is exactly 0 at rest, so a skin with no emote
 * playing looks exactly as it did before emotes existed.
 *
 * Pure (no three.js, no DOM): tested by `emotes.test.ts`.
 */
import type { MoodParams } from './moods.ts';

export interface ExpressionFrame {
  /** Squash and stretch: >0 stretches tall and thin, <0 squashes short and wide. */
  squash: number;
  /** Lift (world units), roll (lean sideways), pitch (+ nods down) and yaw (a spin), radians. */
  lift: number;
  roll: number;
  pitch: number;
  yaw: number;
  /** A side-to-side wave -1..1 and how far a paw is raised to wave 0..1. */
  swing: number;
  paw: number;
  /** Face: heart eyes, sparkle (star) eyes, a wink (one eye shut), wide eyes, heavy lids. */
  hearts: number;
  stars: number;
  wink: number;
  wide: number;
  sleepy: number;
  /** Happy squint and smile, and the round "o" of surprise or a yawn. */
  happy: number;
  mouthO: number;
  /** Gaze override: how much it holds (the pointer still wins) and where, -1..1. */
  look: number;
  lookX: number;
  lookY: number;
  /** Habits: humming (a gentle sway), chasing its tail (head turned back, tail racing), scratching
   * an ear with a back leg (0..1 each; a skin without the limb ignores it). */
  hum: number;
  chase: number;
  scratch: number;
  /** A real nap 0..1 (`habits.ts` sleep): eyes shut, screen dimmed, slow deep breathing. */
  nap: number;
}

export type ExpressionChannel = keyof ExpressionFrame;

/** A frame with every channel at rest. */
export function restingExpression(): ExpressionFrame {
  return { squash: 0, lift: 0, roll: 0, pitch: 0, yaw: 0, swing: 0, paw: 0, hearts: 0, stars: 0, wink: 0, wide: 0, sleepy: 0, happy: 0, mouthO: 0, look: 0, lookX: 0, lookY: 0, hum: 0, chase: 0, scratch: 0, nap: 0 };
}

/** Resets every channel of `frame` to rest, in place. */
export function resetExpression(frame: ExpressionFrame): ExpressionFrame {
  for (const key of Object.keys(frame) as ExpressionChannel[]) frame[key] = 0;
  return frame;
}

/** Drowsiness 0..1 (a long quiet spell) layered onto `frame`: heavy lids and a slight slump. */
export function addDrowsiness(frame: ExpressionFrame, drowsy: number): ExpressionFrame {
  if (drowsy <= 0) return frame;
  frame.sleepy = Math.max(frame.sleepy, 0.75 * drowsy);
  frame.pitch += 0.06 * drowsy;
  frame.lift -= 0.03 * drowsy;
  return frame;
}

/**
 * A nap 0..1 layered onto `frame` (on top of drowsiness): lids fully shut, the head settles a
 * little lower. The mood side (dim, slow breath) is folded by `foldExpression`.
 */
export function addNap(frame: ExpressionFrame, nap: number): ExpressionFrame {
  if (nap <= 0) return frame;
  frame.nap = nap;
  frame.sleepy = Math.max(frame.sleepy, nap);
  frame.pitch += 0.06 * nap;
  frame.lift -= 0.02 * nap;
  return frame;
}

/**
 * Folds the face channels into `out` (a copy of the blended mood, touch already folded):
 * wide eyes open further and glow, happy squints and smiles, sleepy lowers the lids into a
 * flat line, sparkle and heart eyes glow brighter, an "o" mouth drops the smile. With every
 * face channel at 0, `out` is left exactly as it was.
 */
export function foldExpression(out: MoodParams, f: Readonly<ExpressionFrame>): MoodParams {
  if (f.wide > 0) {
    out.eyeOpen *= 1 + 0.42 * f.wide;
    out.glow *= 1 + 0.2 * f.wide;
  }
  if (f.happy > 0) {
    out.squint += (1 - out.squint) * f.happy;
    out.eyeBend += (-0.35 - out.eyeBend) * f.happy;
    out.smile += (1 - out.smile) * f.happy;
  }
  if (f.sleepy > 0) {
    out.eyeOpen += (0.24 - out.eyeOpen) * f.sleepy;
    out.eyeBend += (0.12 - out.eyeBend) * f.sleepy;
    out.glow *= 1 - 0.25 * f.sleepy;
  }
  if (f.stars > 0 || f.hearts > 0) out.glow *= 1 + 0.3 * Math.max(f.stars, f.hearts);
  if (f.mouthO > 0) out.smile *= 1 - f.mouthO;
  if (f.nap > 0) {
    // Asleep for real: eyes shut into a content curve, the light dims, breathing slows and deepens.
    out.eyeOpen += (0 - out.eyeOpen) * f.nap;
    out.eyeBend += (0.45 - out.eyeBend) * f.nap;
    out.glow *= 1 - 0.55 * f.nap;
    out.presence += (0.45 - out.presence) * f.nap;
    out.bobSpeed += (0.11 - out.bobSpeed) * f.nap;
    out.bobAmp += (0.065 - out.bobAmp) * f.nap;
    out.smile += (0.12 - out.smile) * f.nap;
  }
  return out;
}
