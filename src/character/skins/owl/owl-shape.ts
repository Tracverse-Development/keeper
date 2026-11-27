/**
 * The owl's measurements: the one source of truth shared by its rig (`owl-skin.ts`) and the anchors
 * it publishes for wearables (`skins/catalog.ts`), so a fitted jacket follows the egg of its body and
 * spectacles sit on its great eyes. Pure data (no three.js).
 */
import type { BodyShape, Foot, Ring } from '../../parts/fit.ts';
import { domeProfile, ellipsoidProfile } from '../../parts/fit.ts';

export const OWL_HEAD_Y = 0.26;
export const OWL_NECK_Y = -0.4;
/** Half-extents of the head (x wide, y tall, z deep). */
export const OWL_HEAD = [0.82, 0.72, 0.74] as const;
/** The eyes in head space (x either side). */
export const OWL_EYES = { x: 0.29, y: 0.04, z: 0.6, radius: 0.2, turn: 0.28 } as const;

/** The body: an egg, as (radius, height below the neck). */
export const OWL_BODY_PROFILE: readonly Ring[] = [
  [0.001, 0.06],
  [0.3, 0.04],
  [0.52, -0.1],
  [0.66, -0.4],
  [0.7, -0.75],
  [0.64, -1.1],
  [0.48, -1.38],
  [0.25, -1.5],
  [0.001, -1.52],
];
export const OWL_BODY_DEPTH = 0.86;

/** The wings' shoulders (x either side, height below the neck). */
export const OWL_SHOULDER = { x: 0.6, y: -0.28 } as const;

/** What a hat must clear: the head with the base of its ear tufts. */
export const OWL_HEAD_SHAPE: BodyShape = { profile: domeProfile(0.86, 0.76, 17), depth: 0.9, squareness: 2, reach: 0.25 };

export const OWL_FACE_SHAPE: BodyShape = {
  profile: ellipsoidProfile(OWL_HEAD[0], OWL_HEAD[1]),
  depth: OWL_HEAD[2] / OWL_HEAD[0],
  squareness: 2,
  reach: -0.3,
  eyes: { x: OWL_EYES.x, y: OWL_EYES.y, radius: OWL_EYES.radius, front: OWL_EYES.z + OWL_EYES.radius * 0.9 },
};

export const OWL_NECK_SHAPE: BodyShape = {
  profile: [[0.42, 0.06], [0.42, -0.04], ...OWL_BODY_PROFILE.filter(([, y]) => y < -0.08 && y > -0.8)],
  depth: OWL_BODY_DEPTH,
  squareness: 2,
  reach: -0.6,
};

export const OWL_TORSO_SHAPE: BodyShape = { profile: OWL_BODY_PROFILE, depth: OWL_BODY_DEPTH, squareness: 2, reach: -0.95 };

/** The two feet of talons (body space): where the owl's gold talons grip the ark (`owl-skin.ts`). */
export const OWL_TALONS_Y = -1.93;
const OWL_FEET: Foot[] = [-1, 1].map((side) => ({ position: [side * 0.22, OWL_TALONS_Y + 0.02, 0.46], radii: [0.13, 0.05, 0.11] }));
/** The feet slot: no surface ring, only the two feet of talons. */
export const OWL_FEET_SHAPE: BodyShape = { profile: [], depth: 1, squareness: 2, reach: OWL_TALONS_Y - 0.05, feet: OWL_FEET };
