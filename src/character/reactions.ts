/**
 * Touch reactions as time envelopes, and how they fold into the shared expression.
 *
 * A reaction is not a state: `react('poke')` records a start time, and every frame the
 * envelope (0 -> 1 -> 0) says how much of it is showing. Skins read the envelopes for
 * their own body language (a jolt, a lean, a wagging tail); `foldTouch` applies the part
 * every skin shares (a surprised widen on poke, a happy squint on pat).
 *
 * Pure (no three.js, no DOM): tested by `reactions.test.ts`.
 */
import type { TouchKind } from './contract';
import type { MoodParams } from './moods';

/** How long each reaction lasts, attack and release included (seconds). */
export const REACTION_SECONDS: Readonly<Record<TouchKind, number>> = { poke: 0.9, pat: 1.8 };
const ATTACK_SECONDS: Readonly<Record<TouchKind, number>> = { poke: 0.06, pat: 0.28 };

/**
 * The envelope of a reaction `elapsed` seconds after it started: a quick rise, then (for a
 * pat) a hold, then a smooth fall; 0 before the start and after the end.
 */
export function reactionEnvelope(kind: TouchKind, elapsed: number): number {
  const total = REACTION_SECONDS[kind];
  const attack = ATTACK_SECONDS[kind];
  if (!(elapsed > 0) || elapsed >= total) return 0;
  if (elapsed < attack) return smooth(elapsed / attack);
  const holdEnd = kind === 'pat' ? total * 0.55 : attack;
  if (elapsed < holdEnd) return 1;
  return 1 - smooth((elapsed - holdEnd) / (total - holdEnd));
}

/**
 * Folds the shared touch expression into `out` (a copy of the blended mood): poke widens
 * the eyes for a moment; pat squints them into a happy arc and raises the smile. With both
 * envelopes at 0 every value is left exactly as it was.
 */
export function foldTouch(out: MoodParams, touch: Readonly<Record<TouchKind, number>>): MoodParams {
  const { poke, pat } = touch;
  if (poke > 0) {
    out.eyeOpen *= 1 + 0.28 * poke;
    out.glow *= 1 + 0.25 * poke;
  }
  if (pat > 0) {
    out.squint += (1 - out.squint) * pat;
    out.eyeBend += (-0.35 - out.eyeBend) * pat;
    out.eyeOpen += (0.9 - out.eyeOpen) * pat;
    out.smile += (1 - out.smile) * pat;
    out.glow *= 1 + 0.2 * pat;
  }
  return out;
}

function smooth(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}
