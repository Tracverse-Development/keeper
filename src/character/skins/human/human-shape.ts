/**
 * The human bodies' measurements (the man, the woman, and the God Keeper built on the same frame):
 * the one source of truth shared by the rig (`human-body.ts`) and the anchors it publishes for
 * wearables (`skins/catalog.ts`), so a fitted jacket follows the torso it is built from, a watch
 * wraps the real wrist and a lantern sits in the real hand. Stylised (a large head on a small body,
 * like the robot and the dog), standing on the ark. Pure data (no three.js).
 */
import type { BodyShape, FaceEyes, Foot, Limb, Ring } from '../../parts/fit.ts';
import { domeProfile, ellipsoidProfile } from '../../parts/fit.ts';

/** One frame's numbers: the man and the woman differ in shoulders, waist, hem and hair. */
export interface HumanFrame {
  /** Half-extents of the head ellipsoid (x wide, y tall, z deep). */
  readonly head: readonly [number, number, number];
  /** What a hat must clear: the head with its hair (half-extents). */
  readonly hat: readonly [number, number, number];
  /** Torso silhouette as (radius, height below the neck), top to bottom; `waist` splits top from bottom. */
  readonly torso: readonly Ring[];
  readonly waist: number;
  /** Torso depth over width. */
  readonly depth: number;
  /** Shoulder joint (x either side, height below the neck) and the arm's size. */
  readonly shoulder: { readonly x: number; readonly y: number };
  readonly arm: { readonly sleeve: number; readonly radius: number; readonly length: number; readonly hand: number; readonly spread: number };
  /** Legs: x either side, top and length (world), and the shoe ellipsoid. */
  readonly leg: { readonly x: number; readonly top: number; readonly length: number; readonly radius: number };
  readonly shoe: readonly [number, number, number];
  /** The nose's sculpt (`human-face.ts`); left out = `DEFAULT_NOSE` (the woman's, the God Keeper's mask). */
  readonly nose?: NoseShape;
}

/** Half-extents (head units) of the nose's pieces, and how far out from the face and apart they sit. */
export interface NoseShape {
  /** The bridge between the eyes down to the tip. */
  readonly bridge: readonly [number, number, number];
  /** The tip, and how far it stands out from the skin. */
  readonly tip: readonly [number, number, number];
  readonly tipOut: number;
  /** Each nostril wing, and its distance from the middle. */
  readonly wing: readonly [number, number, number];
  readonly wingX: number;
  /** Each dark nostril, and its distance from the middle. */
  readonly nostril: readonly [number, number, number];
  readonly nostrilX: number;
}

/** The shipped nose: a rounded button tip over full wings. */
export const DEFAULT_NOSE: NoseShape = {
  bridge: [0.036, 0.085, 0.04],
  tip: [0.06, 0.052, 0.05],
  tipOut: 0.04,
  wing: [0.038, 0.034, 0.036],
  wingX: 0.052,
  nostril: [0.016, 0.009, 0.012],
  nostrilX: 0.026,
};

/**
 * The man's nose: a slimmer, longer bridge, a smaller defined tip and wings tucked closer, so it
 * reads as a straight nose rather than a bulb (the same build as the woman's, finer).
 */
export const MAN_NOSE: NoseShape = {
  bridge: [0.03, 0.088, 0.036],
  tip: [0.043, 0.04, 0.041],
  tipOut: 0.036,
  wing: [0.026, 0.024, 0.025],
  wingX: 0.04,
  nostril: [0.012, 0.007, 0.01],
  nostrilX: 0.022,
};

/** World heights: the head centre, the neck (top of the torso) and the soles. */
export const HUMAN_HEAD_Y = 0.3;
export const HUMAN_NECK_Y = -0.46;
export const HUMAN_SOLE_Y = -1.98;

/** The eyes, in head space (x either side). */
export const HUMAN_EYES = { x: 0.26, y: 0.0, z: 0.6, radius: 0.14, turn: 0.3 } as const;

export const MAN_FRAME: HumanFrame = {
  head: [0.74, 0.78, 0.72],
  hat: [0.8, 0.84, 0.78],
  torso: [
    [0.001, 0.02],
    [0.17, 0.015],
    [0.31, -0.03],
    [0.44, -0.12],
    [0.47, -0.27],
    [0.44, -0.46],
    [0.4, -0.62],
    [0.4, -0.76],
    [0.4, -0.88],
    [0.001, -0.92],
  ],
  waist: -0.66,
  depth: 0.72,
  shoulder: { x: 0.43, y: -0.15 },
  arm: { sleeve: 0.12, radius: 0.096, length: 0.5, hand: 0.11, spread: 0.13 },
  leg: { x: 0.17, top: -1.3, length: 0.46, radius: 0.13 },
  shoe: [0.14, 0.09, 0.22],
  nose: MAN_NOSE,
};

export const WOMAN_FRAME: HumanFrame = {
  head: [0.73, 0.77, 0.71],
  hat: [0.86, 0.9, 0.84],
  torso: [
    [0.001, 0.02],
    [0.15, 0.015],
    [0.28, -0.03],
    [0.38, -0.12],
    [0.4, -0.26],
    [0.35, -0.44],
    [0.33, -0.56],
    [0.38, -0.68],
    [0.47, -0.86],
    [0.55, -1.06],
    [0.001, -1.08],
  ],
  waist: -0.58,
  depth: 0.74,
  shoulder: { x: 0.37, y: -0.15 },
  arm: { sleeve: 0.105, radius: 0.085, length: 0.48, hand: 0.1, spread: 0.2 },
  leg: { x: 0.15, top: -1.4, length: 0.38, radius: 0.105 },
  shoe: [0.12, 0.08, 0.2],
};

