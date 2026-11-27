/**
 * Two-bone reach (analytic IK) for a person's arm: given where the hand should go, the shoulder's
 * turn and the elbow's bend that put it there. Pure maths on plain numbers (no three.js), tested by
 * `arm-reach.test.ts`; `human-moments.ts` turns the answer into the rig's pose.
 *
 * The arm's own frame (the shoulder joint's local axes): it hangs along -y at rest, and the elbow
 * bends about its local x, a NEGATIVE bend bringing the forearm toward +z (forward, as a real elbow
 * does). The solver builds that frame for the reach: local -y along the upper arm, local +z toward
 * the forearm's side, local x their cross. The elbow points toward `pole` (down, out and back for
 * a person), which picks one of the infinitely many arm planes that reach the same point.
 *
 * A target out of reach is clamped to full reach along its own direction (the hand gets as close as
 * the arm allows: it never stretches the arm), and one too close is pushed out to the nearest the
 * folded arm can reach.
 */

export type Vec3 = readonly [number, number, number];

export interface ArmReach {
  /** The shoulder's turn as a quaternion [x, y, z, w] in the shoulder's parent space. */
  readonly shoulder: readonly [number, number, number, number];
  /** The elbow's bend about the arm's local x (radians, <= 0: forward). */
  readonly elbow: number;
  /** How far the hand ends from the target (0 when reachable). */
  readonly miss: number;
}

/** The smallest bend kept so the plane of the arm is always defined (radians). */
const MIN_BEND = 0.04;

/**
 * Solves the reach from the shoulder (at the origin of `target`'s space) to `target`, with an upper
 * arm `upper` long (shoulder to elbow) and a forearm `lower` long (elbow to the hand's centre).
 */
export function reachArm(target: Vec3, upper: number, lower: number, pole: Vec3): ArmReach {
  const wanted = length(target);
  const far = upper + lower;
  const near = Math.abs(upper - lower) + 1e-3;
  // Never fully straight, so the elbow keeps its plane.
  const reach = Math.min(Math.max(wanted, near), far * Math.cos(MIN_BEND / 2));
  const toward = wanted > 1e-6 ? scale(target, 1 / wanted) : ([0, -1, 0] as Vec3);
  // The angle at the shoulder between the line to the hand and the upper arm, and the elbow's inside angle.
  const atShoulder = Math.acos(clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach)));
  const inside = Math.acos(clamp((upper * upper + lower * lower - reach * reach) / (2 * upper * lower)));
  const bend = Math.PI - inside;
  // The elbow swings off the line toward the pole.
  let side = sub(pole, scale(toward, dot(pole, toward)));
  if (length(side) < 1e-6) side = perpendicular(toward);
  side = normalize(side);
  const upperDir = add(scale(toward, Math.cos(atShoulder)), scale(side, Math.sin(atShoulder)));
  const elbowAt = scale(upperDir, upper);
  const hand = scale(toward, reach);
  const forearm = normalize(sub(hand, elbowAt));
  // The arm's frame: -y along the upper arm, +z toward the forearm's side of it, x = y × z.
  const y = scale(upperDir, -1);
  const z = normalize(sub(forearm, scale(upperDir, dot(forearm, upperDir))));
  const x = cross(y, z);
  return { shoulder: quaternionFromAxes(x, y, z), elbow: -bend, miss: Math.max(0, wanted - reach) };
}

/** The quaternion [x, y, z, w] of the rotation whose columns are the axes x, y, z. */
export function quaternionFromAxes(x: Vec3, y: Vec3, z: Vec3): [number, number, number, number] {
  const [m00, m10, m20] = x;
  const [m01, m11, m21] = y;
  const [m02, m12, m22] = z;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

/** Where the hand lands for a shoulder turn and elbow bend (the forward check the tests use). */
export function handOf(reach: Pick<ArmReach, 'shoulder' | 'elbow'>, upper: number, lower: number): Vec3 {
  const local: Vec3 = [0, -upper - lower * Math.cos(reach.elbow), -lower * Math.sin(reach.elbow)];
  return rotate(reach.shoulder, local);
}

function rotate(q: readonly [number, number, number, number], v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  const u: Vec3 = [qx, qy, qz];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, qw)), cross(u, t));
}

const clamp = (c: number) => Math.min(1, Math.max(-1, c));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const perpendicular = (a: Vec3): Vec3 => (Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
