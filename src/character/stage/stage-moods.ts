/**
 * The stage moods as data: how the light and the sky change for each mood. `night` is the stage
 * exactly as it has always been (every value equals what `scene.ts` and `backdrop.ts` set), so a
 * keeper with no mood looks as before. The others add real lights that shine on the models
 * (physically based materials take their colour), tint the rim lights and the key, fill and
 * ambient, recolour the sky behind and, for some, lay a thin fog.
 *
 * Pure data (no three.js objects): read by `stage-mood.ts`, tested by `stage-moods.test.ts`.
 */
import { PALETTE } from '../palette.ts';

export const STAGE_MOODS = ['night', 'neon', 'lamplight', 'dawn', 'starfield', 'celestial'] as const;
export type StageMood = (typeof STAGE_MOODS)[number];

/** A coloured light a mood adds: directional, shining from `position` toward the keeper. */
export interface MoodLight {
  readonly colour: number;
  readonly intensity: number;
  readonly position: readonly [number, number, number];
}

export interface MoodSpec {
  /** One line for a picker. */
  readonly name: string;
  /** The two rim lights behind the character (their strength stays the animator's). */
  readonly rims: readonly [number, number];
  readonly key: { readonly colour: number; readonly intensity: number };
  readonly fill: { readonly colour: number; readonly intensity: number };
  readonly ambient: { readonly colour: number; readonly intensity: number };
  /** Up to two extra lights: the mood's own coloured light on the models (0 intensity = none). */
  readonly lights: readonly [MoodLight, MoodLight];
  /** The sky: deep edge, middle, the glow behind the character, the wave crests. */
  readonly sky: { readonly deep: number; readonly mid: number; readonly high: number; readonly gold: number };
  /** Exponential fog density (0 = none) in the sky's deep colour. */
  readonly fog: number;
}

const DARK: MoodLight = { colour: 0x000000, intensity: 0, position: [0, 0, 0] };

export const MOOD_SPECS: Readonly<Record<StageMood, MoodSpec>> = {
  night: {
    name: 'Night',
    rims: [PALETTE.gold400, PALETTE.gold500],
    key: { colour: PALETTE.cream50, intensity: 1.25 },
    fill: { colour: PALETTE.navy500, intensity: 0.9 },
    ambient: { colour: PALETTE.navy500, intensity: 0.35 },
    lights: [DARK, DARK],
    sky: { deep: PALETTE.navy950, mid: PALETTE.navy800, high: PALETTE.navy600, gold: PALETTE.gold500 },
    fog: 0,
  },
  neon: {
    name: 'Neon city',
    rims: [0x1fd2d6, 0xe040fb],
    key: { colour: 0xb8d8ff, intensity: 0.75 },
    fill: { colour: 0x3a1a5a, intensity: 0.6 },
    ambient: { colour: 0x1a2a4a, intensity: 0.3 },
    lights: [
      { colour: 0x14e0e6, intensity: 2.6, position: [-4, 1, 0.3] },
      { colour: 0xf03cd0, intensity: 2.4, position: [4, 0.4, -0.2] },
    ],
    sky: { deep: 0x05060f, mid: 0x0c0f2a, high: 0x2a1450, gold: 0x22d6e0 },
    fog: 0.018,
  },
  lamplight: {
    name: 'Lamplight',
    rims: [0xffa64a, 0xff7a2a],
    key: { colour: 0xffd9a8, intensity: 1.1 },
    fill: { colour: 0x4a2a1a, intensity: 0.5 },
    ambient: { colour: 0x3a2418, intensity: 0.35 },
    lights: [
      { colour: 0xffb055, intensity: 1.5, position: [3, -0.2, 1.6] },
      { colour: 0xff8a3a, intensity: 0.8, position: [-2.6, -1.2, 1.4] },
    ],
    sky: { deep: 0x0b0706, mid: 0x1a1010, high: 0x3a2014, gold: 0xffa64a },
    fog: 0,
  },
  dawn: {
    name: 'Dawn',
    rims: [0xff9a7a, 0xffd0a0],
    key: { colour: 0xffe2c8, intensity: 1.3 },
    fill: { colour: 0x6a8ad8, intensity: 0.8 },
    ambient: { colour: 0x4a4a7a, intensity: 0.4 },
    lights: [
      { colour: 0xffb08a, intensity: 1.3, position: [-3.6, 0.6, 1] },
      { colour: 0x9ab8ff, intensity: 0.8, position: [3, 2, 1.5] },
    ],
    sky: { deep: 0x0c0c22, mid: 0x2a2048, high: 0x7a4a6a, gold: 0xffb08a },
    fog: 0.01,
  },
  starfield: {
    name: 'Starfield',
    rims: [0xa8c8ff, 0x6a8cff],
    key: { colour: 0xd8e4ff, intensity: 1.05 },
    fill: { colour: 0x1a2a5a, intensity: 0.7 },
    ambient: { colour: 0x141e3e, intensity: 0.3 },
    lights: [
      { colour: 0x8ab0ff, intensity: 1.4, position: [0, 3.6, 2] },
      { colour: 0xb8a0ff, intensity: 0.7, position: [3, -1, 2] },
    ],
    sky: { deep: 0x020309, mid: 0x060a1c, high: 0x16204a, gold: 0x9ab8ff },
    fog: 0,
  },
  celestial: {
    name: 'Celestial',
    rims: [0xffd27a, 0xfff0c0],
    key: { colour: 0xfff4dc, intensity: 1.3 },
    fill: { colour: 0x5a4a2a, intensity: 0.7 },
    ambient: { colour: 0x3a3020, intensity: 0.4 },
    lights: [
      { colour: 0xffdb8a, intensity: 1.6, position: [0, 4, 2.4] },
      { colour: 0xfff0c8, intensity: 0.9, position: [-3, 0, 2] },
    ],
    sky: { deep: 0x0c0906, mid: 0x1e170c, high: 0x4a3818, gold: 0xffd27a },
    fog: 0.008,
  },
};

/**
 * The mood each set brings when it glows (three of its pieces worn: the core stamps `set` on them).
 * One map, data only; a set not listed keeps the stage as it is.
 */
export const SET_MOODS: Readonly<Record<string, StageMood>> = {
  'deep-space': 'starfield',
  workshop: 'lamplight',
  'circuit-garden': 'dawn',
  'park-day': 'dawn',
  'rescue-ranger': 'neon',
  'cozy-den': 'lamplight',
  'island-linen': 'dawn',
  'studio-producer': 'neon',
  'sharp-suit': 'celestial',
  'market-morning': 'dawn',
  explorer: 'dawn',
  'gala-night': 'celestial',
  scholar: 'lamplight',
  'night-watch': 'starfield',
  'forest-keeper': 'dawn',
  'everyday-basics': 'night',
  'mas-band': 'neon',
  'wild-trail': 'dawn',
  'ark-pilgrim': 'celestial',
  'celestial-regalia': 'celestial',
};

export function isStageMood(value: unknown): value is StageMood {
  return typeof value === 'string' && (STAGE_MOODS as readonly string[]).includes(value);
}

/** The mood a wear list brings: the first glowing set's (pieces carry `set` only while it glows). */
export function moodOfWear(worn: readonly { readonly set?: unknown }[]): StageMood | null {
  for (const piece of worn) if (typeof piece.set === 'string' && SET_MOODS[piece.set]) return SET_MOODS[piece.set];
  return null;
}
