/**
 * The head's shape and the maths that lays things ON it.
 *
 * The head is an ellipsoid (radii HEAD_RADII, centred at the head group's origin,
 * facing +z). The visor, its gold border, the eyes and the mouth are all patches that
 * hug that surface, so this file is their one source of truth: `surfaceZ` finds the
 * front surface under a point, `ellipsoidPatch` builds a rounded (superellipse) patch
 * on it, and `curvedQuad` builds a UV-mapped quad on it for the glowing glyph shaders.
 */
import { BufferAttribute, BufferGeometry, PlaneGeometry, Vector3 } from 'three';

/** Half-extents of the head ellipsoid (x wide, y tall, z deep). */
export const HEAD_RADII = { x: 1, y: 0.9, z: 0.92 } as const;

/** z of the front surface at (x, y), for an ellipsoid inflated by `inflate` (0.01 = 1%). */
export function surfaceZ(x: number, y: number, inflate = 0): number {
  const a = HEAD_RADII.x * (1 + inflate);
  const b = HEAD_RADII.y * (1 + inflate);
  const c = HEAD_RADII.z * (1 + inflate);
  const inside = 1 - (x / a) ** 2 - (y / b) ** 2;
  return c * Math.sqrt(Math.max(inside, 0));
}

/** Outward normal of the (inflated) ellipsoid at a surface point. */
function surfaceNormal(point: Vector3, inflate: number, out: Vector3): Vector3 {
  const k = 1 + inflate;
  return out
    .set(point.x / (HEAD_RADII.x * k) ** 2, point.y / (HEAD_RADII.y * k) ** 2, point.z / (HEAD_RADII.z * k) ** 2)
    .normalize();
}

export interface PatchShape {
  /** Half width and half height of the patch, measured in the front view. */
  halfWidth: number;
  halfHeight: number;
  /** Vertical centre of the patch in head space. */
  centreY: number;
  /** Superellipse exponent: 2 is an ellipse, 4+ a soft rounded rectangle ("squircle"). */
  exponent: number;
  /** How far above the head surface the patch floats, as a fraction of the radii. */
  inflate: number;
}

/**
 * A rounded patch hugging the head's front: a polar grid (rings x segments) of a
 * superellipse outline, every vertex projected onto the inflated ellipsoid, with true
 * ellipsoid normals so reflections flow smoothly across it.
 */
export function ellipsoidPatch(shape: PatchShape, rings = 24, segments = 128): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const point = new Vector3();
  const normal = new Vector3();
  const power = 2 / shape.exponent;

  const push = (x: number, y: number): void => {
    point.set(x, y, surfaceZ(x, y, shape.inflate));
    surfaceNormal(point, shape.inflate, normal);
    positions.push(point.x, point.y, point.z);
    normals.push(normal.x, normal.y, normal.z);
  };

  push(0, shape.centreY);
  for (let ring = 1; ring <= rings; ring++) {
    const t = ring / rings;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = Math.sign(cos) * Math.abs(cos) ** power * shape.halfWidth * t;
      const y = shape.centreY + Math.sign(sin) * Math.abs(sin) ** power * shape.halfHeight * t;
      push(x, y);
    }
  }

  const indices: number[] = [];
  for (let s = 0; s < segments; s++) indices.push(0, 1 + s, 1 + ((s + 1) % segments));
  for (let ring = 1; ring < rings; ring++) {
    const inner = 1 + (ring - 1) * segments;
    const outer = 1 + ring * segments;
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      indices.push(inner + s, outer + s, outer + next, inner + s, outer + next, inner + next);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * A finely subdivided quad centred at (centreX, centreY) whose vertices sit on the head
 * surface (inflated by `inflate`). Its UVs stay a plain 0..1 square, so a fragment
 * shader can draw a crisp shape on the curved surface.
 */
export function curvedQuad(width: number, height: number, centreX: number, centreY: number, inflate: number): BufferGeometry {
  const geometry = new PlaneGeometry(width, height, 24, 24);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + centreX;
    const y = position.getY(i) + centreY;
    position.setXYZ(i, x, y, surfaceZ(x, y, inflate));
  }
  geometry.computeVertexNormals();
  return geometry;
}
