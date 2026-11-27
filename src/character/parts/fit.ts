/**
 * Fit: how one wearable adapts to many bodies, without per-species code.
 *
 * Pattern: Adapter. Every species publishes, for each slot it offers that is worn on the body
 * (`slots.ts`), a `BodyShape`: the surface around that slot's anchor as rings (half-width at a
 * height, top to bottom, the same Catmull-Rom curve the rig's lathe uses), its depth over width,
 * how square its cross-section is, how far down a garment may hang, which way the neck opening
 * leans, and the limbs that leave it. A part never asks WHICH species it is on: it reads the
 * shape and builds itself to it (a jacket follows the rings with a little ease, a cap follows the
 * dome, a backpack finds the back's depth). So the robot's tapering spirit torso and the puppy's
 * pear each get a jacket of their own shape, with sleeves only where there are limbs.
 *
 * Pure maths (no three.js at run time; `follow` only names its type): tested by `fit.test.ts`, and used by the wearables-fit test to prove
 * every catalogue part sits outside, and close to, every body that offers its slot.
 */

import type { Object3D } from 'three';

/** One ring of a body's surface: [half-width (x), height (y)] in the anchor's space. */
export type Ring = readonly [number, number];

/** A limb leaving this part of the body (the puppy's front legs): sleeves and cuffs fit it. */
export interface Limb {
  /** The limb's top (where it leaves the body), in the anchor's space. */
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly length: number;
  /** Its tilt about x (radians), as the rig poses it. */
  readonly tilt: number;
  /**
   * The rig joint the limb rides (`skins/catalog.ts` `Bone`: a person's `leftArm`, the puppy's waving
   * `paw`), so a sleeve on it moves when the arm waves. Absent: the limb never moves on its own.
   */
  readonly bone?: string;
  /**
   * Where the limb bends (a person's elbow): `at` is how far down the limb from its top, `bone` the
   * rig joint the part below the bend rides (`leftForearm`). A sleeve's lower half follows it
   * (`limb-follow.ts`). Absent: the limb is one rigid piece.
   */
  readonly elbow?: { readonly at: number; readonly bone?: string };
}

/**
 * A foot (a paw): an ellipsoid at `position` with half-extents `radii`, in the anchor's space at
 * rest. `bone` names the rig joint it rides when that is not the slot's own (`skins/catalog.ts`
 * `Bone`: the puppy's waving front paw rides `paw`, its scratching hind paw `hindPaw`).
 */
export interface Foot {
  readonly position: readonly [number, number, number];
  readonly radii: readonly [number, number, number];
  readonly bone?: string;
}

/** The surface a species publishes for one worn slot. */
export interface BodyShape {
  /** Surface rings, top to bottom (y decreasing), in the anchor's space. */
  readonly profile: readonly Ring[];
  /** Depth over width of the cross-section (1 = round; the puppy's pear is 0.88). */
  readonly depth: number;
  /** Cross-section exponent: 2 = an ellipse, higher = boxier (4 reads as a rounded box). */
  readonly squareness: number;
  /** The lowest height (anchor space) a garment on this slot may come down to. */
  readonly reach: number;
  /** How far the neck opening leans, front down (radians); 0 = level. */
  readonly lean?: number;
  readonly limbs?: readonly Limb[];
  /** The feet a paws slot is worn on (empty `profile` then: there is no surface ring to follow). */
  readonly feet?: readonly Foot[];
  /**
   * Where the eyes are, for the face slot (spectacles, a visor): half the distance between their
   * centres, their height, their radius, and how far forward the face's surface is at that height.
   */
  readonly eyes?: FaceEyes;
}

/** The eyes a face publishes (anchor space): see `BodyShape.eyes`. */
export interface FaceEyes {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly front: number;
}

/** What a part is told about the body it is built for. */
export interface PartFit {
  readonly species: string;
  /** Present for worn slots; floating parts need only the anchor's scale. */
  readonly shape?: BodyShape;
  /**
   * Live joints for a shape with feet or moving limbs: `feet[i]` rides foot i's bone (a paw that
   * waves), `limbs[i]` limb i's (an arm that waves), `base` is the slot's anchor. A part follows them
   * each frame; absent (as in the fit test), every foot and sleeve stays at its rest place.
   */
  readonly follow?: {
    readonly base: Object3D;
    readonly feet: readonly Object3D[];
    /**
     * One live joint per limb of the shape (`shape.limbs[i]`), riding that limb's bone, placed at the
     * limb's top with the anchor's own turn at rest: a sleeve follows `limbs[i]` (`limb-follow.ts`).
     */
    readonly limbs?: readonly Object3D[];
    /**
     * One live joint per limb that bends (`shape.limbs[i].elbow`), riding the forearm's bone, placed
     * at the bend with the anchor's own turn at rest; null for a limb that does not bend.
     */
    readonly elbows?: readonly (Object3D | null)[];
  };
}

/** A garment ring: its height and the half-width and half-depth it is cut to. */
export interface GarmentRing {
  readonly y: number;
  readonly rx: number;
  readonly rz: number;
}

/**
 * The point at `t` (0..1) along the profile curve: the uniform Catmull-Rom three.js'
 * `SplineCurve` draws (ends clamped), so a fitted garment follows the lathe the rig made.
 */
