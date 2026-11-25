/**
 * The puppy's thought bubble: three glowing dots that rise one by one up and to the side of
 * its head while it thinks, hold a moment, then pop together and start again
 * (`bubbleDot` in `thinking.ts` is the timing). Drawn with the shared glow point sprites,
 * so the dots bloom softly like the halo's nodes.
 *
 * It sits on the body group (not the head), so the bubble floats steady while the head tilts
 * in puzzlement underneath it. `update(drama, t)` with drama 0 hides it (no draw call), so a
 * puppy that is not thinking renders exactly as it did. Nothing allocates per frame.
 */
import { BufferAttribute, BufferGeometry, Color, Points, type Object3D } from 'three';
import { disposeTree } from '../../dispose-tree';
import { PALETTE } from '../../palette';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';
import { bubbleDot, cyclePhase } from '../../thinking';

/** Seconds per bubble loop (appear, hold, pop, rest). */
const LOOP_SECONDS = 2.6;
/** Where the first dot sits (body space, above and right of the head) and each step after it. */
const FIRST = [0.72, 1.18, 0.45] as const;
const STEP = [0.3, 0.3, 0] as const;
/** World size of each dot (they grow along the chain, like a comic thought bubble). */
const SIZES = [0.22, 0.32, 0.44] as const;
const BRIGHT = 2.6;

export interface PuppyThinking {
  /** `drama` 0..1 (hidden at 0) and the motion-scaled clock in seconds. */
  update(drama: number, t: number): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

export function addPuppyThinking(body: Object3D): PuppyThinking {
  const count = SIZES.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brights = new Float32Array(count);
  const phases = new Float32Array(count);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.15);
  material.uniforms.uWarm.value = new Color(PALETTE.gold300);
  material.uniforms.uHot.value = new Color(PALETTE.cream50);
  const points = new Points(geometry, material);
  points.name = 'thought-bubble';
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.visible = false;
  body.add(points);
  const dot = { size: 0, bright: 0, rise: 0 };

  return {
    update(drama, t) {
      points.visible = drama > 0.002;
      if (!points.visible) return;
      material.uniforms.uTime.value = t;
      const phase = cyclePhase(t, LOOP_SECONDS);
      for (let i = 0; i < count; i++) {
        bubbleDot(i, phase, dot);
        positions[i * 3] = FIRST[0] + STEP[0] * i;
        positions[i * 3 + 1] = FIRST[1] + STEP[1] * i + dot.rise;
        positions[i * 3 + 2] = FIRST[2] + STEP[2] * i;
        sizes[i] = SIZES[i] * dot.size;
        brights[i] = BRIGHT * dot.bright * drama;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(points),
  };
}
