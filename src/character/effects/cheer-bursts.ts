/**
 * The celebration bursts that are placed, not thrown: a rainbow drawn band by band from left to
 * right round the keeper's head (the stage frames the keeper closely, so it stays low and wide) with sparkles at both feet, and a shooting star streaking down across the
 * sky to burst over the head. Both are laid out from the top of the head (`top`, world space) as
 * still points (painted `band`s for the rainbow, light-adding `glow`s for the star's trail) at exact points with rising delays, so the sweep is timed by the pool.
 *
 * Pure placement over the effect layer's `burst` (no three.js objects of its own; one scratch
 * point reused, so a celebration allocates nothing). Driven by `emote-director.ts`.
 */
import type { EffectLayer } from './effect-layer';
import type { Point3 } from './particle-pool';

/** The rainbow's seven bands, outer (red) to inner (violet). */
const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe14a, 0x5cd65c, 0x3fa8ff, 0x5a5aff, 0xb06aff] as const;
/** Its outer radius, the step between bands, how far below the top its centre sits, and how far back. */
const RAINBOW_RADIUS = 1.5;
const RAINBOW_STEP = 0.075;
const RAINBOW_DROP = 1.35;
const RAINBOW_BACK = -0.5;
/** Glows per band and the seconds the arc takes to draw from end to end. */
const RAINBOW_POINTS = 18;
const RAINBOW_SWEEP = 0.75;
/** The shooting star: where it starts and ends (from the top of the head), its flight and trail. */
const STAR_FROM = [-2.4, 0.3, -0.3] as const;
const STAR_TO = [0.45, -0.35, 0.3] as const;
const STAR_FLIGHT = 0.5;
const STAR_TRAIL = 30;

/** A point you can write (a three.js Vector3 works). */
interface Scratch extends Point3 {
  set(x: number, y: number, z: number): unknown;
}

/** Counts scaled by the worn intensity and reduced motion (the director's own rule). */
export type Scaler = (count: number) => number;

/** Draws the rainbow over `top`; its end sparkles take `colour` (null: the sparkle golds). */
export function burstRainbow(effects: EffectLayer, top: Point3, at: Scratch, time: number, n: Scaler, colour: number | null): void {
  RAINBOW.forEach((hex, band) => {
    const r = RAINBOW_RADIUS - band * RAINBOW_STEP;
    for (let k = 0; k < RAINBOW_POINTS; k++) {
      const u = k / (RAINBOW_POINTS - 1);
      const a = Math.PI * (1 - u);
      at.set(top.x + Math.cos(a) * r, top.y - RAINBOW_DROP + Math.sin(a) * r, top.z + RAINBOW_BACK);
      effects.burst('band', at, time + u * RAINBOW_SWEEP, 1, 0, hex);
    }
  });
  const feet = RAINBOW_RADIUS - (RAINBOW.length / 2) * RAINBOW_STEP;
  for (const side of [-1, 1]) {
    at.set(top.x + side * feet, top.y - RAINBOW_DROP + 0.1, top.z + RAINBOW_BACK);
    effects.burst('sparkle', at, time + (side < 0 ? 0 : RAINBOW_SWEEP), n(10), 0.03, colour);
  }
}

/** Streaks a shooting star across to the head, then bursts it (a flare, rays of sparks, sparkles). */
export function burstShootingStar(effects: EffectLayer, top: Point3, at: Scratch, time: number, n: Scaler, colour: number | null): void {
  for (let k = 0; k < STAR_TRAIL; k++) {
    const u = k / (STAR_TRAIL - 1);
    at.set(top.x + STAR_FROM[0] + (STAR_TO[0] - STAR_FROM[0]) * u, top.y + STAR_FROM[1] + (STAR_TO[1] - STAR_FROM[1]) * u, top.z + STAR_FROM[2] + (STAR_TO[2] - STAR_FROM[2]) * u);
    effects.burst('glow', at, time + u * STAR_FLIGHT, 1, 0, colour);
    if (k % 3 === 0) effects.burst('sparkle', at, time + u * STAR_FLIGHT, 1, 0, colour);
  }
  at.set(top.x + STAR_TO[0], top.y + STAR_TO[1], top.z + STAR_TO[2]);
  const bang = time + STAR_FLIGHT;
  effects.burst('flare', at, bang, 1, 0, colour);
  effects.burst('spark', at, bang, n(60), 0.002, colour);
  effects.burst('sparkle', at, bang + 0.05, n(18), 0.01, colour);
}