export function profilePoint(profile: readonly Ring[], t: number): Ring {
  if (profile.length === 1) return profile[0];
  const p = (profile.length - 1) * Math.min(Math.max(t, 0), 1);
  const i = Math.min(Math.floor(p), profile.length - 2);
  const w = p - i;
  const p0 = profile[i === 0 ? i : i - 1];
  const p1 = profile[i];
  const p2 = profile[i + 1];
  const p3 = profile[i > profile.length - 3 ? profile.length - 1 : i + 2];
  const at = (k: 0 | 1): number => catmullRom(w, p0[k], p1[k], p2[k], p3[k]);
  return [at(0), at(1)];
}

function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  return (2 * p1 - 2 * p2 + v0 + v1) * t ** 3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t ** 2 + v0 * t + p1;
}

/**
 * Where a point sits against a foot: below 1 inside the ellipsoid, 1 on it, above 1 outside.
 */
export function footLevel(foot: Foot, x: number, y: number, z: number): number {
  const [rx, ry, rz] = foot.radii;
  const [cx, cy, cz] = foot.position;
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
}

/** A point's clearance from the nearest foot, as a share of that foot's size (0 = on it). */
export function footClearance(feet: readonly Foot[], x: number, y: number, z: number): number {
  let best = Infinity;
  for (const foot of feet) best = Math.min(best, Math.sqrt(footLevel(foot, x, y, z)) - 1);
  return best;
}

/** Samples between curve points (enough that linear reading between them is within ~1 mm). */
const SAMPLES = 160;
const sampled = new WeakMap<readonly Ring[], Ring[]>();

function samples(profile: readonly Ring[]): Ring[] {
  let out = sampled.get(profile);
  if (!out) {
    out = Array.from({ length: SAMPLES + 1 }, (_, i) => profilePoint(profile, i / SAMPLES));
    sampled.set(profile, out);
  }
  return out;
}

/** The body's half-width at height `y` (0 above or below the profile). */
export function radiusAt(shape: BodyShape, y: number): number {
  if (shape.profile.length === 0) return 0;
  const points = samples(shape.profile);
  for (let i = 0; i < points.length - 1; i++) {
    const [r0, y0] = points[i];
    const [r1, y1] = points[i + 1];
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (y < lo || y > hi) continue;
    return hi === lo ? Math.max(r0, r1) : r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
}

/** The widest the body gets between two heights (garments clear the widest point they span). */
export function widestBetween(shape: BodyShape, top: number, bottom: number, steps = 24): number {
  let widest = 0;
  for (let i = 0; i <= steps; i++) widest = Math.max(widest, radiusAt(shape, top + ((bottom - top) * i) / steps));
  return widest;
}

/**
 * A point on a superellipse cross-section; `angle` 0 is the front (+z), growing toward +x.
 * At squareness 2 this is the ellipse (rx sin a, rz cos a).
 */
export function crossSection(angle: number, rx: number, rz: number, squareness: number): [number, number] {
  const e = 2 / squareness;
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return [rx * Math.sign(s) * Math.abs(s) ** e, rz * Math.sign(c) * Math.abs(c) ** e];
}

/**
 * Where a point sits against the body: below 1 it is inside the surface, 1 on it, above 1
 * outside (the superellipse's own equation, scaled by the ring at that height). Points above or
 * below the profile are outside (Infinity).
 */
export function bodyLevel(shape: BodyShape, x: number, y: number, z: number): number {
  const r = radiusAt(shape, y);
  if (r <= 1e-6) return Infinity;
  const n = shape.squareness;
  return Math.abs(x / r) ** n + Math.abs(z / (r * shape.depth)) ** n;
}

/** How far out from the surface a point is, as a fraction of the body's size there (0 = on it). */
export function clearance(shape: BodyShape, x: number, y: number, z: number): number {
  return bodyLevel(shape, x, y, z) ** (1 / shape.squareness) - 1;
}

/**
 * Rings for a garment from height `top` down to `bottom`: the body's own rings with `ease`
 * added all round (half-width and half-depth), so the cloth sits just off the surface.
 */
export function garmentRings(shape: BodyShape, top: number, bottom: number, ease: number, count: number): GarmentRing[] {
  return Array.from({ length: count }, (_, i) => {
    const y = top + ((bottom - top) * i) / Math.max(count - 1, 1);
    const r = radiusAt(shape, y);
    return { y, rx: r + ease, rz: r * shape.depth + ease };
  });
}

/** The body's half-depth at the front or back of height `y` (the surface a backpack meets). */
export function surfaceDepth(shape: BodyShape, y: number): number {
  return radiusAt(shape, y) * shape.depth;
}

/** A whole ellipsoid's profile, crown to chin (what a face publishes for a visor to wrap). */
export function ellipsoidProfile(rx: number, ry: number, rings = 17): Ring[] {
  return Array.from({ length: rings }, (_, i) => {
    const phi = (i / (rings - 1)) * Math.PI;
    return [Math.max(rx * Math.sin(phi), 0.001), ry * Math.cos(phi)] as const;
  });
}

/**
 * A dome's profile for an ellipsoid head of half-width `rx` and half-height `ry`, from the
 * crown (top) down to the equator: what a head publishes for the cap to follow.
 */
export function domeProfile(rx: number, ry: number, rings = 9): Ring[] {
  return Array.from({ length: rings }, (_, i) => {
    const phi = (i / (rings - 1)) * (Math.PI / 2);
    return [Math.max(rx * Math.sin(phi), 0.001), ry * Math.cos(phi)] as const;
  });
}
