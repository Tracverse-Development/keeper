/**
 * Rising embers: a few tiny amber sparks that drift up off the robot's head and shoulders
 * when it works near its limit, like heat leaving a hot machine (tasteful: sparse, small,
 * fading in and out, never smoke).
 *
 * Each ember runs its own endless loop (rise, sway, fade) from a fixed seed, so nothing is
 * random per frame and nothing allocates; `intensity` 0 hides every ember (zero brightness
 * draws nothing), which keeps the resting robot exactly as it was.
 */
import { BufferAttribute, BufferGeometry, Color, Group, Points } from 'three';
import { disposeTree } from '../../dispose-tree';
import { PALETTE } from '../../palette';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';

const COUNT = 18;
/** Where embers start (rig space, around the crown and shoulders) and how far they rise. */
const START_Y = 1.3;
const SPREAD_X = 1.0;
const RISE = 0.85;

export interface RobotEmbers {
  readonly group: Group;
  /** `intensity` 0..1 (how many show and how bright), `speed` the reduced-motion multiplier. */
  update(time: number, intensity: number, speed: number): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

/** A fixed pseudo-random value in 0..1 for seed `n` (deterministic: no Math.random). */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function createRobotEmbers(): RobotEmbers {
  const group = new Group();
  group.name = 'embers';
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const brights = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const seeds = Array.from({ length: COUNT }, (_, i) => ({
    x: (seeded(i) * 2 - 1) * SPREAD_X,
    z: 0.1 + seeded(i + 40) * 0.45,
    rate: 0.32 + seeded(i + 80) * 0.3,
    offset: seeded(i + 120),
    sway: 0.03 + seeded(i + 160) * 0.06,
    // Embers near the edges start lower (shoulders), central ones off the crown.
    lift: -0.8 * Math.abs(seeded(i) * 2 - 1) ** 1.5,
    threshold: seeded(i + 200),
  }));
  for (let i = 0; i < COUNT; i++) {
    sizes[i] = 0.045 + seeded(i + 240) * 0.035;
    phases[i] = seeded(i + 280);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.6);
  material.uniforms.uWarm.value = new Color(PALETTE.heatAmber);
  material.uniforms.uHot.value = new Color(PALETTE.heatCore);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  return {
    group,
    update(time, intensity, speed) {
      material.uniforms.uTime.value = time;
      for (let i = 0; i < COUNT; i++) {
        const seed = seeds[i];
        // Fewer embers at low intensity: each one joins once intensity passes its threshold.
        const share = Math.min(Math.max((intensity - seed.threshold * 0.7) / 0.3, 0), 1);
        if (share <= 0) {
          brights[i] = 0;
          continue;
        }
        const cycle = time * seed.rate * speed + seed.offset;
        const age = cycle - Math.floor(cycle);
        positions[i * 3] = seed.x * (1 - 0.3 * age) + Math.sin(cycle * 6.283 * 1.3 + seed.offset * 9) * seed.sway;
        positions[i * 3 + 1] = START_Y + seed.lift + age * RISE;
        positions[i * 3 + 2] = seed.z;
        brights[i] = 3.4 * share * Math.sin(age * Math.PI) ** 1.2;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(group),
  };
}
