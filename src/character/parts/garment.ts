/**
 * Garment helpers shared by the torso and neck kits (`top`, `gown`, `neckwear`): the pieces every
 * fitted garment is made of, on top of `fit.ts` (the maths) and `fitted-shell.ts` (shells, piping).
 *
 *  - `patch`: a fitted cloth panel over any arc of the body (a lapel, a pocket, a bandana's point),
 *    where `fittedShell` only leaves a gap at the front;
 *  - `pushOut`: moves any geometry outward until it clears the body by `ease` (a sleeve meeting the
 *    side of the torso, a button on a bulging chest), so details never sink into the body;
 *  - `longRings`: rings from a neckline to below the body's reach, flaring out (a gown, a robe):
 *    where the body has a surface they follow it, below it they keep falling and widening;
 *  - `garmentSway`: the soft outward breath of a hem, as the jacket does;
 *  - `scatterQuads`: many small flat pieces (sequins, sparkles) merged into one geometry;
 *  - `glowTrim`: satin trim that also lights up (`glow` 0..2).
 *
 * Pure geometry on three.js (no GPU needed), so the wearables-fit test builds and measures it.
 */
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { trimMaterial } from './cloth.ts';
import { bodyLevel, crossSection, radiusAt, type BodyShape, type GarmentRing } from './fit.ts';
import type { PartFrame } from './part';

