/**
 * The face a keeper wears: which of its four expressions shows, and how much, from what it is
 * doing and where it stands.
 *
 *   happy      a pat, a happy mood, a glad feeling, a warm stage (lamplight, dawn, celestial)
 *   focused    thinking, hard work, listening a little; the neon stage keeps it alert
 *   sleepy     drowsing and napping, asleep, a tired feeling; the starfield (and night) lean sleepy
 *   surprised  a poke, being picked up, the surprised emote
 *
 * `selectExpression` turns one frame's inputs into a target `FaceMix` (each 0..1; they compete, so
 * a surprise wipes the others and focus keeps the lids from drooping); `easeMix` glides the shown
 * mix toward it (a surprise snaps in, sleep creeps in), so a change of face never pops. Skins draw
 * the mix their own way from `SkinFrame.face` (brows and lids on the people and the God Keeper, ears
 * and brow tufts on the dog, feather brows on the owl, the visor's glyphs on the robot), and
 * `foldMix` turns the part of it no other layer already shows into the shared dials (lids, squint,
 * smile, glow), so a drowsy keeper's lids are not lowered twice.
 *
 * `forced` (the preview's `?expression=`, `Character.setExpression`) shows exactly one expression,
 * or none for `neutral`; `auto` (null) is the selection.
 *
 * Pattern: Strategy-free pure policy (one selection function, one easing function, one fold), no
 * three.js, no DOM: tested by `expression-mix.test.ts`.
 */
import type { Mood, StageMood, TouchKind } from './contract';
import type { ExpressionFrame } from './expression-frame.ts';
import type { FeelingDials } from './feeling.ts';
import { damp, type MoodParams } from './moods.ts';
import { band } from './work-level.ts';

/** The four expressions every keeper draws its own way. */
export const FACE_EXPRESSIONS = ['happy', 'focused', 'sleepy', 'surprised'] as const;
export type FaceExpression = (typeof FACE_EXPRESSIONS)[number];
/** What `Character.setExpression` takes: an expression, `neutral` (none) or `auto` (the selection). */
export type ExpressionChoice = FaceExpression | 'neutral' | 'auto';

/** How much of each expression shows, 0..1 each. All 0 = the keeper's plain face. */
export type FaceMix = Record<FaceExpression, number>;

/** A mix with nothing showing. */
export function restingMix(): FaceMix {
  return { happy: 0, focused: 0, sleepy: 0, surprised: 0 };
}

/** True when `value` is an expression choice (guards strings arriving from outside). */
export function isExpressionChoice(value: unknown): value is ExpressionChoice {
  return value === 'auto' || value === 'neutral' || (FACE_EXPRESSIONS as readonly unknown[]).includes(value);
}

/**
 * How a stage mood leans the face: `rest` is shown while the keeper idles (scaled by how idle it
 * is), `gain` multiplies an expression's amount whatever its source (night makes a doze deeper,
 * neon keeps one shallow). Night has no `rest`, so the default stage leaves an idle face as it was.
 */
export interface StageLean {
  readonly rest: Partial<FaceMix>;
  readonly gain: Partial<FaceMix>;
}

export const STAGE_LEAN: Readonly<Record<StageMood, StageLean>> = {
  night: { rest: {}, gain: { sleepy: 1.25 } },
  starfield: { rest: { sleepy: 0.36 }, gain: { sleepy: 1.4 } },
  neon: { rest: { focused: 0.3 }, gain: { focused: 1.3, sleepy: 0.6 } },
  lamplight: { rest: { happy: 0.2 }, gain: { happy: 1.15 } },
  dawn: { rest: { happy: 0.12 }, gain: { sleepy: 0.8 } },
  celestial: { rest: { happy: 0.22 }, gain: { happy: 1.2, sleepy: 0.8 } },
};

/** Everything that decides the face in one frame (all eased already). */
export interface MixInputs {
  /** How much of each mood shows (sums to ~1). */
  readonly weights: Readonly<Record<Mood, number>>;
  /** The eased work level 0..1. */
  readonly work: number;
  /** The eased feeling (pleasure, arousal -1..1). */
  readonly feeling: Readonly<FeelingDials>;
  /** The touch envelopes 0..1. */
  readonly touch: Readonly<Record<TouchKind, number>>;
  /** The emote frame (emotes, drowsiness, the nap and being carried already layered in). */
  readonly emote: Readonly<ExpressionFrame>;
  /** The stage's light mood. */
  readonly stage: StageMood;
  /** One expression to show regardless, `neutral` for none; null/`auto` = the selection. */
  readonly forced?: ExpressionChoice | null;
}

/** The raw amount of each expression from what the keeper is doing (before the stage and competition). */
function sources(i: MixInputs): FaceMix {
  const { weights: w, emote: e, touch, feeling } = i;
  return {
    happy: Math.max(w.happy, touch.pat, e.happy, e.hearts, e.stars, 0.55 * band(feeling.pleasure, 0.2, 1)),
    focused: Math.max(0.9 * w.thinking, 0.8 * band(i.work, 0.25, 0.8), 0.35 * w.listening),
    sleepy: Math.max(e.sleepy, e.nap, w.asleep, 0.6 * band(-feeling.arousal, 0.2, 1)),
    surprised: Math.max(touch.poke, e.wide),
  };
}

