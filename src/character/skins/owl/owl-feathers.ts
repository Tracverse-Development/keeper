/**
 * The owl's feathers: thousands of small cupped feathers laid over its forms, so it reads as a
 * feathered bird instead of smooth eggs. Each layer is ONE instanced draw of one feather shape:
 *
 *   coverFeathers   rows of feathers over a surface, every tip pointing down along it and lifted a
 *                   little off it (the overlap is the scalloped look); used for the body, the head,
 *                   the breast (with its dark chevron bars) and the folded wings
 *   rimFeathers     a ring of short dark feathers round each half of the facial disc
 *   primaryFeathers the long flight feathers fanned at the bottom of a folded wing, barred light/dark
 *   tuftFeathers    an ear tuft as a cluster of long feathers
 *
 * Pattern: Builder over one shared feather geometry per size. The feathers wear the zone's own
 * material (the body's, the breast's, the wings'), so the look system repaints them like the form
 * beneath; light and dark marks are per-feather tints (`instanceColor`, multiplied with the
 * material), so a repainted breast keeps its chevrons. Pure layout maths over three.js geometry;
 * the skin owns and disposes the meshes (they are ordinary children of its groups).
 */
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Matrix4, Quaternion, Vector3, type Material, type Object3D } from 'three';

/** How far a feather's root sits off the surface, and how far its tip lifts (world units). */
const ROOT_OFF = 0.006;
/** A feather's grid: points across and along. */
const ACROSS = 7;
const ALONG = 6;
const UP = new Vector3(0, 1, 0);
const tint = new Color();

/**
 * One feather pointing along +Y from its root at the origin, its face toward +Z: rounded tip,
 * cupped across, the tip lifted `lift` off the surface, a raised shaft down the middle.
 */
