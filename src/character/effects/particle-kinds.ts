/**
 * The effect kinds the character can throw into the scene, as data: how many may live at
 * once, how they are launched (speed, direction, cone), how they fall and slow down, how big
 * and bright they are, how they spin and wobble, the shape the shader draws and the brand
 * colours each particle picks from.
 *
 *   sparkle   - four-point gold stars (celebrate, a wink's glint)
 *   heart     - little hearts that float up and sway (love, a pat)
 *   puff      - a soft cream ring of smoke (a poke, surprise)
 *   mote      - tiny data squares drifting up while it thinks or works
 *   confetti  - tumbling paper in brand colours (a quiz streak)
 *   zzz       - a sleepy "z" drifting up and away (drowsy, a yawn)
 *   note      - a musical note floating up and swaying (humming)
 *   spark     - a hot point thrown every way at once (fireworks, the starburst)
 *   flare     - one big bright star that blooms and fades (the starburst's flash)
 *   orb       - a soft round glow (the thinking aura's orbits, clouds and vortex: `thinking-aura.ts`)
 *
 * Pure data (no three.js): read by `particle-pool.ts` (motion) and `effect-layer.ts` (drawing).
 */
import { PALETTE } from '../palette.ts';

export type EffectKind = 'sparkle' | 'heart' | 'puff' | 'mote' | 'confetti' | 'zzz' | 'note' | 'spark' | 'flare';

/** The shape the effect shader draws for a kind (a `#define SHAPE` per material). */
export const SHAPES: Readonly<Record<EffectKind, number>> = { sparkle: 0, heart: 1, puff: 2, mote: 3, confetti: 4, zzz: 5, note: 6, spark: 7, flare: 9 };
/** The thinking aura's soft orb (`thinking-aura.ts`; not a pooled kind). */
export const AURA_SHAPE = 8;

export type Range = readonly [number, number];

export interface KindSpec {
  /** Most particles of this kind alive at once (the pool size; the oldest is reused). */
  readonly capacity: number;
  /** Seconds a particle lives. */
  readonly life: Range;
  /** Launch speed (world units/s) along `direction`, scattered inside a cone of `cone` radians. */
  readonly speed: Range;
  readonly direction: readonly [number, number, number];
  readonly cone: number;
  /** Spawn scatter radius around the origin. */
  readonly scatter: number;
  /** Vertical acceleration (negative falls) and exponential drag on the launch velocity (1/s). */
  readonly gravity: number;
  readonly drag: number;
  /** World size at birth, and the size multiplier reached at death (1 = steady). */
  readonly size: Range;
  readonly grow: number;
  /** The angle at birth (radians; a "z" starts upright, confetti any way) and spin (rad/s). */
  readonly angle: Range;
  readonly spin: Range;
  /** A sideways sway (world units) at `swayRate` rad/s. */
  readonly sway: number;
  readonly swayRate: number;
  /** Peak brightness (above 1 blooms) and whether the kind adds light (else it is painted on). */
  readonly bright: number;
  readonly additive: boolean;
  /** Brand colours a particle picks from at birth. */
  readonly colours: readonly number[];
}

const UP = [0, 1, 0] as const;

