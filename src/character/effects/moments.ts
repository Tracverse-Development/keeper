/**
 * The moment effects as data: what each thinking and celebrate part (`parts/moment-catalog.ts`)
 * adds to its moment, from common to mythical, and how a worn one is read.
 *
 * Thinking styles layer on top of the shipped thinking (which every style keeps: the robot's
 * scanning eyes and rings, the puppy's tilt and thought bubble, the halo's waves, the data
 * motes): pulse rings of light, orbs on tilted orbits, a swirling stardust cloud, and a vortex
 * pouring into the head. `dramaFloor` lifts how dramatic thinking looks even at rest (the
 * mythical vortex thinks at full drama always: `thinking.ts` `thinkDrama`). Celebrate styles say
 * what bursts at a celebration's moment (`EmoteSpec.cheerAt`): confetti, three firework shells,
 * or a starburst (a blinding flare, rays of sparks and confetti).
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
}

export type ThinkStyleId = 'think-classic' | 'think-pulse' | 'think-orbit' | 'think-nebula' | 'think-vortex';

export const THINK_STYLES: Readonly<Record<ThinkStyleId, ThinkStyle>> = {
  'think-classic': { dramaFloor: 0, motes: 1, pulse: 0, orbit: 0, orbitRadius: 0, cloud: 0, funnel: 0 },
  'think-pulse': { dramaFloor: 0, motes: 1, pulse: 30, orbit: 0, orbitRadius: 0, cloud: 0, funnel: 0 },
  'think-orbit': { dramaFloor: 0.25, motes: 1, pulse: 0, orbit: 12, orbitRadius: 1.45, cloud: 0, funnel: 0 },
  'think-nebula': { dramaFloor: 0.7, motes: 1.4, pulse: 0, orbit: 6, orbitRadius: 1.55, cloud: 110, funnel: 0 },
  'think-vortex': { dramaFloor: 1, motes: 1.8, pulse: 30, orbit: 14, orbitRadius: 1.6, cloud: 60, funnel: 150 },
};

/** Most points any style draws at intensity 2 (the aura's buffer size). */
export const AURA_CAPACITY = 2 * (2 * 30 + 14 + 110 + 150);

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
}

export type CheerStyleId = 'cheer-confetti' | 'cheer-fireworks' | 'cheer-starburst';

export const CHEER_STYLES: Readonly<Record<CheerStyleId, CheerStyle>> = {
  'cheer-confetti': { confetti: 56, sparkles: 0, shells: 0, shellSparks: 0, flare: false, rays: 0 },
  'cheer-fireworks': { confetti: 0, sparkles: 8, shells: 3, shellSparks: 38, flare: false, rays: 0 },
  'cheer-starburst': { confetti: 44, sparkles: 26, shells: 2, shellSparks: 28, flare: true, rays: 70 },
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
