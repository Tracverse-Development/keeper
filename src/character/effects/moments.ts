/**
 * The moment effects as data: what each thinking and celebrate part (`parts/moment-catalog.ts`)
 * adds to its moment, from common to mythical, and how a worn one is read.
 *
 * Thinking styles layer on top of the shipped thinking (which every style keeps: the robot's
 * scanning eyes and rings, the puppy's tilt and thought bubble, the halo's waves, the data
 * motes): pulse rings of light, orbs on tilted orbits, a swirling stardust cloud, a vortex
 * pouring into the head, a comet looping on its tail, a turning beacon, a ring of sound bars and
 * a compass rose (all drawn by `thinking-aura.ts`), and streams the director throws from the head
 * (sleepy z letters, stars, fluttering pages). `dramaFloor` lifts how dramatic thinking looks even at rest (the
 * mythical vortex thinks at full drama always: `thinking.ts` `thinkDrama`). Celebrate styles say
 * what bursts at a celebration's moment (`EmoteSpec.cheerAt`): confetti, three firework shells,
 * a starburst (a blinding flare, rays of sparks and confetti), a fountain of welding embers,
 * petals, bouncing balls, rings of light rippling out with notes, a rainbow (`cheer-bursts.ts`)
 * or a shooting star (`cheer-bursts.ts`).
 *
 * Every style is scaled by the worn part's `intensity` (0.25 .. 2) and drawn in its `color`; the
 * colour each moment shipped in (`THINK_COLOUR`, `CHEER_COLOUR`) keeps the original palette, so
 * the classic effects worn with their defaults look exactly like wearing nothing.
 *
 * Pure (no three.js): tested by `moments.test.ts`; drawn by `thinking-aura.ts` and the director.
 */
import { CHEER_COLOUR, THINK_COLOUR } from '../parts/moment-catalog.ts';
import type { ResolvedWear } from '../parts/catalog.ts';

export interface ThinkStyle {
  /** The least drama thinking shows (0 = the shipped curve: 0.6 at rest, 1 flat out). */
  readonly dramaFloor: number;
  /** Data motes per second, as a share of the shipped rate. */
  readonly motes: number;
  /** Points in each pulse ring (two rings, staggered), 0 = no rings. */
  readonly pulse: number;
  /** Orbs on the tilted orbits, and the orbit radius (head units). */
  readonly orbit: number;
  readonly orbitRadius: number;
  /** Stardust points swirling round the head. */
  readonly cloud: number;
  /** Points spiralling up the vortex into the head. */
  readonly funnel: number;
  /** Points in the comet's tail (its head is the first), 0 = no comet. */
  readonly comet: number;
  /** Points along each of the beacon's two beams (plus its lamp), 0 = no beacon. */
  readonly beacon: number;
  /** Sound bars in the ring round the head (`BAR_POINTS` points each), 0 = none. */
  readonly bars: number;
  /** True: a compass rose over the head (a fixed `COMPASS_POINTS`), its needle swinging. */
  readonly compass: boolean;
  /** Sleepy z letters, stars and fluttering pages thrown from the head, per second (director). */
  readonly zzz: number;
  readonly stars: number;
  readonly pages: number;
}

/** A style's fields that are absent are nothing: the shipped styles read exactly as before. */
const NONE = { comet: 0, beacon: 0, bars: 0, compass: false, zzz: 0, stars: 0, pages: 0 } as const;

export type ThinkStyleId =
  | 'think-classic'
  | 'think-pulse'
  | 'think-orbit'
  | 'think-nebula'
  | 'think-vortex'
  | 'think-comet'
  | 'think-beacon'
  | 'think-dream'
  | 'think-wave'
  | 'think-compass'
  | 'think-pages';

const BASE = { dramaFloor: 0, motes: 1, pulse: 0, orbit: 0, orbitRadius: 0, cloud: 0, funnel: 0, ...NONE };

export const THINK_STYLES: Readonly<Record<ThinkStyleId, ThinkStyle>> = {
  'think-classic': BASE,
  'think-pulse': { ...BASE, pulse: 30 },
  'think-orbit': { ...BASE, dramaFloor: 0.25, orbit: 12, orbitRadius: 1.45 },
  'think-nebula': { ...BASE, dramaFloor: 0.7, motes: 1.4, orbit: 6, orbitRadius: 1.55, cloud: 110 },
  'think-vortex': { ...BASE, dramaFloor: 1, motes: 1.8, pulse: 30, orbit: 14, orbitRadius: 1.6, cloud: 60, funnel: 150 },
  'think-comet': { ...BASE, dramaFloor: 0.6, motes: 0.6, comet: 44, cloud: 30 },
  'think-beacon': { ...BASE, dramaFloor: 0.35, motes: 0.5, beacon: 22 },
  'think-dream': { ...BASE, dramaFloor: 0.3, motes: 0.3, zzz: 2.2, stars: 6, cloud: 40 },
  'think-wave': { ...BASE, dramaFloor: 0.2, motes: 0.6, bars: 20 },
  'think-compass': { ...BASE, dramaFloor: 0.35, motes: 0.6, compass: true },
  'think-pages': { ...BASE, dramaFloor: 0.2, motes: 0.4, pages: 12 },
};

