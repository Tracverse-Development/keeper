/**
 * The people's item moments (`../../item-moments.ts`): small idle gestures with what they wear.
 *
 *   check-watch      the left arm (it wears the watch) comes up in front, the head tips down to read it
 *   push-spectacles  the right hand rises toward the face, a small nod as the glasses settle
 *   adjust-brim      the left hand goes up to the hat's brim, the head tilts into it
 *   tug-tie          the right hand comes to the chest and gives two small tugs, chin lifting
 *   raise-lantern    the right hand lifts what it holds to eye height, the head turns to look into it
 *
 * The rig has one joint per arm (at the shoulder), so a gesture is a whole-arm swing toward the place
 * it means, and the head does the rest; every pose is added on top of the frame's own (`applyHuman`)
 * and scaled by the moment's envelope, so it eases in and out and never jumps. The God Keeper is
 * built on the same rig and wears everything, so it plays these too, plus its own (`god-moments.ts`).
 */
import type { ActiveMoment, ItemMoment } from '../../item-moments';
import type { HumanRig } from './human-body';

export const HUMAN_MOMENTS: readonly ItemMoment[] = [
  { id: 'check-watch', parts: ['trail-watch'], weight: 3, duration: 2.6, cooldown: 40 },
  { id: 'push-spectacles', parts: ['round-spectacles'], weight: 2, duration: 1.8, cooldown: 45 },
  { id: 'adjust-brim', parts: ['brim-hat', 'crew-cap', 'soft-hat'], weight: 2, duration: 2, cooldown: 50 },
  { id: 'tug-tie', parts: ['neckwear'], weight: 1.5, duration: 1.9, cooldown: 55 },
  { id: 'raise-lantern', parts: ['star-lantern', 'tote'], weight: 2, duration: 3, cooldown: 60 },
];

/** One gesture's pose: arm swings (radians about x: forward is negative; about z: toward the body) and the head. */
interface Gesture {
  readonly left?: { readonly x: number; readonly z: number };
  readonly right?: { readonly x: number; readonly z: number };
  readonly head: { readonly x: number; readonly y: number; readonly z: number };
  /** A small repeated wiggle on the moving arm (tugs, a settling nod), radians and per second. */
  readonly wiggle?: { readonly amount: number; readonly rate: number };
}

const GESTURES: Readonly<Record<string, Gesture>> = {
  'check-watch': { left: { x: -1.25, z: 0.75 }, head: { x: 0.32, y: 0.22, z: 0.06 } },
  'push-spectacles': { right: { x: -2.15, z: 0.55 }, head: { x: 0.1, y: -0.05, z: 0 }, wiggle: { amount: 0.06, rate: 9 } },
  'adjust-brim': { left: { x: -2.45, z: 0.15 }, head: { x: 0.08, y: 0.12, z: -0.08 }, wiggle: { amount: 0.05, rate: 6 } },
  'tug-tie': { right: { x: -0.95, z: 0.85 }, head: { x: -0.16, y: 0.05, z: 0.04 }, wiggle: { amount: 0.12, rate: 7 } },
  'raise-lantern': { right: { x: -1.45, z: 0.3 }, head: { x: 0.05, y: -0.35, z: 0.05 } },
};

/**
 * Adds the moment playing (if any) to the rig's pose. The arms' rest swing (`poseArms`) is already
 * set this frame: the gesture is added to it. The left arm's z grows outward (+), the right's
 * outward (-): `z` here is "toward the body", so it is turned per side.
 */
export function poseHumanMoment(rig: HumanRig, moment: ActiveMoment | null): void {
  if (!moment) return;
  const g = GESTURES[moment.id];
  if (!g) return;
  const k = moment.envelope;
  const wiggle = g.wiggle ? g.wiggle.amount * Math.sin(moment.elapsed * g.wiggle.rate * Math.PI * 2) * k : 0;
  if (g.left) {
    rig.leftArm.rotation.x += (g.left.x + wiggle) * k;
    rig.leftArm.rotation.z -= g.left.z * k;
  }
  if (g.right) {
    rig.rightArm.rotation.x += (g.right.x + wiggle) * k;
    rig.rightArm.rotation.z += g.right.z * k;
  }
  rig.head.rotation.x += g.head.x * k;
  rig.head.rotation.y += g.head.y * k;
  rig.head.rotation.z += g.head.z * k;
}
