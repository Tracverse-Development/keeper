/**
 * The puppy's measurements: the one source of truth shared by its rig (`puppy-body.ts`,
 * `puppy-head.ts`, `puppy-skin.ts`) and the anchors it publishes for wearables
 * (`skins/catalog.ts`), so a fitted jacket follows the pear of its torso and cuffs its front
 * legs, and a cap follows its skull. Pure data (no three.js).
 */
import type { BodyShape, Limb, Ring } from '../../parts/fit.ts';
import { domeProfile } from '../../parts/fit.ts';

/** World height of the neck (top of the torso), of the seat, and of the head centre. */
export const PUPPY_NECK_Y = -0.5;
export const PUPPY_SEAT_Y = -1.95;
export const PUPPY_HEAD_Y = 0.22;

/** Half-extents of the skull (x wide, y tall, z deep). */
export const PUPPY_SKULL = [0.86, 0.76, 0.78] as const;

/** Torso silhouette as (radius, height above the seat), and how much it is squashed front to back. */
export const PUPPY_TORSO_PROFILE: readonly Ring[] = [
  [0.001, 0],
  [0.4, 0.02],
  [0.62, 0.12],
  [0.7, 0.34],
  [0.66, 0.6],
  [0.56, 0.88],
  [0.47, 1.12],
  [0.42, 1.3],
  [0.33, 1.44],
  [0.001, 1.5],
];
export const PUPPY_TORSO_DEPTH = 0.88;

/** The front legs (capsules): x either side, top height and depth, radius, length, tilt. */
export const PUPPY_FRONT_LEG = { x: 0.22, y: -1.55, z: 0.49, radius: 0.14, length: 0.46, tilt: -0.15 } as const;

/** The navy collar ring: centre, radius, tube and its forward lean. */
export const PUPPY_COLLAR = { y: PUPPY_NECK_Y - 0.02, z: 0.03, radius: 0.37, tube: 0.066, lean: 0.3 } as const;

/** The torso rings in the neck anchor's space, top to bottom (the same curve, reversed). */
const TORSO_FROM_NECK: Ring[] = [...PUPPY_TORSO_PROFILE].reverse().map(([r, h]) => [r, PUPPY_SEAT_Y + h - PUPPY_NECK_Y] as const);

/** Where each front leg leaves the torso, in the neck anchor's space. */
const LEGS: Limb[] = [-1, 1].map((side) => {
  const half = PUPPY_FRONT_LEG.length / 2 + PUPPY_FRONT_LEG.radius;
  return {
    position: [side * PUPPY_FRONT_LEG.x, PUPPY_FRONT_LEG.y + half * Math.cos(PUPPY_FRONT_LEG.tilt) - PUPPY_NECK_Y, PUPPY_FRONT_LEG.z + half * Math.sin(PUPPY_FRONT_LEG.tilt)],
    radius: PUPPY_FRONT_LEG.radius,
    length: PUPPY_FRONT_LEG.length + 2 * PUPPY_FRONT_LEG.radius,
    tilt: PUPPY_FRONT_LEG.tilt,
  } as const;
});

/**
 * What a hat must clear on the head: the skull AND the cream blaze that stands out above the eyes,
 * so the dome is a little taller and deeper than the skull and centred a little forward (the
 * head anchor sits PUPPY_HAT_FORWARD ahead). The ears hang below the reach.
 */
export const PUPPY_HAT_RADII = [PUPPY_SKULL[0], 0.78, 0.84] as const;
export const PUPPY_HAT_FORWARD = 0.06;

/** The head (anchor: just forward of the head's centre, riding the head bone). */
export const PUPPY_HEAD_SHAPE: BodyShape = {
  profile: domeProfile(PUPPY_HAT_RADII[0], PUPPY_HAT_RADII[1], 17),
  depth: PUPPY_HAT_RADII[2] / PUPPY_HAT_RADII[0],
  squareness: 2,
  reach: 0.4,
};

/** The neck (anchor: the neck, riding the body): the leaning collar, then the chest. */
export const PUPPY_NECK_SHAPE: BodyShape = {
  profile: [[PUPPY_COLLAR.radius + PUPPY_COLLAR.tube, 0.06], [PUPPY_COLLAR.radius + PUPPY_COLLAR.tube, -0.08], ...TORSO_FROM_NECK.filter(([, y]) => y < -0.2)],
  depth: 0.94,
  squareness: 2,
  reach: -0.7,
  lean: PUPPY_COLLAR.lean,
};

/** The torso (anchor: the neck, riding the body): a pear, with the front legs leaving it. */
export const PUPPY_TORSO_SHAPE: BodyShape = {
  profile: TORSO_FROM_NECK,
  depth: PUPPY_TORSO_DEPTH,
  squareness: 2,
  reach: -0.74,
  limbs: LEGS,
};