export function featherGeometry(width: number, length: number, lift: number, cup = 0.25): BufferGeometry {
  const positions: number[] = [];
  for (let j = 0; j < ALONG; j++) {
    const v = j / (ALONG - 1);
    const half = width * 0.5 * Math.sin(Math.min(v * 1.25 + 0.12, 1) * (Math.PI / 2)) ** 0.7 * (v > 0.82 ? Math.sqrt(Math.max(0, (1 - v) / 0.18)) : 1);
    for (let i = 0; i < ACROSS; i++) {
      const u = (i / (ACROSS - 1)) * 2 - 1;
      const x = u * Math.max(half, 0.0005);
      const z = cup * half * (1 - u * u) + lift * v * v + 0.0015 * (1 - Math.abs(u));
      positions.push(x, v * length, z);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < ALONG - 1; j++) {
    for (let i = 0; i < ACROSS - 1; i++) {
      const a = j * ACROSS + i;
      index.push(a, a + 1, a + ACROSS, a + 1, a + ACROSS + 1, a + ACROSS);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** One feather placed: where its root is, the surface normal there, which way its tip points, and its tint. */
export interface FeatherPlacement {
  readonly at: Vector3;
  readonly normal: Vector3;
  /** Along the surface, toward the tip (need not be exactly tangent; it is made so). */
  readonly toward: Vector3;
  /** Brightness or colour multiplier (1 = the material's own colour). */
  readonly tint: number | readonly [number, number, number];
  /** Size multiplier (1 = the geometry as built). */
  readonly scale?: number;
}

/** Builds one instanced layer of feathers from placements (`name` for debugging). */
export function featherLayer(name: string, geometry: BufferGeometry, material: Material, placements: readonly FeatherPlacement[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(placements.length, 1));
  mesh.name = name;
  mesh.count = placements.length;
  const m = new Matrix4();
  const q = new Quaternion();
  const basis = new Matrix4();
  const x = new Vector3();
  const y = new Vector3();
  const z = new Vector3();
  const s = new Vector3();
  placements.forEach((p, i) => {
    z.copy(p.normal).normalize();
    y.copy(p.toward).addScaledVector(z, -p.toward.dot(z));
    if (y.lengthSq() < 1e-8) y.copy(UP).cross(z).cross(z).negate();
    y.normalize();
    x.crossVectors(y, z).normalize();
    basis.makeBasis(x, y, z);
    q.setFromRotationMatrix(basis);
    const k = p.scale ?? 1;
    m.compose(p.at.clone().addScaledVector(z, ROOT_OFF), q, s.set(k, k, k));
    mesh.setMatrixAt(i, m);
    if (typeof p.tint === 'number') tint.setScalar(p.tint);
    else tint.setRGB(p.tint[0], p.tint[1], p.tint[2]);
    mesh.setColorAt(i, tint);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.raycast = () => undefined; // touch goes to the body's own proxies
  return mesh;
}

/**
 * A surface given as a function of (a, b) in [0,1]² → point; normals are taken from the surface
 * itself (finite differences), facing away from `inside`.
 */
export type Surface = (a: number, b: number) => Vector3;

export interface CoverOptions {
  /** Rows (along b: top to bottom) and feathers per row (along a). */
  readonly rows: number;
  readonly perRow: number;
  /** A point inside the form: normals face away from it. */
  readonly inside: Vector3;
  /** Keep a feather at (a, b, point)? (skip the face, the part under the breast...). */
  readonly keep?: (a: number, b: number, at: Vector3) => boolean;
  /** Per-feather tint (a mark, a gradient); default a slight random light/dark scatter. */
  readonly tint?: (a: number, b: number, at: Vector3) => number | readonly [number, number, number];
  /** Per-feather size by row (b), e.g. smaller near the top. */
  readonly scale?: (b: number) => number;
  /** Which way tips point (default: down along the surface, toward larger b). */
  readonly downward?: boolean;
  /** Share of `perRow` a row gets (by b): rows round a narrow crown hold fewer feathers. Default 1. */
  readonly density?: (b: number) => number;
}

/** Rows of feathers over `surface`, each row offset half a feather (brickwork), tips down along it. */
export function coverFeathers(surface: Surface, options: CoverOptions): FeatherPlacement[] {
  const out: FeatherPlacement[] = [];
  const e = 1e-3;
  for (let r = 0; r < options.rows; r++) {
    const b = (r + 0.5) / options.rows;
    const count = Math.max(3, Math.round(options.perRow * (options.density?.(b) ?? 1)));
    for (let c = 0; c < count; c++) {
      const a = (c + (r % 2 ? 0.5 : 0) + 0.15 * jitter(r, c)) / count;
      const at = surface(a % 1, b);
      if (options.keep && !options.keep(a % 1, b, at)) continue;
      const da = surface((a + e) % 1, b).sub(surface((a - e + 1) % 1, b));
      const db = surface(a % 1, Math.min(b + e, 1)).sub(surface(a % 1, Math.max(b - e, 0)));
      const normal = new Vector3().crossVectors(da, db).normalize();
      if (normal.dot(at.clone().sub(options.inside)) < 0) normal.negate();
      const toward = options.downward === false ? db.clone().negate() : db.clone();
      const t = options.tint ? options.tint(a % 1, b, at) : 0.9 + 0.16 * jitter(c, r);
      out.push({ at, normal, toward, tint: t, scale: options.scale?.(b) });
    }
  }
  return out;
}

/** A point on an ellipsoid (centre, radii) at longitude `a` (0 = front, +z) and latitude `b` (0 top, 1 bottom), limited to b in [b0, b1]. */
export function ellipsoidSurface(centre: Vector3, radii: readonly [number, number, number], b0 = 0.04, b1 = 0.96, matrix?: Matrix4): Surface {
  return (a, b) => {
    const phi = (b0 + (b1 - b0) * b) * Math.PI;
    const theta = a * Math.PI * 2;
    const p = new Vector3(Math.sin(phi) * Math.sin(theta) * radii[0], Math.cos(phi) * radii[1], Math.sin(phi) * Math.cos(theta) * radii[2]).add(centre);
    return matrix ? p.applyMatrix4(matrix) : p;
  };
}

/** A small deterministic scatter in -1..1 for row/column (so the feathers never shimmer between builds). */
export function jitter(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Adds `mesh` to `parent` and returns it (a one-liner for the skin's build). */
export function attach<T extends Object3D>(parent: Object3D, mesh: T): T {
  parent.add(mesh);
  return mesh;
}
