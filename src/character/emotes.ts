/**
 * The emote timelines: for each `Emote`, how long it plays, which effects it throws and when
 * (cues), and the pose it writes into the expression frame at any moment of its life.
 *
 * Timelines follow the animation principles that make a character read as alive:
 * anticipation (a crouch before the jump), squash and stretch (tall in the air, wide on
 * landing), follow-through (a wobble after), and slow in / slow out on every channel. Each
 * pose is a pure function of elapsed seconds, so an emote can be sampled at any frame rate
 * and tested at exact moments.
 *
 * Pattern: Strategy table (one pose function per emote). Pure (no three.js, no DOM):
 * tested by `emotes.test.ts`.
 */
import type { Emote } from './contract';
import type { EffectKind } from './effects/particle-kinds.ts';
import { resetExpression, type ExpressionFrame } from './expression-frame.ts';
import { band } from './work-level.ts';

/** Where on the body a cue's effect starts. */
export type CueOrigin = 'top' | 'head' | 'eye' | 'chest';

/** One effect thrown at `at` seconds into the emote. */
export interface EmoteCue {
  readonly at: number;
  readonly effect: EffectKind;
  readonly count: number;
  readonly from: CueOrigin;
}

export interface EmoteSpec {
  readonly seconds: number;
  readonly cues: readonly EmoteCue[];
  /** Writes the pose at `t` seconds (0..seconds) into `out` (channels not set stay at rest). */
  readonly pose: (t: number, out: ExpressionFrame) => void;
}

/** 0 -> 1 -> 0 over `total` seconds with eased `attack` and `release` (seconds). */
export function envelope(t: number, total: number, attack: number, release: number): number {
  if (!(t > 0) || t >= total) return 0;
  return band(t, 0, attack) * (1 - band(t, total - release, total));
}

/** A hop: crouch (anticipation), stretch in the air, squash on landing, then a wobble. */
function hop(t: number, out: ExpressionFrame, air: number, height: number): number {
  const crouch = band(t, 0, 0.16) * (1 - band(t, 0.16, 0.24));
  const k = Math.min(Math.max((t - 0.2) / air, 0), 1);
  const jump = Math.sin(Math.PI * k);
  const land = band(t, 0.18 + air, 0.24 + air) * (1 - band(t, 0.24 + air, 0.44 + air));
  const settle = Math.max(t - (0.44 + air), 0);
  const wobble = settle > 0 ? 0.035 * Math.sin(settle * 26) * Math.exp(-settle * 7) : 0;
  out.squash = -0.13 * crouch + 0.15 * jump * (1 - k) * 1.6 - 0.11 * land + wobble;
  out.lift = height * jump;
  out.pitch = 0.1 * crouch - 0.08 * jump;
  return k;
}

const CELEBRATE_SECONDS = 1.6;
const STREAK_SECONDS = 2.2;

