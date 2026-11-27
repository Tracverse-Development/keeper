/**
 * The people's item moments (`../../item-moments.ts`): small idle gestures with what they wear.
 *
 *   check-watch      the left forearm (it wears the watch) comes up across the chest, the head tips down to read it
 *   push-spectacles  the head nods a little and the right fingertips come up to the lenses' lower rim
 *   hat-bow          a polite bow under the hat: the head dips, the left hand comes to the heart
 *   tug-tie          the right hand comes to the knot at the collar and gives two small tugs, chin lifting
 *   raise-lantern    the right hand lifts what it holds to chin height in front, the head turns to look into it
 *
 * Each gesture names WHERE the hand goes (a point on the body or the face, `Reach`), and the arm gets
 * there with a real reach (`arm-reach.ts`: the shoulder turns and the elbow bends), so a hand touches
 * the knot or the lens instead of swinging toward it. Points on the face are carried by the head's
 * own pose this frame, so a nod brings the lens down to the fingers. Everything is blended from the
 * frame's own pose (`applyHuman`) by the moment's envelope, so it eases in and out and never jumps.
 * The proportions are a storybook's (a large head on a small body): the brim of a hat is out of an
 * arm's reach, so the hat's moment is a bow rather than a reach for it. The God Keeper is built on
 * the same rig and wears everything, so it plays these too, plus its own (`god-moments.ts`).
 */
import { Quaternion, Vector3 } from 'three';
import type { ActiveMoment, ItemMoment } from '../../item-moments';
import { reachArm, type Vec3 } from './arm-reach.ts';
import type { HumanRig } from './human-body';
import { elbowAt, handY, type HumanFrame } from './human-shape.ts';

export const HUMAN_MOMENTS: readonly ItemMoment[] = [
  { id: 'check-watch', parts: ['trail-watch'], weight: 3, duration: 2.6, cooldown: 40 },
  { id: 'push-spectacles', parts: ['round-spectacles'], weight: 2, duration: 1.8, cooldown: 45 },
  { id: 'hat-bow', parts: ['brim-hat', 'crew-cap', 'soft-hat'], weight: 2, duration: 2, cooldown: 50 },
  { id: 'tug-tie', parts: ['neckwear'], weight: 1.5, duration: 1.9, cooldown: 55 },
  { id: 'raise-lantern', parts: ['star-lantern', 'tote'], weight: 2, duration: 3, cooldown: 60 },
];

/**
 * Where a hand goes. `space` 'body' is the rig's body (x is the character's own left); 'head' is
 * the head's own space (its centre, the face toward +z), carried by the head's pose. Measured as
 * shares of the frame (`x`/`y`/`z` times the head's or the torso's size), so the man, the woman and
 * the God Keeper each reach their own face. `fingertip` aims the fingertips (not the palm) at it.
 */
interface Reach {
  readonly side: 'left' | 'right';
  readonly space: 'body' | 'head';
  readonly at: Vec3;
  readonly fingertip?: boolean;
}

/** One gesture: a reach (or none), the head's turn, and an optional wiggle on the forearm. */
interface Gesture {
  readonly reach?: Reach;
  readonly head: { readonly x: number; readonly y: number; readonly z: number };
  /** A small repeated bend at the elbow (tugs, a settling push), radians and per second. */
  readonly wiggle?: { readonly amount: number; readonly rate: number };
}

/**
 * The gestures. Head-space points are shares of the head's half-extents ([1, 0, 1] would be the
 * right of the face's front); body-space points are world units on the rig's body, measured on the
 * man and scaled by the frame's shoulder width for the others.
 */
const GESTURES: Readonly<Record<string, Gesture>> = {
  'check-watch': { reach: { side: 'left', space: 'body', at: [0.14, -0.72, 0.52] }, head: { x: 0.34, y: 0.24, z: 0.06 } },
  'push-spectacles': {
    reach: { side: 'right', space: 'head', at: [-0.3, -0.27, 1.05], fingertip: true },
    head: { x: 0.42, y: -0.06, z: 0 },
    wiggle: { amount: 0.05, rate: 7 },
  },
  'hat-bow': { reach: { side: 'left', space: 'body', at: [0.12, -0.8, 0.38] }, head: { x: 0.22, y: 0.06, z: -0.08 } },
  'tug-tie': { reach: { side: 'right', space: 'body', at: [-0.03, -0.56, 0.31] }, head: { x: -0.16, y: 0.05, z: 0.04 }, wiggle: { amount: 0.14, rate: 7 } },
  'raise-lantern': { reach: { side: 'right', space: 'body', at: [-0.28, -0.5, 0.52] }, head: { x: 0.12, y: -0.32, z: 0.05 } },
};

/** The man's shoulder half-width: body-space reaches are measured on him. */
const MEASURED_SHOULDER = 0.43;
/** Where the elbow points while reaching: down, out to its own side and a little back. */
const POLE = { x: 0.55, y: -1, z: -0.35 } as const;

const target = new Vector3();
const shoulderAt = new Vector3();
const rest = new Quaternion();
const reached = new Quaternion();

/**
 * Adds the moment playing (if any) to the rig's pose. The arms' rest pose (`poseArms`) is already
 * set this frame: the reaching arm is blended from it toward the reach by the envelope.
 */
export function poseHumanMoment(rig: HumanRig, frame: HumanFrame, moment: ActiveMoment | null): void {
  if (!moment) return;
  const g = GESTURES[moment.id];
  if (!g) return;
  const k = moment.envelope;
  rig.head.rotation.x += g.head.x * k;
  rig.head.rotation.y += g.head.y * k;
  rig.head.rotation.z += g.head.z * k;
  if (!g.reach) return;
  const wiggle = g.wiggle ? g.wiggle.amount * Math.sin(moment.elapsed * g.wiggle.rate * Math.PI * 2) * k : 0;
  const arm = g.reach.side === 'left' ? rig.leftArm : rig.rightArm;
  const forearm = g.reach.side === 'left' ? rig.leftForearm : rig.rightForearm;
  reachPoint(rig, frame, g.reach, target);
  shoulderAt.copy(arm.position);
  const upper = elbowAt(frame);
  const lower = -handY(frame) - upper;
  const outward = g.reach.side === 'left' ? 1 : -1;
  const toward = target.sub(shoulderAt);
  // Fingertips on the point: the hand's centre stops a finger's length short of it.
  if (g.reach.fingertip) toward.setLength(Math.max(0.05, toward.length() - frame.arm.hand * 0.95));
  const answer = reachArm([toward.x, toward.y, toward.z], upper, lower, [POLE.x * outward, POLE.y, POLE.z]);
  rest.copy(arm.quaternion);
  reached.set(...answer.shoulder);
  arm.quaternion.slerpQuaternions(rest, reached, k);
  forearm.rotation.x = forearm.rotation.x * (1 - k) + (answer.elbow + wiggle) * k;
}

/** The reach's point in the body's space this frame (a head point rides the head's pose). */
function reachPoint(rig: HumanRig, frame: HumanFrame, reach: Reach, out: Vector3): Vector3 {
  if (reach.space === 'head') {
    const [hx, hy, hz] = frame.head;
    out.set(reach.at[0] * hx, reach.at[1] * hy, reach.at[2] * hz);
    rig.head.updateMatrix();
    return out.applyMatrix4(rig.head.matrix);
  }
  const k = frame.shoulder.x / MEASURED_SHOULDER;
  return out.set(reach.at[0] * k, reach.at[1], reach.at[2] * k);
}