/** A fitted panel through `rings`, from angle `from` to `to` (radians, 0 = front, toward +x). */
export function patch(rings: readonly GarmentRing[], squareness: number, from: number, to: number, segments: number): BufferGeometry {
  const columns = segments + 1;
  const positions = new Float32Array(rings.length * columns * 3);
  const uvs = new Float32Array(rings.length * columns * 2);
  rings.forEach((ring, i) => {
    for (let j = 0; j < columns; j++) {
      const [x, z] = crossSection(from + ((to - from) * j) / segments, ring.rx, ring.rz, squareness);
      positions.set([x, ring.y, z], (i * columns + j) * 3);
      uvs.set([j / segments, 1 - i / Math.max(rings.length - 1, 1)], (i * columns + j) * 2);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * columns + j;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Pushes every vertex of `geometry` (already in the anchor's space) out along its cross-section
 * until it stands at least `ease` off the body (heights with no surface are left as they are).
 */
export function pushOut(geometry: BufferGeometry, shape: BodyShape, ease: number): BufferGeometry {
  const position = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const r = radiusAt(shape, y);
    if (r <= 1e-6) continue;
    const level = bodyLevel(shape, x, y, z) ** (1 / shape.squareness);
    const want = 1 + ease / r;
    if (level >= want) continue;
    // The superellipse is homogeneous: scaling (x, z) by k scales the level by k. A point on the
    // axis (level 0) is sent straight out to the front.
    if (level < 1e-4) {
      position.setZ(i, r * shape.depth * want);
      continue;
    }
    const k = want / level;
    position.setX(i, x * k);
    position.setZ(i, z * k);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Rings from `top` down to `hem`, `ease` off the body wherever it has a surface, and never
 * narrower than a skirt flaring from `waist` (its half-width there) at `flare` per unit of drop.
 */
export function longRings(shape: BodyShape, top: number, hem: number, ease: number, count: number, waist: number, flare: number): GarmentRing[] {
  const waistY = waistOf(shape);
  return Array.from({ length: count }, (_, i) => {
    const y = top + ((hem - top) * i) / (count - 1);
    const r = radiusAt(shape, y);
    const skirt = y < waistY ? waist + (waistY - y) * flare : 0;
    const rx = Math.max(r + ease, skirt);
    const rz = Math.max(r * shape.depth + ease, skirt * Math.max(shape.depth, 0.8));
    return { y, rx, rz };
  });
}

/** The narrowest height between the widest point and the reach: where a skirt starts to flare. */
export function waistOf(shape: BodyShape): number {
  const crown = shape.profile[0][1];
  let widestY = crown;
  let widest = 0;
  for (let i = 0; i <= 60; i++) {
    const y = crown + ((shape.reach - crown) * i) / 60;
    if (radiusAt(shape, y) > widest) [widest, widestY] = [radiusAt(shape, y), y];
  }
  let waistY = shape.reach;
  let narrow = Infinity;
  for (let i = 0; i <= 60; i++) {
    const y = widestY + ((shape.reach - widestY) * i) / 60;
    const r = radiusAt(shape, y);
    if (r > 0 && r < narrow * 0.999) [narrow, waistY] = [r, y];
  }
  return waistY;
}

/** How far a long garment falls below the torso: as far again as the torso is tall (to the shoes on a person). */
export function hemOf(shape: BodyShape, share: number): number {
  const crown = shape.profile[0][1];
  const bottom = shape.profile[shape.profile.length - 1][1];
  return Math.min(shape.reach - share * (crown - shape.reach), bottom - 0.2);
}

/**
 * The hem's breath: every vertex below `top` moves outward a little (more toward `bottom`), never
 * inward, like the jacket's. Returns the per-frame update.
 */
export function garmentSway(geometry: BufferGeometry, top: number, bottom: number, amount: number): (frame: PartFrame) => void {
  const positions = geometry.getAttribute('position') as BufferAttribute;
  const rest = Float32Array.from(positions.array as Float32Array);
  return (frame) => {
    const { amplitude, speed } = frame.motion;
    const reach = amount * amplitude * (1 + 0.8 * frame.work);
    if (reach <= 0) return;
    const t = frame.time * speed;
    const array = positions.array as Float32Array;
    for (let k = 0; k < array.length; k += 3) {
      const x = rest[k];
      const y = rest[k + 1];
      const z = rest[k + 2];
      const hang = Math.min(Math.max((top - y) / (top - bottom), 0), 1) ** 2;
      const push = 1 + (reach * hang * (0.6 + 0.4 * Math.sin(t * 1.4 + y * 4 + Math.atan2(x, z) * 2))) / Math.max(Math.hypot(x, z), 0.1);
      array[k] = x * push;
      array[k + 2] = z * push;
    }
    positions.needsUpdate = true;
  };
}

/** Small square pieces of side `size`, each lying flat against `normal` at `at`, in one geometry. */
export function scatterQuads(pieces: readonly { at: Vector3; normal: Vector3; spin: number }[], size: number): BufferGeometry {
  const positions = new Float32Array(pieces.length * 4 * 3);
  const normals = new Float32Array(pieces.length * 4 * 3);
  const index: number[] = [];
  const up = new Vector3(0, 1, 0);
  pieces.forEach((piece, n) => {
    const side = new Vector3().crossVectors(up, piece.normal).normalize();
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const down = new Vector3().crossVectors(piece.normal, side).normalize();
    side.applyAxisAngle(piece.normal, piece.spin);
    down.applyAxisAngle(piece.normal, piece.spin);
    const h = size / 2;
    const corners = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ];
    corners.forEach(([a, b], c) => {
      const p = piece.at.clone().addScaledVector(side, a).addScaledVector(down, b);
      positions.set([p.x, p.y, p.z], (n * 4 + c) * 3);
      normals.set([piece.normal.x, piece.normal.y, piece.normal.z], (n * 4 + c) * 3);
    });
    const o = n * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/** How much light a glowing trim gives per unit of `glow` (the stage blooms anything bright). */
const GLOW_SHARE = 0.32;

/** Satin trim in `colour` that also glows by `glow` (0 = plain trim). */
export function glowTrim(colour: number, glow: number): ReturnType<typeof trimMaterial> {
  const material = trimMaterial(colour);
  material.emissive = new Color(colour);
  material.emissiveIntensity = glow * GLOW_SHARE;
  return material;
}

/** The outward normal of the body's cross-section at a point (for laying pieces flat on cloth). */
export function outward(shape: BodyShape, x: number, z: number): Vector3 {
  const n = shape.squareness;
  const d = Math.max(shape.depth, 1e-3);
  const gx = Math.sign(x) * Math.abs(x) ** (n - 1);
  const gz = (Math.sign(z) * Math.abs(z / d) ** (n - 1)) / d;
  const v = new Vector3(gx, 0, gz);
  return v.lengthSq() < 1e-9 ? new Vector3(0, 0, 1) : v.normalize();
}