/** Points in one sound bar of the wave, and in the compass rose (ring, points, needle). */
export const BAR_POINTS = 7;
export const COMPASS_POINTS = 76;

/** The aura points `style` draws at `intensity` (the layers `thinking-aura.ts` writes, in order). */
export function auraPoints(style: ThinkStyle, intensity: number): number {
  return (
    scaled(style.pulse, intensity) * 2 +
    scaled(style.orbit, intensity) +
    scaled(style.cloud, intensity) +
    scaled(style.funnel, intensity) +
    scaled(style.comet, intensity) +
    (style.beacon > 0 ? scaled(style.beacon, intensity) * 2 + 1 : 0) +
    scaled(style.bars, intensity) * BAR_POINTS +
    (style.compass ? COMPASS_POINTS : 0)
  );
}

/** Most points any style draws at intensity 2 (the aura's buffer size). */
export const AURA_CAPACITY = Math.max(...Object.values(THINK_STYLES).map((s) => auraPoints(s, 2)));

export interface CheerStyle {
  /** Confetti thrown from the top of the head. */
  readonly confetti: number;
  /** Gold sparkles from the head. */
  readonly sparkles: number;
  /** Firework shells above the head and sparks in each. */
  readonly shells: number;
  readonly shellSparks: number;
  /** A big flash at the head, and the rays of sparks thrown every way from it. */
  readonly flare: boolean;
  readonly rays: number;
  /** A fountain of welding embers from the head, petals and bouncing balls from the top. */
  readonly embers: number;
  readonly petals: number;
  readonly balls: number;
  /** Rings of light rippling out from the head, one after another, and notes floating up. */
  readonly ripples: number;
  readonly notes: number;
  /** A rainbow arcing over the keeper, and a shooting star streaking across (`cheer-bursts.ts`). */
  readonly rainbow: boolean;
  readonly shootingStar: boolean;
}

export type CheerStyleId =
  | 'cheer-confetti'
  | 'cheer-fireworks'
  | 'cheer-starburst'
  | 'cheer-sparks'
  | 'cheer-petals'
  | 'cheer-balls'
  | 'cheer-ripple'
  | 'cheer-rainbow'
  | 'cheer-shooting-star';

const QUIET = { confetti: 0, sparkles: 0, shells: 0, shellSparks: 0, flare: false, rays: 0, embers: 0, petals: 0, balls: 0, ripples: 0, notes: 0, rainbow: false, shootingStar: false };

export const CHEER_STYLES: Readonly<Record<CheerStyleId, CheerStyle>> = {
  'cheer-confetti': { ...QUIET, confetti: 56 },
  'cheer-fireworks': { ...QUIET, sparkles: 8, shells: 3, shellSparks: 38 },
  'cheer-starburst': { ...QUIET, confetti: 44, sparkles: 26, shells: 2, shellSparks: 28, flare: true, rays: 70 },
  'cheer-sparks': { ...QUIET, sparkles: 6, embers: 60 },
  'cheer-petals': { ...QUIET, sparkles: 6, petals: 46 },
  'cheer-balls': { ...QUIET, balls: 14 },
  'cheer-ripple': { ...QUIET, sparkles: 8, ripples: 5, notes: 6 },
  'cheer-rainbow': { ...QUIET, sparkles: 10, rainbow: true },
  'cheer-shooting-star': { ...QUIET, shootingStar: true },
};

/** Where each firework shell bursts (relative to the top of the head) and when (s after the cheer). */
export const SHELLS: readonly { readonly at: readonly [number, number, number]; readonly delay: number }[] = [
  { at: [-1.25, 0.3, 0.15], delay: 0 },
  { at: [1.2, 0.55, 0], delay: 0.28 },
  { at: [0.05, 0.85, -0.1], delay: 0.55 },
];

/** A worn moment, read: its style, its colour (null = the shipped palette) and its intensity. */
export interface Moment<S> {
  readonly style: S;
  readonly colour: number | null;
  readonly intensity: number;
}

function read<S>(worn: ResolvedWear | undefined, styles: Readonly<Record<string, S>>, classic: string, shipped: string): Moment<S> {
  const style = (worn && styles[worn.id]) || styles[classic];
  const colour = worn?.effects.color;
  const intensity = worn?.effects.intensity;
  return {
    style,
    colour: typeof colour === 'string' && colour !== shipped ? Number.parseInt(colour.slice(1), 16) : null,
    intensity: typeof intensity === 'number' ? intensity : 1,
  };
}

/** The thinking moment the worn `thinking` part gives (none = classic, unchanged). */
export function thinkingMoment(worn: ResolvedWear | undefined): Moment<ThinkStyle> {
  return read(worn, THINK_STYLES, 'think-classic', THINK_COLOUR);
}

/** The celebration the worn `celebrate` part gives, or null when none is worn (the shipped cues play). */
export function cheerMoment(worn: ResolvedWear | undefined): Moment<CheerStyle> | null {
  return worn ? read(worn, CHEER_STYLES, 'cheer-confetti', CHEER_COLOUR) : null;
}

/** `count` scaled by intensity, never below one when the style has any. */
export function scaled(count: number, intensity: number): number {
  return count > 0 ? Math.max(1, Math.round(count * intensity)) : 0;
}