export const EMOTE_SPECS: Readonly<Record<Emote, EmoteSpec>> = {
  wave: {
    seconds: 2.2,
    cues: [{ at: 0.35, effect: 'sparkle', count: 5, from: 'top' }],
    pose(t, out) {
      const e = envelope(t, 2.2, 0.3, 0.45);
      out.swing = Math.sin(((t - 0.3) * Math.PI * 2) / 0.5) * e;
      out.paw = e;
      out.happy = e;
      out.roll = 0.05 * out.swing;
      out.lift = 0.03 * e;
    },
  },
  celebrate: {
    seconds: CELEBRATE_SECONDS,
    cues: [
      { at: 0.2, effect: 'sparkle', count: 18, from: 'head' },
      { at: 0.7, effect: 'sparkle', count: 8, from: 'chest' },
    ],
    pose(t, out) {
      hop(t, out, 0.45, 0.42);
      out.stars = envelope(t, CELEBRATE_SECONDS, 0.15, 0.4);
      out.happy = 0.6 * out.stars;
    },
  },
  streak: {
    seconds: STREAK_SECONDS,
    cues: [
      { at: 0.22, effect: 'confetti', count: 56, from: 'top' },
      { at: 0.22, effect: 'sparkle', count: 14, from: 'head' },
      { at: 0.85, effect: 'sparkle', count: 10, from: 'chest' },
    ],
    pose(t, out) {
      const k = hop(t, out, 0.6, 0.55);
      out.yaw = Math.PI * 2 * band(k, 0.05, 0.95);
      out.stars = envelope(t, STREAK_SECONDS, 0.15, 0.5);
      out.happy = 0.6 * out.stars;
    },
  },
  love: {
    seconds: 2.1,
    cues: [
      { at: 0.1, effect: 'heart', count: 3, from: 'top' },
      { at: 0.55, effect: 'heart', count: 2, from: 'top' },
      { at: 1.0, effect: 'heart', count: 3, from: 'top' },
      { at: 1.4, effect: 'heart', count: 2, from: 'top' },
    ],
    pose(t, out) {
      const e = envelope(t, 2.1, 0.25, 0.5);
      out.hearts = e;
      out.happy = 0.5 * e;
      out.roll = 0.07 * e * Math.sin(t * 2.4);
      out.squash = 0.03 * e * Math.max(0, Math.sin(t * 7)) ** 4;
      out.lift = 0.05 * e;
    },
  },
  surprised: {
    seconds: 1.2,
    cues: [{ at: 0.02, effect: 'puff', count: 10, from: 'top' }],
    pose(t, out) {
      const jolt = band(t, 0, 0.07) * (1 - band(t, 0.12, 0.6));
      const rebound = band(t, 0.12, 0.22) * (1 - band(t, 0.22, 0.5));
      out.squash = 0.15 * jolt - 0.05 * rebound;
      out.lift = 0.13 * jolt;
      out.pitch = -0.12 * jolt;
      out.wide = envelope(t, 1.2, 0.08, 0.5);
      out.mouthO = out.wide;
    },
  },
  wink: {
    seconds: 1.0,
    cues: [{ at: 0.2, effect: 'sparkle', count: 3, from: 'eye' }],
    pose(t, out) {
      const e = envelope(t, 1.0, 0.12, 0.3);
      out.wink = band(t, 0.06, 0.16) * (1 - band(t, 0.5, 0.66));
      out.roll = 0.09 * e;
      out.happy = 0.55 * e;
    },
  },
  sleepy: {
    seconds: 3.4,
    cues: [
      { at: 1.0, effect: 'zzz', count: 1, from: 'top' },
      { at: 1.8, effect: 'zzz', count: 1, from: 'top' },
      { at: 2.6, effect: 'zzz', count: 1, from: 'top' },
    ],
    pose(t, out) {
      const yawn = band(t, 0.2, 0.9) * (1 - band(t, 1.5, 2.1));
      out.mouthO = yawn;
      out.squash = 0.07 * yawn;
      out.pitch = -0.1 * yawn;
      out.sleepy = Math.max(0.85 * envelope(t, 3.4, 0.4, 0.8), yawn);
    },
  },
  stretch: {
    seconds: 2.4,
    cues: [],
    pose(t, out) {
      const crouch = band(t, 0, 0.15) * (1 - band(t, 0.15, 0.3));
      const reach = band(t, 0.15, 0.8) * (1 - band(t, 1.4, 2.0));
      const shake = Math.max(t - 1.8, 0);
      out.squash = -0.04 * crouch + 0.1 * reach;
      out.pitch = -0.12 * reach;
      out.happy = reach;
      out.roll = shake > 0 ? 0.045 * Math.sin(shake * 20) * Math.exp(-shake * 5) : 0;
    },
  },
  'look-around': {
    seconds: 2.8,
    cues: [],
    pose(t, out) {
      out.look = envelope(t, 2.8, 0.3, 0.5);
      out.lookX = -0.75 * band(t, 0.3, 0.7) + 1.5 * band(t, 1.1, 1.6) - 0.75 * band(t, 2.0, 2.5);
      out.lookY = 0.12 * Math.sin(t * 2.2);
      out.roll = -0.04 * out.lookX * out.look;
    },
  },
  nod: {
    seconds: 0.9,
    cues: [],
    pose(t, out) {
      const e = envelope(t, 0.9, 0.05, 0.3);
      out.pitch = 0.16 * Math.max(0, Math.sin((t * Math.PI * 2) / 0.45)) * e;
      out.happy = 0.3 * e;
    },
  },
};

/** Every emote name, in the contract's order. */
export const EMOTE_NAMES = Object.keys(EMOTE_SPECS) as readonly Emote[];

/** True when `value` is a known emote (guards names arriving from outside). */
export function isEmote(value: unknown): value is Emote {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMOTE_SPECS, value);
}

/** Writes `emote`'s pose `elapsed` seconds in into `out` (all channels at rest outside its life). */
export function sampleEmote(emote: Emote | null, elapsed: number, out: ExpressionFrame): ExpressionFrame {
  resetExpression(out);
  if (!emote) return out;
  const spec = EMOTE_SPECS[emote];
  if (elapsed > 0 && elapsed < spec.seconds) spec.pose(elapsed, out);
  return out;
}