/**
 * The face to show this frame, as a target mix: the sources, leaned by the stage, then competing
 * (surprise wipes the rest; focus beats sleep; a happy face keeps sleep shallow). A forced choice
 * wins outright. Writes into `out` (no allocation per frame) and returns it.
 */
export function selectExpression(i: MixInputs, out: FaceMix = restingMix()): FaceMix {
  const forced = i.forced && i.forced !== 'auto' ? i.forced : null;
  if (forced) {
    for (const key of FACE_EXPRESSIONS) out[key] = key === forced ? 1 : 0;
    return out;
  }
  const raw = sources(i);
  const lean = STAGE_LEAN[i.stage] ?? STAGE_LEAN.night;
  // The stage's resting lean shows only while it idles awake (never over a nap's own face).
  const calm = i.weights.idle * (1 - i.weights.asleep);
  for (const key of FACE_EXPRESSIONS) {
    raw[key] = unit(Math.max(raw[key], (lean.rest[key] ?? 0) * calm) * (lean.gain[key] ?? 1));
  }
  const s = raw.surprised;
  const f = raw.focused * (1 - s);
  const h = raw.happy * (1 - 0.7 * s) * (1 - 0.4 * f);
  out.surprised = s;
  out.focused = f;
  out.happy = h;
  out.sleepy = raw.sleepy * (1 - s) * (1 - f) ** 2 * (1 - 0.6 * h);
  return out;
}

/** How fast each expression comes in and goes out (1/s): a surprise snaps in, sleep creeps in. */
export const MIX_RATES: Readonly<Record<FaceExpression, { readonly rise: number; readonly fall: number }>> = {
  happy: { rise: 5, fall: 2.5 },
  focused: { rise: 3, fall: 2 },
  sleepy: { rise: 1.5, fall: 4 },
  surprised: { rise: 14, fall: 3 },
};

/** Eases `current` toward `target` in place, frame-rate independent (never a jump). */
export function easeMix(current: FaceMix, target: Readonly<FaceMix>, dt: number): FaceMix {
  for (const key of FACE_EXPRESSIONS) {
    const rate = target[key] > current[key] ? MIX_RATES[key].rise : MIX_RATES[key].fall;
    current[key] = damp(current[key], target[key], rate, dt);
  }
  return current;
}

/**
 * How much of each expression the other layers already put into the shared dials (the mood table,
 * touch, the feeling, the emote frame), so `foldMix` adds only the rest. A surprise is never
 * counted shown: the poke and the wide eyes only widen, the surprised face also drops the smile.
 */
export function alreadyShown(i: MixInputs, out: FaceMix = restingMix()): FaceMix {
  out.happy = Math.max(i.weights.happy, i.touch.pat, i.emote.happy);
  out.focused = 0.5 * i.weights.thinking;
  out.sleepy = Math.max(i.emote.sleepy, i.emote.nap, i.weights.asleep);
  out.surprised = 0;
  return out;
}

/** The shared dials each expression pulls toward (a pull of 1 lands exactly on the target). */
const PULL = {
  happy: { squint: 0.85, eyeBend: -0.3, smile: 1, glow: 1.15 },
  focused: { eyeOpen: 0.62, eyeBend: -0.08, smile: 0.06 },
  sleepy: { eyeOpen: 0.36, eyeBend: 0.12, smile: 0.12, glow: 0.85 },
  surprised: { eyeOpen: 1.32, smile: 0, squint: 0, glow: 1.15 },
} as const;

/**
 * Folds `mix` into the shared dials `out` (the mood with touch, feeling and the emote folded),
 * adding only what `shown` says is not there yet. With an all-zero mix `out` is left exactly as
 * it was.
 */
export function foldMix(out: MoodParams, mix: Readonly<FaceMix>, shown: Readonly<FaceMix>): MoodParams {
  const h = Math.max(0, mix.happy - shown.happy);
  if (h > 0) {
    out.squint += (PULL.happy.squint - out.squint) * h;
    out.eyeBend += (PULL.happy.eyeBend - out.eyeBend) * h;
    out.smile += (PULL.happy.smile - out.smile) * h;
    out.glow *= 1 + (PULL.happy.glow - 1) * h;
  }
  const f = Math.max(0, mix.focused - shown.focused);
  if (f > 0) {
    out.eyeOpen += (PULL.focused.eyeOpen - out.eyeOpen) * f;
    out.eyeBend += (PULL.focused.eyeBend - out.eyeBend) * f;
    out.smile += (PULL.focused.smile - out.smile) * f;
  }
  const z = Math.max(0, mix.sleepy - shown.sleepy);
  if (z > 0) {
    out.eyeOpen += (PULL.sleepy.eyeOpen - out.eyeOpen) * z;
    out.eyeBend += (PULL.sleepy.eyeBend - out.eyeBend) * z;
    out.smile += (PULL.sleepy.smile - out.smile) * z;
    out.glow *= 1 + (PULL.sleepy.glow - 1) * z;
  }
  const s = Math.max(0, mix.surprised - shown.surprised);
  if (s > 0) {
    out.eyeOpen += (Math.max(out.eyeOpen, PULL.surprised.eyeOpen) - out.eyeOpen) * s;
    out.squint += (PULL.surprised.squint - out.squint) * s;
    out.smile += (PULL.surprised.smile - out.smile) * s;
    out.glow *= 1 + (PULL.surprised.glow - 1) * s;
  }
  return out;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}
