/**
 * Touch reactions as time envelopes, and how they fold into the shared expression.
 *
 * A reaction is not a state: `react('poke')` records a start time, and every frame the
 * envelope (0 -> 1 -> 0) says how much of it is showing. Skins read the envelopes for
 * their own body language (a jolt, a lean, a wagging tail); `foldTouch` applies the part
 * every skin shares (a surprised widen on poke, a happy squint on pat).
 *
 * Each species can retime its reactions (`skins/<id>/reactions.ts`); the defaults below are
 * the timings the character shipped with.
 *
 * Pure (no three.js, no DOM): tested by `reactions.test.ts`.
 */
import type { TouchKind } from './contract';
import type { MoodParams } from './moods';
import type { ReactionTiming } from './skins/reactions-table';

/** The default timing of each reaction (seconds; attack and release included). */
export const DEFAULT_REACTION_TIMING: Readonly<Record<TouchKind, ReactionTiming>> = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0 },
  pat: { seconds: 1.8, attack: 0.28, holdShare: 0.55 },
};

/** How long each reaction lasts by default (seconds). */
export const REACTION_SECONDS: Readonly<Record<TouchKind, number>> = {
  poke: DEFAULT_REACTION_TIMING.poke.seconds,
  pat: DEFAULT_REACTION_TIMING.pat.seconds,
};

/**
 * The envelope of a reaction `elapsed` seconds after it started: a quick rise, then a hold
 * (a pat holds, a poke does not), then a smooth fall; 0 before the start and after the end.
 */
export function reactionEnvelope(kind: TouchKind, elapsed: number, timing: ReactionTiming = DEFAULT_REACTION_TIMING[kind]): number {
  const total = timing.seconds;
  const attack = timing.attack;
  if (!(elapsed > 0) || elapsed >= total) return 0;
  if (elapsed < attack) return smooth(elapsed / attack);
  const holdEnd = Math.max(attack, total * timing.holdShare);
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
