/**
 * The Drift Aura (slot `aura`, any species, floating): something drifting in the air round the keeper,
 * drawn as glowing point sprites like the Star Aura (`star-aura.ts`). One kit, four kinds of drift,
 * picked by `style`:
 *   0 pollen     - fine golden pollen rising slowly and swaying, drifting back down at the top
 *   1 night sky  - a wide shell of faint stars round the keeper, twinkling hard, turning very slowly
 *   2 fireflies  - fireflies wandering on looping paths, each blinking on and off on its own beat
 *   3 lantern    - a few big warm orbs of lantern light orbiting slowly, with a warm light that falls
 *                  on the keeper
 *
 * Pattern: Strategy by data: each style is a `Drift` spec (its field, sizes, glow and a `place` step
 * that writes one particle's position and brightness). Effects: `color`, `count` (lantern: a quarter
 * as many orbs, at least three), `speed`, `style`. Work quickens the drift and brightens it. Positions
 * go into one preallocated buffer each frame (no allocation); the clock is accumulated, so a change
 * of speed never makes particles jump.
 */
import { BufferAttribute, BufferGeometry, Color, Group, PointLight, Points } from 'three';
import { disposeTree } from '../../dispose-tree';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';

const STYLES = 4;
const WORK_SPEED = 1.8;
const WORK_GLOW = 0.7;
/** The lantern's warm light on the keeper, per unit of glow (kept low: it tints, never floods, a face). */
const LAMP = 0.5;

/** One particle's fixed traits, drawn once. */
interface Seed {
  readonly a: number;
  readonly r: number;
  readonly h: number;
  readonly phase: number;
  readonly rate: number;
}

interface Drift {
  /** Size range (world units) and base brightness. */
  readonly size: readonly [number, number];
  readonly bright: number;
  readonly glow: number;
  /** The material's own twinkle (0 = steady). */
  readonly twinkle: number;
  /** How many particles for a `count` (lantern: few, big orbs). */
  readonly many: (count: number) => number;
  /** Writes particle `s`'s position into `out` at clock `t` (s) and returns its brightness factor. */
  place(s: Seed, t: number, out: Float32Array, k: number): number;
}

const TAU = Math.PI * 2;

const DRIFTS: readonly Drift[] = [
  {
    // Pollen: rises through a 3-unit column, wrapping back to the bottom; sways sideways.
    size: [0.06, 0.12], bright: 1.2, glow: 2, twinkle: 0.3, many: (n) => n,
    place(s, t, out, k) {
      const y = ((s.h + t * 0.08 * s.rate) % 1 + 1) % 1;
      const a = s.a + t * 0.05 * s.rate;
      const r = s.r * (0.9 + 0.1 * Math.sin(t * 0.7 + s.phase));
      out[k] = Math.cos(a) * r + 0.08 * Math.sin(t * 0.9 + s.phase);
      out[k + 1] = -1.6 + y * 3.2;
      out[k + 2] = Math.sin(a) * r * 0.85;
      return Math.sin(y * Math.PI) ** 0.6;
    },
  },
  {
    // Night sky: a wide shell (radius 1.6..2.3) of stars, turning slowly; a few are brighter.
    size: [0.05, 0.14], bright: 1.3, glow: 2, twinkle: 0.9, many: (n) => n,
    place(s, t, out, k) {
      const a = s.a + t * 0.015;
      const lat = (s.h - 0.5) * 2.2;
      const r = 1.6 + s.r * 0.45;
      out[k] = Math.cos(a) * Math.cos(lat * 0.6) * r;
      out[k + 1] = 0.2 + Math.sin(lat * 0.6) * r * 0.8;
      out[k + 2] = Math.sin(a) * Math.cos(lat * 0.6) * r * 0.7 - 0.3;
      return s.rate > 1.35 ? 2 : 0.7;
    },
  },
  {
    // Fireflies: looping Lissajous paths round the body; each blinks on for a moment on its own beat.
    size: [0.12, 0.2], bright: 2.2, glow: 2.2, twinkle: 0, many: (n) => Math.max(6, Math.round(n * 0.6)),
    place(s, t, out, k) {
      const u = t * 0.25 * s.rate + s.phase;
      const r = 0.9 + s.r * 0.6 + 0.2 * Math.sin(u * 1.3);
      out[k] = Math.cos(s.a + u * 0.6) * r;
      out[k + 1] = -1.3 + s.h * 2.6 + 0.3 * Math.sin(u * 1.7);
      out[k + 2] = Math.sin(s.a + u * 0.6) * r * 0.8;
      const beat = ((t * 0.35 * s.rate + s.phase) % 1 + 1) % 1;
      return beat < 0.45 ? Math.sin((beat / 0.45) * Math.PI) ** 2 : 0.04;
    },
  },
  {
    // Lantern: a few big soft orbs on a slow tilted orbit round the waist, breathing.
    size: [0.6, 0.9], bright: 1.3, glow: 1.4, twinkle: 0.15, many: (n) => Math.min(Math.max(3, Math.round(n / 4)), 30),
    place(s, t, out, k) {
      const a = s.a + t * 0.12;
      const r = 1.2 + s.r * 0.25;
      out[k] = Math.cos(a) * r;
      out[k + 1] = -0.4 + (s.h - 0.5) * 1.6 + Math.sin(a * 2 + s.phase) * 0.15;
      out[k + 2] = Math.sin(a) * r * 0.8;
      return 0.8 + 0.2 * Math.sin(t * 1.3 + s.phase);
    },
  },
];

export function createDriftAura(effects: EffectValues, random: () => number = Math.random): PartInstance {
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const drift = DRIFTS[style];
  const count = Math.max(1, drift.many(Math.round(effectNumber(effects, 'count'))));
  const speed = effectNumber(effects, 'speed');
  const colour = effectColour(effects, 'color');
  const group = new Group();
  group.name = 'drift-aura';

  const seeds: Seed[] = Array.from({ length: count }, (_, i) => ({ a: (i / count) * TAU + random() * 0.6, r: random(), h: random(), phase: random() * TAU, rate: 0.6 + random() * 0.9 }));
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count).map(() => drift.size[0] + random() * (drift.size[1] - drift.size[0]));
  const base = new Float32Array(count).map(() => drift.bright * (0.6 + random() * 0.6));
  const brights = new Float32Array(count);
  const phases = new Float32Array(count).map(() => random());
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(drift.twinkle);
  material.uniforms.uWarm.value = new Color(colour);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);
  // The lantern's light falls on the keeper; the other drifts are too faint to light anything.
  const lamp = style === 3 ? new PointLight(colour, 0, 4.5, 2) : null;
  if (lamp) {
    lamp.position.set(0, 0.2, 1.1);
    group.add(lamp);
  }

  let clock = 0;
  function update(frame: PartFrame): void {
    clock += frame.dt * frame.motion.speed * speed * (1 + WORK_SPEED * frame.work);
    for (let i = 0; i < count; i++) brights[i] = base[i] * drift.place(seeds[i], clock, positions, i * 3);
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('aBright').needsUpdate = true;
    material.uniforms.uTime.value = frame.time;
    const glow = drift.glow * (0.35 + 0.65 * frame.mood.presence) * (1 + WORK_GLOW * frame.work);
    material.uniforms.uGlow.value = glow;
    if (lamp) lamp.intensity = LAMP * glow;
  }

  return {
    group,
    update,
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(group),
  };
}
