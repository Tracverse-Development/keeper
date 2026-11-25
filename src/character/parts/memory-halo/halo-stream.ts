/**
 * The halo's thinking stream: while the keeper thinks, small sparks leave the halo's nodes and
 * flow INTO the head, the picture of it querying its DKG memory. Each spark (a bright head and
 * a short fading trail) runs an endless loop from a fixed seed: pick a node, arc up and dive
 * into the crown speeding up, fade as it arrives; every loop picks a different node, so the
 * stream wanders around the whole graph.
 *
 * It works in the halo's orbit space (the node positions the graph already computes), so it
 * follows the spin for free. The head arrives in world space and is mapped into orbit space
 * with the orbit's current matrix. `update` with `amount` 0 hides it (no draw call), so a halo
 * that is not thinking renders exactly as it did. Nothing allocates per frame.
 */
import { BufferAttribute, BufferGeometry, Color, Points, Vector3, type Object3D } from 'three';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';

const SPARKS = 36;
/** Points per spark (the head and its trail) and the trail's spacing in loop progress. */
const TRAIL = 3;
const TRAIL_SPACING = 0.04;
const COUNT = SPARKS * TRAIL;
/** The sparks dive into the crown: this far above the head's centre (world units). */
const CROWN = 0.45;
/** Loops per second of each spark (seeded within this range) and the arc's lift toward the camera. */
const RATE_MIN = 0.55;
const RATE_SPAN = 0.5;
const LIFT = 0.35;
const BRIGHT = 3.4;

/** A fixed pseudo-random value in 0..1 for seed `n` (deterministic: no Math.random). */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface HaloStream {
  /**
   * `amount` 0..1 (0 hides it), the clock, the orbit's node positions and how many are in
   * use, and the head's centre in world space.
   */
  update(amount: number, time: number, nodes: Float32Array, used: number, head: Readonly<Vector3>): void;
  setPointScale(scale: number): void;
}

/** Adds the stream to the halo's `orbit` group (freed with it), tinted like the halo. */
export function addHaloStream(orbit: Object3D, warm: Color): HaloStream {
  const positions = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const brights = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const rates = new Float32Array(SPARKS);
  const offsets = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    rates[i] = RATE_MIN + seeded(i + 11) * RATE_SPAN;
    offsets[i] = seeded(i + 23);
  }
  for (let i = 0; i < COUNT; i++) phases[i] = seeded(i + 37);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.2);
  material.uniforms.uWarm.value.copy(warm);
  const points = new Points(geometry, material);
  points.name = 'halo-stream';
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.visible = false;
  orbit.add(points);
  const target = new Vector3();

  return {
    update(amount, time, nodes, used, head) {
      points.visible = amount > 0.002 && used > 0;
      if (!points.visible) return;
      target.copy(head).setY(head.y + CROWN);
      orbit.worldToLocal(target);
      material.uniforms.uTime.value = time;
      for (let s = 0; s < SPARKS; s++) {
        const cycle = time * rates[s] + offsets[s];
        const loop = Math.floor(cycle);
        const node = Math.min(used - 1, Math.floor(seeded(s * 7.13 + loop * 13.7) * used)) * 3;
        for (let k = 0; k < TRAIL; k++) {
          const i = s * TRAIL + k;
          const u = Math.max(cycle - loop - k * TRAIL_SPACING, 0);
          // Speeds up as it nears the crown, on an arc bowed upward.
          const along = u * u * (1.6 - 0.6 * u);
          const bow = Math.sin(u * Math.PI) * LIFT;
          positions[i * 3] = nodes[node] + (target.x - nodes[node]) * along;
          positions[i * 3 + 1] = nodes[node + 1] + (target.y - nodes[node + 1]) * along + bow;
          positions[i * 3 + 2] = nodes[node + 2] + (target.z - nodes[node + 2]) * along;
          const fade = 1 - k / TRAIL;
          sizes[i] = (k === 0 ? 0.08 : 0.05) * (1 - 0.5 * u) * fade;
          brights[i] = BRIGHT * amount * Math.sin(u * Math.PI) ** 0.6 * fade * fade;
        }
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
  };
}
