/**
 * Shared geometry for things worn on the head (the brimmed hat, the soft hat, head gear and the
 * crown): the head's own measurements read from its published dome (`fit.ts`), rings that always
 * stand outside it, a brim grown out of a rim, and a ring traced round the head at one height.
 *
 * Pattern: Adapter helpers. Every head kit asks these for "the head at height y" and never for a
 * species, so one hat fits the robot's pearl dome, the dog's skull, a person's hair and the owl's
 * round head. A ring made here is never inside the head: its half-width and half-depth are at least
 * the head's own there plus the ease asked for.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { crossSection, radiusAt, type BodyShape, type GarmentRing } from '../fit.ts';

/** The head's measurements a hat is built from. */
export interface Head {
  readonly shape: BodyShape;
  /** The crown's height (the top of the dome). */
  readonly top: number;
  /** Where a hat's rim sits (the shape's reach: above the eyes and ears). */
  readonly rim: number;
  /** The head's half-width at the rim. */
  readonly width: number;
}

export function headOf(shape: BodyShape): Head {
  const top = shape.profile[0][1];
  const rim = Math.min(shape.reach, top * 0.9);
  return { shape, top, rim, width: radiusAt(shape, rim) || shape.profile[shape.profile.length - 1][0] };
}

/** A ring at height `y` with half-width `rx` (depth follows the head), never inside the head plus `ease`. */
export function ringAround(head: Head, y: number, rx: number, ease: number): GarmentRing {
  const r = radiusAt(head.shape, y);
  const depth = head.shape.depth;
  const width = Math.max(rx, r + ease);
  return { y, rx: width, rz: Math.max(width * depth, r * depth + ease) };
}

/** The ring a hat sits on at height `y`: the head's own there, eased. */
export function headRing(head: Head, y: number, ease: number): GarmentRing {
  return ringAround(head, y, 0, ease);
}

/**
 * A crown from the rim up past the top of the head: `lift` above the crown at the top, the sides
 * tapering by `taper` (a share of the rim's width), closed by a top that may dip by `dent` in the
 * middle (a fedora's pinch). Top to bottom, ready for `fittedShell`.
 */
export function hatCrown(head: Head, ease: number, lift: number, taper: number, dent: number, count = 16): GarmentRing[] {
  const height = head.top + lift;
  const rimWidth = head.width + ease;
  const sides: GarmentRing[] = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1); // 0 at the top edge, 1 at the rim
    const y = height - (height - head.rim) * t;
    // The sides narrow toward the top on a curve, rounding into the top like felt over a block.
    return ringAround(head, y, rimWidth * (1 - taper * (1 - t) ** 2.2), ease);
  });
  const edge = sides[0];
  // The top: from the middle (dipped) out to the edge.
  const cap: GarmentRing[] = [0.02, 0.35, 0.7].map((share) => ({ y: height - dent * (1 - share), rx: edge.rx * share, rz: edge.rz * share }));
  return [...cap, ...sides];
}

/**
 * A brim: a band grown outward from `rim` (its inner edge IS the rim, so it fits any head). For
 * each angle round the head (0 = front) `reach` gives its length and `lift` its height change at
 * the outer edge (negative droops). `span` limits it to an arc round the front (a visor's bill);
 * Math.PI makes a full brim.
 */
export function brimGeometry(rim: GarmentRing, squareness: number, span: number, reach: (angle: number) => number, lift: (angle: number, u: number) => number): BufferGeometry {
  const full = span >= Math.PI;
  const columns = full ? 97 : 49;
  const rows = 7;
  const positions = new Float32Array(columns * rows * 3);
  for (let j = 0; j < columns; j++) {
    const angle = full ? (j / (columns - 1)) * Math.PI * 2 : -span + (2 * span * j) / (columns - 1);
    const [x, z] = crossSection(angle, rim.rx, rim.rz, squareness);
    const out = Math.hypot(x, z) || 1;
    const length = reach(angle);
    for (let i = 0; i < rows; i++) {
      const u = i / (rows - 1);
      const along = length * u;
      positions.set([x + (x / out) * along, rim.y + lift(angle, u) * length, z + (z / out) * along], (j * rows + i) * 3);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < columns - 1; j++) {
    for (let i = 0; i < rows - 1; i++) {
      const a = j * rows + i;
      const b = a + rows;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The point on `ring` at `angle` (0 = front), pushed `out` further from the centre. */
export function onRing(ring: GarmentRing, squareness: number, angle: number, out = 0): Vector3 {
  const [x, z] = crossSection(angle, ring.rx, ring.rz, squareness);
  const length = Math.hypot(x, z) || 1;
  return new Vector3(x + (x / length) * out, ring.y, z + (z / length) * out);
}