export const EFFECT_KINDS: Readonly<Record<EffectKind, KindSpec>> = {
  sparkle: {
    capacity: 64,
    life: [0.7, 1.3],
    speed: [1.5, 2.8],
    direction: UP,
    cone: 1.6,
    scatter: 0.35,
    gravity: -1.4,
    drag: 3.2,
    size: [0.14, 0.26],
    grow: 0.3,
    angle: [0, Math.PI * 2],
    spin: [-3, 3],
    sway: 0,
    swayRate: 0,
    bright: 2.6,
    additive: true,
    colours: [PALETTE.gold300, PALETTE.cream50, PALETTE.gold400],
  },
  heart: {
    capacity: 24,
    life: [1.4, 2],
    speed: [0.35, 0.55],
    direction: [0, 1, 0.5],
    cone: 0.6,
    scatter: 0.3,
    gravity: 0.12,
    drag: 0.8,
    size: [0.18, 0.26],
    grow: 1.15,
    angle: [-0.3, 0.3],
    spin: [-0.6, 0.6],
    sway: 0.09,
    swayRate: 3.2,
    bright: 1.05,
    additive: true,
    colours: [PALETTE.tongue400, PALETTE.gold300, PALETTE.tongue400],
  },
  puff: {
    capacity: 24,
    life: [0.45, 0.7],
    speed: [1.2, 1.9],
    direction: [0, 1, 0.4],
    cone: 1.9,
    scatter: 0.2,
    gravity: 0.3,
    drag: 5,
    size: [0.16, 0.24],
    grow: 2.2,
    angle: [0, Math.PI * 2],
    spin: [-1, 1],
    sway: 0,
    swayRate: 0,
    bright: 1.3,
    additive: false,
    colours: [PALETTE.cream100, PALETTE.cream300],
  },
  mote: {
    capacity: 48,
    life: [1.2, 2],
    speed: [0.25, 0.55],
    direction: UP,
    cone: 0.9,
    scatter: 0.9,
    gravity: 0.15,
    drag: 0.6,
    size: [0.06, 0.1],
    grow: 0.6,
    angle: [0, Math.PI * 2],
    spin: [-2, 2],
    sway: 0.05,
    swayRate: 2,
    bright: 3,
    additive: true,
    colours: [PALETTE.workCyanEdge, PALETTE.workCyanCore, PALETTE.gold300],
  },
  confetti: {
    capacity: 96,
    life: [1.6, 2.4],
    speed: [1.6, 2.6],
    direction: UP,
    cone: 1.0,
    scatter: 0.3,
    gravity: -2.8,
    drag: 1.1,
    size: [0.16, 0.24],
    grow: 1,
    angle: [0, Math.PI * 2],
    spin: [-9, 9],
    sway: 0.12,
    swayRate: 4.5,
    bright: 1.25,
    additive: false,
    colours: [PALETTE.gold300, PALETTE.gold500, PALETTE.cream50, PALETTE.workCyanEdge, PALETTE.tongue400],
  },
  zzz: {
    capacity: 8,
    life: [2.2, 2.8],
    speed: [0.32, 0.42],
    direction: [0.55, 1, 0.1],
    cone: 0.15,
    scatter: 0.05,
    gravity: 0,
    drag: 0,
    size: [0.2, 0.26],
    grow: 1.6,
    angle: [-0.15, 0.15],
    spin: [-0.35, -0.15],
    sway: 0.08,
    swayRate: 2.4,
    bright: 1.3,
    additive: false,
    colours: [PALETTE.cream100, PALETTE.gold300],
  },
  note: {
    capacity: 12,
    life: [1.8, 2.4],
    speed: [0.38, 0.55],
    direction: [0.35, 1, 0.25],
    cone: 0.5,
    scatter: 0.15,
    gravity: 0.05,
    drag: 0.4,
    size: [0.2, 0.27],
    grow: 1.15,
    angle: [-0.25, 0.25],
    spin: [-0.4, 0.4],
    sway: 0.12,
    swayRate: 3,
    bright: 1.5,
    additive: true,
    colours: [PALETTE.gold300, PALETTE.cream50, PALETTE.gold400],
  },
  spark: {
    capacity: 128,
    life: [0.8, 1.4],
    speed: [1.6, 2.6],
    direction: UP,
    cone: Math.PI,
    scatter: 0.05,
    gravity: -1.1,
    drag: 2.4,
    size: [0.07, 0.12],
    grow: 0.4,
    angle: [0, 0],
    spin: [0, 0],
    sway: 0,
    swayRate: 0,
    bright: 3.2,
    additive: true,
    colours: [PALETTE.gold300, PALETTE.cream50, PALETTE.heatCore],
  },
  flare: {
    capacity: 4,
    life: [0.6, 0.7],
    speed: [0, 0],
    direction: UP,
    cone: 0,
    scatter: 0,
    gravity: 0,
    drag: 0,
    size: [1.6, 1.8],
    grow: 1.9,
    angle: [0, Math.PI / 4],
    spin: [0.6, 1.2],
    sway: 0,
    swayRate: 0,
    bright: 4,
    additive: true,
    colours: [PALETTE.cream50],
  },
};
