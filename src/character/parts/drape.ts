/**
 * Draped panels for neck pieces that lie over the shoulders and chest (the sailor collar, the
 * stole): a panel whose sides may move ring by ring, and rings that keep going below the neck's
 * published surface with a slight outward lean, so a long end hangs clear of the chest beneath it.
 *
 * Pattern: Adapter helpers over `fit.ts` (pure geometry, no GPU): the wearables-fit test builds and
 * measures everything made from them.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { crossSection, radiusAt, type BodyShape, type GarmentRing } from './fit.ts';

/**
 * A fitted panel through `rings` whose angular span changes ring by ring: ring `i` covers from
 * `from(i)` to `to(i)` (radians, 0 = front, toward +x), in `columns` steps.
 */
export function bandPatch(rings: readonly GarmentRing[], squareness: number, from: (i: number) => number, to: (i: number) => number, columns: number): BufferGeometry {
  const stride = columns + 1;
  const positions = new Float32Array(rings.length * stride * 3);
  const uvs = new Float32Array(rings.length * stride * 2);
  rings.forEach((ring, i) => {
    const a0 = from(i);
    const a1 = to(i);
    for (let j = 0; j <= columns; j++) {
      const [x, z] = crossSection(a0 + ((a1 - a0) * j) / columns, ring.rx, ring.rz, squareness);
      positions.set([x, ring.y, z], (i * stride + j) * 3);
      uvs.set([j / columns, 1 - i / Math.max(rings.length - 1, 1)], (i * stride + j) * 2);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * stride + j;
      index.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
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
 * Rings from `top` down to `bottom`, `ease` off the body. Where the shape has a surface each ring is
 * never narrower than the widest point above it (cloth drapes over the shoulders, it does not cling
 * under them); below the shape's lowest ring the cloth keeps that width and leans out by `lean` per
 * unit of drop, so it hangs clear of whatever lies beneath.
 */
export function drapeRings(shape: BodyShape, top: number, bottom: number, ease: number, count: number, lean: number): GarmentRing[] {
  const lowest = shape.profile[shape.profile.length - 1];
  let widest = 0;
  return Array.from({ length: count }, (_, i) => {
    const y = top + ((bottom - top) * i) / Math.max(count - 1, 1);
    const r = y >= lowest[1] ? radiusAt(shape, y) : 0;
    widest = Math.max(widest, r);
    const below = Math.max(lowest[1] - y, 0);
    const extra = below * lean;
    return { y, rx: widest + ease + extra, rz: widest * shape.depth + ease + extra };
  });
}

/** Points along one edge of a draped panel: ring `i` at angle `angle(i)`, `lift` further out. */
export function drapeEdge(rings: readonly GarmentRing[], squareness: number, angle: (i: number) => number, lift: number): Vector3[] {
  return rings.map((ring, i) => {
    const [x, z] = crossSection(angle(i), ring.rx + lift, ring.rz + lift, squareness);
    return new Vector3(x, ring.y, z);
  });
}
