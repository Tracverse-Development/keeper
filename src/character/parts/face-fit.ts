/**
 * Face-fit maths for eyewear that stands OFF the face (flying goggles, a loupe): where the face's
 * surface is in front of a point, so a cup or a tube starts just outside it, and the head band's
 * rings at a height. Spectacles only float a wire in front of the eye; these pieces have depth, so
 * they read the face's published shape (`fit.ts`) instead of guessing.
 *
 * Pure maths over `BodyShape` (no three.js at run time): used by `flight-goggles` and `gear-loupe`.
 */
import { radiusAt, type BodyShape, type GarmentRing } from './fit.ts';

/**
 * How far forward (z) the face's surface stands at `(x, y)`: the superellipse section at that
 * height, solved for z. 0 where the point is outside the section (beside the head) or off the shape.
 */
export function surfaceFront(shape: BodyShape, x: number, y: number): number {
  const r = radiusAt(shape, y);
  if (r <= 1e-6 || Math.abs(x) >= r) return 0;
  const n = shape.squareness;
  return r * shape.depth * (1 - Math.abs(x / r) ** n) ** (1 / n);
}

/** The most forward the face stands anywhere inside a disc of `radius` centred on `(x, y)`. */
export function frontUnder(shape: BodyShape, x: number, y: number, radius: number): number {
  let front = 0;
  for (let i = 0; i <= 8; i++) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const s = (i / 8) * radius;
      front = Math.max(front, surfaceFront(shape, x + Math.cos(a) * s, y + Math.sin(a) * s));
    }
  }
  return front;
}

/** Rings for a head band from `top` down to `bottom`: the head's own rings there, `ease` off it. */
export function bandRings(shape: BodyShape, top: number, bottom: number, ease: number, count = 4): GarmentRing[] {
  return Array.from({ length: count }, (_, i) => {
    const y = top + ((bottom - top) * i) / (count - 1);
    // The band sits off the widest of its heights, so it never cuts into a bulge between rings.
    const r = Math.max(radiusAt(shape, top), radiusAt(shape, bottom), radiusAt(shape, y));
    return { y, rx: r + ease, rz: r * shape.depth + ease };
  });
}
