/**
 * The robot's measurements: the one source of truth shared by its rig (`body.ts`,
 * `head-shape.ts`) and the anchors it publishes for wearables (`skins/catalog.ts`), so a fitted
 * jacket or cap follows the very curves the body is built from. Pure data (no three.js).
 */
import type { BodyShape, Ring } from '../../parts/fit.ts';
import { domeProfile, ellipsoidProfile } from '../../parts/fit.ts';

/** Half-extents of the head ellipsoid (x wide, y tall, z deep). */
export const ROBOT_HEAD_RADII = { x: 1, y: 0.9, z: 0.92 } as const;

/** World height of the head centre and of the neck (top of the torso). */
export const ROBOT_HEAD_CENTRE_Y = 0.5;
export const ROBOT_NECK_Y = -0.42;

/** The torso silhouette as (radius, height below the neck) control points. */
export const ROBOT_TORSO_PROFILE: readonly Ring[] = [
  [0.001, 0.06],
  [0.2, 0.05],
  [0.31, 0],
  [0.4, -0.14],
  [0.53, -0.36],
  [0.6, -0.6],
  [0.57, -0.84],
  [0.47, -1.06],
  [0.33, -1.27],
  [0.18, -1.41],
  [0.07, -1.48],
  [0.001, -1.5],
];

/** The pearl collar ring at the neck (radius, tube). */
export const ROBOT_COLLAR = { radius: 0.335, tube: 0.048 } as const;

/** The domed head (anchor: the head's centre, riding the head bone). No ears in the way of a cap. */
export const ROBOT_HEAD_SHAPE: BodyShape = {
  profile: domeProfile(ROBOT_HEAD_RADII.x, ROBOT_HEAD_RADII.y, 17),
  depth: ROBOT_HEAD_RADII.z / ROBOT_HEAD_RADII.x,
  squareness: 2,
  reach: 0.5, // just above the visor
};

/** The neck (anchor: the neck, riding the body): the pearl collar, then the shoulders. */
export const ROBOT_NECK_SHAPE: BodyShape = {
  profile: [
    [ROBOT_COLLAR.radius + ROBOT_COLLAR.tube, 0.05],
    [ROBOT_COLLAR.radius + ROBOT_COLLAR.tube, -0.05],
    [0.42, -0.16],
    [0.53, -0.36],
    [0.6, -0.6],
    [0.57, -0.84],
  ],
  depth: 1,
  squareness: 2,
  reach: -0.6,
};

/** The torso (anchor: the neck, riding the body): a round, tapering spirit with no arms. */
export const ROBOT_TORSO_SHAPE: BodyShape = {
  profile: ROBOT_TORSO_PROFILE,
  depth: 1,
  squareness: 2,
  reach: -0.86,
};

/** The face (anchor: the head's centre): the whole head, and the glowing eyes on the visor. */
export const ROBOT_FACE_SHAPE: BodyShape = {
  profile: ellipsoidProfile(ROBOT_HEAD_RADII.x, ROBOT_HEAD_RADII.y),
  depth: ROBOT_HEAD_RADII.z / ROBOT_HEAD_RADII.x,
  squareness: 2,
  reach: -0.4,
  eyes: { x: 0.3, y: 0.08, radius: 0.17, front: 0.93 },
};
