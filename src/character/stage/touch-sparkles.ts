/**
 * Touch sparkles: a few warm motes of light that rise and drift off the character's head
 * when it is patted (and a smaller puff on a swap). They share the glowing point sprite
 * of the halo (`glow-points-material.ts`), so they bloom in the same gold.
 *
 * A fixed pool of slots is reused round-robin; nothing allocates after creation. Points
 * live in world space (the group sits at the scene origin, unrotated).
 */
import { BufferAttribute, BufferGeometry, Group, Points, type Vector3 } from 'three';
import { disposeTree } from '../dispose-tree';
import { createGlowPointsMaterial } from './glow-points-material';

const SLOTS = 24;
const LIFE_SECONDS = 1.5;

interface Mote {
  bornAt: number;
  x: number;
  y: number;
  z: number;
  rise: number;
  drift: number;
  phase: number;
  size: number;
}

export interface TouchSparkles {
  readonly group: Group;
  /** Releases `count` motes around `origin` (world space) at `time` seconds. */
  burst(origin: Vector3, time: number, count: number, spread?: number): void;
  setPointScale(scale: number): void;
  update(time: number): void;
  dispose(): void;
}

export function createTouchSparkles(random: () => number = Math.random): TouchSparkles {
  const group = new Group();
  group.name = 'touch-sparkles';
  const positions = new Float32Array(SLOTS * 3);
  const sizes = new Float32Array(SLOTS);
  const brights = new Float32Array(SLOTS);
  const phases = new Float32Array(SLOTS);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.45);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  const motes: (Mote | null)[] = new Array(SLOTS).fill(null);
  let next = 0;

  function update(time: number): void {
    material.uniforms.uTime.value = time;
    motes.forEach((mote, i) => {
      const age = mote ? (time - mote.bornAt) / LIFE_SECONDS : 1;
      if (!mote || age >= 1) {
        brights[i] = 0;
        motes[i] = null;
        return;
      }
      if (age < 0) {
        brights[i] = 0; // staggered: not born yet
        return;
      }
      const lift = 1 - (1 - age) ** 2; // fast up, slowing as it fades
      positions[i * 3] = mote.x + Math.sin(age * 5 + mote.phase) * mote.drift;
      positions[i * 3 + 1] = mote.y + lift * mote.rise;
      positions[i * 3 + 2] = mote.z;
      sizes[i] = mote.size * (1 - 0.4 * age);
      brights[i] = 3.2 * Math.min(age * 8, 1) * (1 - age) ** 1.5;
    });
    for (const name of ['position', 'aSize', 'aBright']) geometry.getAttribute(name).needsUpdate = true;
  }

  return {
    group,
    burst(origin, time, count, spread = 0.38) {
      for (let k = 0; k < count; k++) {
        const angle = random() * Math.PI * 2;
        const radius = spread * Math.sqrt(random());
        motes[next] = {
          bornAt: time + k * 0.05,
          x: origin.x + Math.cos(angle) * radius,
          y: origin.y + (random() - 0.3) * 0.15,
          z: origin.z + Math.sin(angle) * radius * 0.5 + 0.2,
          rise: 0.35 + random() * 0.4,
          drift: 0.04 + random() * 0.08,
          phase: random() * Math.PI * 2,
          size: 0.07 + random() * 0.06,
        };
        phases[next] = random();
        next = (next + 1) % SLOTS;
      }
      geometry.getAttribute('aPhase').needsUpdate = true;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    update,
    dispose: () => disposeTree(group),
  };
}
