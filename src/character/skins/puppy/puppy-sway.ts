/**
 * The puppy's soft parts that swing with its motion: both floppy ears and the tail
 * (`sway/sway-bone.ts`). They trail the head and body as it turns, hops, chases its tail, waves or
 * is walked round in the Studio, then settle; the skin's own perk, flop and wag are untouched (the
 * swing rides a layer under each pivot). Ears swing out and round, never into the head; the tail
 * never into the back.
 *
 * Usage: `const sway = addPuppySway(parts.tail, face.ears, face.earTips)` once, then
 * `sway.update(frame.dt, frame.motion.amplitude)` at the end of `apply`, after the pivots are posed.
 */
import type { Object3D } from 'three';
import { addSwayBone, type SwayBone } from '../../sway/sway-bone.ts';

/** The tail's tip from its pivot (`puppy-body.ts` `buildTail`, the last point of its curve). */
const TAIL_TIP = [0.24, 0.76, 0.04] as const;

export interface PuppySway {
  update(dt: number, amplitude: number): void;
}

export function addPuppySway(tail: Object3D, ears: readonly Object3D[], earTips: readonly (readonly [number, number, number])[]): PuppySway {
  const bones: SwayBone[] = ears.map((ear, i) =>
    addSwayBone(ear, {
      tip: earTips[i],
      frequency: 1.8,
      damping: 0.26,
      maxAngle: 0.38,
      gain: 1.2,
      // The head is inward of each ear (left ear: toward +x).
      keepOut: { direction: [i === 0 ? 1 : -1, 0, 0], room: 0.04 },
    }),
  );
  bones.push(addSwayBone(tail, { tip: TAIL_TIP, frequency: 2.4, damping: 0.32, maxAngle: 0.3, keepOut: { direction: [0, 0, 1], room: 0.03 } }));
  return {
    update(dt, amplitude) {
      for (const bone of bones) bone.update(dt, amplitude);
    },
  };
}
