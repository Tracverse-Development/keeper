/**
 * Fitted geometry: the three.js side of the fit Adapter (`fit.ts` does the maths). Turns a stack
 * of garment rings into a thin cloth shell (open at the front by `opening` radians, or closed),
 * and traces a ring or an edge as a curve for piping. Every worn part that wraps the body (the
 * jacket, its collar, the cap's crown, the backpack's belts) is built from these, so they all
 * follow the same surface the species published.
 */
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import { crossSection, type GarmentRing } from './fit.ts';

export interface ShellOptions {
  /** Columns around the body. */
  readonly segments: number;
  /** The gap left at the front (radians, centred on +z); 0 closes the shell. */
  readonly opening: number;
  readonly squareness: number;
}

/** The angle of column `j` of `segments` (0 = the right edge of the opening, going round). */
export function shellAngle(j: number, segments: number, opening: number): number {
  return opening / 2 + ((Math.PI * 2 - opening) * j) / segments;
}

/** A cloth shell through `rings` (top to bottom), as an indexed, UV-mapped grid. */
export function fittedShell(rings: readonly GarmentRing[], options: ShellOptions): BufferGeometry {
  const { segments, opening, squareness } = options;
  const columns = segments + 1;
  const positions = new Float32Array(rings.length * columns * 3);
  const uvs = new Float32Array(rings.length * columns * 2);
  rings.forEach((ring, i) => {
    for (let j = 0; j < columns; j++) {
      const [x, z] = crossSection(shellAngle(j, segments, opening), ring.rx, ring.rz, squareness);
      const k = i * columns + j;
      positions.set([x, ring.y, z], k * 3);
      uvs.set([j / segments, 1 - i / Math.max(rings.length - 1, 1)], k * 2);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * columns + j;
      const b = a + columns;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Points round one ring from angle `from` to `to` (radians, 0 = front), `count` of them. */
export function ringPoints(ring: GarmentRing, squareness: number, from: number, to: number, count: number): Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const [x, z] = crossSection(from + ((to - from) * i) / (count - 1), ring.rx, ring.rz, squareness);
    return new Vector3(x, ring.y, z);
  });
}

/** Points down one edge of a shell (every ring at angle `angle`). */
export function edgePoints(rings: readonly GarmentRing[], squareness: number, angle: number): Vector3[] {
  return rings.map((ring) => {
    const [x, z] = crossSection(angle, ring.rx, ring.rz, squareness);
    return new Vector3(x, ring.y, z);
  });
}

/** Piping: a thin tube through `points` (closed for a full ring). */
export function piping(points: Vector3[], radius: number, closed = false): TubeGeometry {
  return new TubeGeometry(new CatmullRomCurve3(points, closed), Math.max(points.length * 2, 16), radius, 8, closed);
}