/** Where the hand and the wrist sit along an arm (arm-bone space, the arm hanging down). */
export function handY(frame: HumanFrame): number {
  return -(frame.arm.length + frame.arm.radius + frame.arm.hand * 0.6);
}
export function wristY(frame: HumanFrame): number {
  return -(frame.arm.length + frame.arm.radius * 0.2);
}
/**
 * Where the elbow sits down the arm (arm-bone space, positive): a little past half the bare arm, so
 * the forearm and hand together are a touch longer than the upper arm, as a real arm's are.
 */
export function elbowAt(frame: HumanFrame): number {
  return frame.arm.length * 0.55;
}

/** The slots a human frame publishes (anchor spaces named in `skins/catalog.ts`). */
export interface HumanShapes {
  readonly head: BodyShape;
  readonly face: BodyShape;
  readonly neck: BodyShape;
  readonly torso: BodyShape;
  readonly wrist: BodyShape;
  readonly held: BodyShape;
  /** Hips and both legs, in BODY space (the anchor is the body's origin): trousers and skirts. */
  readonly legs: BodyShape;
  /** Both shoes, in body space: what the feet slot is worn on. */
  readonly feet: BodyShape;
}

export function humanShapes(frame: HumanFrame, eyes: FaceEyes = faceEyes(frame)): HumanShapes {
  const torsoRings = frame.torso;
  const limbs: Limb[] = [-1, 1].map((side) => ({
    position: [side * frame.shoulder.x, frame.shoulder.y, 0],
    radius: frame.arm.sleeve,
    length: frame.arm.length,
    tilt: 0,
    elbow: { at: elbowAt(frame) },
  }));
  return {
    head: { profile: domeProfile(frame.hat[0], frame.hat[1], 17), depth: frame.hat[2] / frame.hat[0], squareness: 2, reach: 0.3 },
    face: { profile: ellipsoidProfile(frame.head[0], frame.head[1]), depth: frame.head[2] / frame.head[0], squareness: 2, reach: -0.3, eyes },
    neck: {
      profile: [[0.2, 0.06], [0.2, -0.02], ...torsoRings.filter(([, y]) => y < -0.05 && y > -0.6)],
      depth: frame.depth,
      squareness: 2,
      reach: -0.4,
    },
    torso: { profile: torsoRings, depth: frame.depth, squareness: 2.2, reach: frame.waist - 0.08, limbs },
    wrist: { profile: [[frame.arm.radius * 1.05, 0.06], [frame.arm.radius * 1.05, -0.06]], depth: 1, squareness: 2, reach: -0.06 },
    held: { profile: [[0.001, frame.arm.hand], [frame.arm.hand, 0], [0.001, -frame.arm.hand]], depth: 1, squareness: 2, reach: -frame.arm.hand },
    legs: legsShape(frame),
    feet: { profile: [], depth: 1, squareness: 2, reach: HUMAN_SOLE_Y, feet: humanFeet(frame) },
  };
}

/**
 * The hips and legs (body space): the torso's rings from the waist down (moved from neck space to
 * body space), then the two legs as limbs hanging to the shoes. `reach` is the top of the shoes,
 * where a trouser hem stops.
 */
export function legsShape(frame: HumanFrame): BodyShape {
  // The torso's own rings from the waist down, then a soft taper into the legs (the torso closes
  // abruptly, which left trousers with a ledge at the seat).
  const open = frame.torso.filter(([r, y]) => y <= frame.waist + 0.04 && r > 0.01).map(([r, y]) => [r, y + HUMAN_NECK_Y] as const);
  const [lastR, lastY] = open[open.length - 1];
  const hips: Ring[] = [...open.slice(0, -1), [lastR * 0.96, lastY], [lastR * 0.82, lastY - 0.035], [0.001, lastY - 0.06]];
  const limbs: Limb[] = [-1, 1].map((side) => ({ position: [side * frame.leg.x, frame.leg.top, 0], radius: frame.leg.radius, length: frame.leg.length, tilt: 0 }));
  return { profile: hips, depth: frame.depth, squareness: 2.2, reach: HUMAN_SOLE_Y + frame.shoe[1] * 2, limbs };
}

/** The eyes a human face publishes (head space). */
export function faceEyes(frame: HumanFrame): FaceEyes {
  const yRatio = HUMAN_EYES.y / frame.head[1];
  return { x: HUMAN_EYES.x, y: HUMAN_EYES.y, radius: HUMAN_EYES.radius, front: frame.head[2] * Math.sqrt(1 - yRatio * yRatio) };
}

/** Two feet, for a body that offers the paws slot (the God Keeper): body space. */
export function humanFeet(frame: HumanFrame): Foot[] {
  return [-1, 1].map((side) => ({ position: [side * frame.leg.x, HUMAN_SOLE_Y + frame.shoe[1], 0.05], radii: frame.shoe }));
}
