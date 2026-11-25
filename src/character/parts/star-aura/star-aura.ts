/**
 * The Star Aura part (slot `aura`, any species): a soft field of gold motes slowly orbiting
 * the whole body, thicker at the waist and drawn in toward the head and the base, so it reads
 * as a cloak of light rather than a ring. Motes behind the body are hidden by it (depth
 * tested), which gives the field its depth; each one twinkles on its own phase.
 *
 * Effects: `color` (the motes' warm colour), `count` (how many), `speed` (orbit speed
 * multiplier). Work quickens the orbit and brightens the field; asleep it dims.
 *
 * Positions are written into one preallocated buffer each frame (no allocation); the orbit
 * clock is accumulated, so a change of speed never makes the motes jump.
 */
import { BufferAttribute, BufferGeometry, Color, Group, Points } from 'three';
import { disposeTree } from '../../dispose-tree';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';
import { effectColour, effectNumber, type EffectValues } from '../effects';
import type { PartFrame, PartInstance } from '../part';

/** The field's shape (world units at anchor scale 1). */
const RADIUS_MIN = 1.05;
const RADIUS_MAX = 1.5;
const HALF_HEIGHT = 1.45;
const DEPTH_SQUASH = 0.85;
/** At full work the orbit runs this much faster and the motes this much brighter. */
const WORK_SPEED = 2.4;
const WORK_GLOW = 0.9;
const BASE_GLOW = 1.5;

interface Mote {
  angle: number;
  spin: number;
  radius: number;
  height: number;
  phase: number;
}

export function createStarAura(effects: EffectValues, random: () => number = Math.random): PartInstance {
  const count = Math.max(1, Math.round(effectNumber(effects, 'count')));
  const speed = effectNumber(effects, 'speed');
  const group = new Group();
  group.name = 'star-aura';

  const motes: Mote[] = [];
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brights = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const height = (random() * 2 - 1) * HALF_HEIGHT;
    // Ovoid: full radius at the waist, drawn in toward the head and the base.
    const taper = 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - (height / (HALF_HEIGHT * 1.1)) ** 2));
    motes.push({
      angle: random() * Math.PI * 2,
      spin: (0.07 + random() * 0.12) * (random() < 0.85 ? 1 : -1),
      radius: (RADIUS_MIN + random() * (RADIUS_MAX - RADIUS_MIN)) * taper,
      height,
      phase: random() * Math.PI * 2,
    });
    sizes[i] = 0.03 + random() * 0.04;
    brights[i] = 0.45 + random() * 0.75;
    phases[i] = random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.5);
  material.uniforms.uWarm.value = new Color(effectColour(effects, 'color'));
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  let clock = 0;

  function update(frame: PartFrame): void {
    const { motion, work } = frame;
    clock += frame.dt * motion.speed * speed * (1 + WORK_SPEED * work);
    const bob = 0.07 * motion.amplitude;
    for (let i = 0; i < count; i++) {
      const mote = motes[i];
      const angle = mote.angle + mote.spin * clock;
      positions[i * 3] = Math.cos(angle) * mote.radius;
      positions[i * 3 + 1] = mote.height + Math.sin(frame.time * 0.4 + mote.phase) * bob;
      positions[i * 3 + 2] = Math.sin(angle) * mote.radius * DEPTH_SQUASH;
    }
    geometry.getAttribute('position').needsUpdate = true;
    material.uniforms.uTime.value = frame.time;
    material.uniforms.uGlow.value = BASE_GLOW * (0.3 + 0.7 * frame.mood.presence) * (1 + WORK_GLOW * work);
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
