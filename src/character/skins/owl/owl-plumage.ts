/**
 * The owl's plumage and its horn: where every feather layer goes (`owl-feathers.ts` builds them),
 * the hooked beak and the taloned feet. Measured from `owl-shape.ts`, so the feathers lie on the
 * same egg, head and wings the rig draws (and the clothes fit to):
 *
 *   body     brickwork rows over the egg, tips down, skipped where the breast covers it
 *   breast   smaller cream feathers over the chest, barred with dark chevrons
 *   head     rows over the crown, the back and the sides of the head (the face stays clear)
 *   rims     a ring of short dark feathers round each half of the facial disc
 *   discs    fine cream feathers radiating from each eye across the facial disc
 *   wings    coverts over each folded wing, darker toward the tips, and six barred primaries
 *   tufts    each ear tuft a cluster of four long feathers
 *   beak     a curved, hooked upper beak (the lower one, animated, stays in the skin)
 *   talons   three scaled toes per foot, each ending in a curved dark claw
 *
 * Builder: one call per form, all meshes children of the group they ride (the wings' feathers swing
 * with the wing). Feathers wear the zone materials, so a repaint recolours them.
 */
import { CatmullRomCurve3, Group, Matrix4, Mesh, MeshPhysicalMaterial, Quaternion, Euler, TubeGeometry, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { radiusAt } from '../../parts/fit.ts';
import { attach, coverFeathers, ellipsoidSurface, featherGeometry, featherLayer, jitter, type FeatherPlacement } from './owl-feathers';
import { OWL_HEAD, OWL_NECK_Y, OWL_TALONS_Y, OWL_TORSO_SHAPE } from './owl-shape';

/** The breast (an ellipsoid on the front of the egg, body space): `owl-skin.ts` draws it from these. */
export const OWL_BREAST = { centre: [0, OWL_NECK_Y - 0.82, 0.36] as const, radii: [0.48, 0.6, 0.3] as const };
/** The facial disc halves (head space). */
export const OWL_DISC = { x: 0.29, y: -0.02, rx: 0.37, ry: 0.39 } as const;
/** The folded wing's form in its joint's space (side +1; mirrored for the other wing). */
export const OWL_WING = { position: [0.06, -0.48, -0.02] as const, radii: [0.15, 0.6, 0.42] as const, roll: -0.12 } as const;

export interface PlumageMaterials {
  readonly body: Material;
  readonly belly: Material;
  readonly head: Material;
  readonly face: Material;
  readonly wings: Material;
  readonly beak: Material;
  readonly claw: Material;
}

export interface Plumage {
  /** Every geometry made here (meshes are freed with the skin's tree; shared geometries once). */
  readonly geometries: readonly BufferGeometry[];
}

/** Lays every feather layer on the owl's forms. `wings` are the wing joints, right (-x) then left (+x). */
export function addOwlPlumage(body: Object3D, head: Object3D, wings: readonly Object3D[], tufts: readonly Object3D[], m: PlumageMaterials): Plumage {
  const coat = featherGeometry(0.15, 0.17, 0.02);
  const small = featherGeometry(0.115, 0.125, 0.014, 0.3);
  const crown = featherGeometry(0.13, 0.14, 0.016);
  const rim = featherGeometry(0.07, 0.11, 0.01, 0.2);
  const fine = featherGeometry(0.05, 0.1, 0.004, 0.15);
  const covert = featherGeometry(0.11, 0.14, 0.018);
  const primary = featherGeometry(0.1, 0.44, 0.03, 0.18);
  const tuftFeather = featherGeometry(0.085, 0.34, 0.0, 0.35);

  attach(body, featherLayer('owl-body-feathers', coat, m.body, bodyFeathers()));
  attach(body, featherLayer('owl-breast-feathers', small, m.belly, breastFeathers().map((f) => ({ ...f, scale: 0.72 }))));
  attach(head, featherLayer('owl-head-feathers', crown, m.head, headFeathers()));
  attach(head, featherLayer('owl-disc-rims', rim, m.head, rimFeathers()));
  attach(head, featherLayer('owl-disc-feathers', fine, m.face, discFeathers()));
  wings.forEach((joint, i) => {
    const side = i === 0 ? -1 : 1;
    attach(joint, featherLayer('owl-wing-coverts', covert, m.wings, wingCoverts(side)));
    attach(joint, featherLayer('owl-primaries', primary, m.wings, primaries(side)));
  });
  tufts.forEach((pivot, i) => attach(pivot, featherLayer('owl-tuft', tuftFeather, m.head, tuft(i === 0 ? -1 : 1))));
  const beak = buildBeak();
  attach(head, new Mesh(beak, m.beak)).name = 'owl-beak';
  const feet = buildTalons(body, m.beak, m.claw);
  return { geometries: [coat, small, crown, rim, fine, covert, primary, tuftFeather, beak, ...feet] };
}

/** Rows over the egg (body space), skipped where the breast lies over them. */
function bodyFeathers(): FeatherPlacement[] {
  const top = -0.05;
  const bottom = -1.42;
  const depth = OWL_TORSO_SHAPE.depth;
  const surface = (a: number, b: number) => {
    const y = top + (bottom - top) * b;
    const r = radiusAt(OWL_TORSO_SHAPE, y);
    const th = a * Math.PI * 2;
    return new Vector3(r * Math.sin(th), OWL_NECK_Y + y, r * Math.cos(th) * depth);
  };
  const [cx, cy, cz] = OWL_BREAST.centre;
  const [rx, ry, rz] = OWL_BREAST.radii;
  return coverFeathers(surface, {
    rows: 16,
    perRow: 30,
    inside: new Vector3(0, OWL_NECK_Y - 0.7, 0),
    keep: (_a, _b, p) => ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 + ((p.z - cz) / (rz * 1.6)) ** 2 > 0.92,
    // Tawny: each feather a little different, with darker streaks running down the back and flanks.
    tint: (a, b) => {
      const streak = jitter(Math.round(a * 30), 7) > 0.55 && jitter(Math.round(a * 30), Math.round(b * 4)) > -0.2;
      return (streak ? 0.66 : 0.8) + 0.08 * jitter(Math.round(a * 97), Math.round(b * 53)) + 0.06 * (1 - b);
    },
  });
}

/** The breast's cream feathers with dark chevron bars (V-shaped bands, point down). */
function breastFeathers(): FeatherPlacement[] {
  const [cx, cy, cz] = OWL_BREAST.centre;
  const [rx, ry, rz] = OWL_BREAST.radii;
  const centre = new Vector3(cx, cy, cz);
  const surface = (a: number, b: number) => {
    const th = (a - 0.5) * Math.PI * 0.92;
    const phi = (0.06 + 0.86 * b) * Math.PI;
    return new Vector3(Math.sin(phi) * Math.sin(th) * rx, Math.cos(phi) * ry, Math.sin(phi) * Math.cos(th) * rz).add(centre);
  };
  return coverFeathers(surface, {
    rows: 17,
    perRow: 19,
    inside: centre.clone().add(new Vector3(0, 0, -0.2)),
    tint: (_a, _b, p) => {
      const band = (((p.y - cy) * 6 + Math.abs(p.x) * 3.2) % 1 + 1) % 1;
      return band < 0.17 ? [0.66, 0.54, 0.42] : 0.95 + 0.06 * jitter(Math.round(p.x * 50), Math.round(p.y * 50));
    },
  });
}

/** The head's crown, back and sides (head space); the face (discs and beak) stays clear. */
function headFeathers(): FeatherPlacement[] {
  const [rx, ry, rz] = OWL_HEAD;
  return coverFeathers(ellipsoidSurface(new Vector3(), [rx, ry, rz], 0.03, 0.94), {
    rows: 14,
    perRow: 34,
    inside: new Vector3(),
    // the face (both disc halves and the beak) stays clear; the chin below it is feathered
    keep: (_a, _b, p) => !(p.z > 0.25 && Math.abs(p.x) < 0.72 && p.y < 0.36 && p.y > -0.42),
    density: (b) => Math.sin((0.03 + 0.91 * b) * Math.PI),
    scale: (b) => 0.8 + 0.3 * b,
    tint: (a, b) => 0.74 + 0.16 * jitter(Math.round(a * 89), Math.round(b * 41)),
  });
}

/** Fine feathers radiating from each eye across its half of the facial disc (head space, on the disc's dome). */
function discFeathers(): FeatherPlacement[] {
  const out: FeatherPlacement[] = [];
  const disc = { rx: 0.36, ry: 0.38, rz: 0.14, z: 0.56 };
  for (const side of [-1, 1]) {
    const cx = side * OWL_DISC.x;
    for (const ring of [0.55, 0.7, 0.85]) {
      const count = Math.round(26 * ring);
      for (let k = 0; k < count; k++) {
        const t = (k / count) * Math.PI * 2 + ring * 3;
        const ux = Math.cos(t) * ring;
        const uy = Math.sin(t) * ring;
        const x = cx + ux * disc.rx;
        const y = OWL_DISC.y + uy * disc.ry;
        if (side * x < 0.03) continue;
        const z = disc.z + disc.rz * Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
        const normal = new Vector3(ux / disc.rx, uy / disc.ry, Math.sqrt(Math.max(0.05, 1 - ux * ux - uy * uy)) / disc.rz).normalize();
        out.push({ at: new Vector3(x, y, z), normal, toward: new Vector3(Math.cos(t), Math.sin(t), 0), tint: 0.9 + 0.08 * jitter(k, ring * 10), scale: 0.8 + 0.3 * ring });
      }
    }
  }
  return out;
}

/** A ring of short dark feathers round each half of the facial disc, pointing outward (head space). */
function rimFeathers(): FeatherPlacement[] {
  const [hx, hy, hz] = OWL_HEAD;
  const out: FeatherPlacement[] = [];
  const COUNT = 28;
  for (const side of [-1, 1]) {
    for (let k = 0; k < COUNT; k++) {
      const t = (k / COUNT) * Math.PI * 2;
      const x = side * OWL_DISC.x + Math.cos(t) * OWL_DISC.rx;
      const y = OWL_DISC.y + Math.sin(t) * OWL_DISC.ry;
      if (side * x < 0.02) continue; // the two halves meet over the beak: no rim between them
      const inside = 1 - (x / hx) ** 2 - (y / hy) ** 2;
      if (inside <= 0.02) continue;
      const z = hz * Math.sqrt(inside);
      const at = new Vector3(x, y, z);
      const normal = new Vector3(x / hx ** 2, y / hy ** 2, z / hz ** 2).normalize();
      const toward = new Vector3(Math.cos(t), Math.sin(t), 0);
      out.push({ at, normal, toward, tint: 0.5 + 0.08 * jitter(k, side) });
    }
  }
  return out;
}

/** The wing form's matrix in its joint (side +1 or -1). */
function wingMatrix(side: number): Matrix4 {
  const [px, py, pz] = OWL_WING.position;
  return new Matrix4().compose(new Vector3(side * px, py, pz), new Quaternion().setFromEuler(new Euler(0, 0, side * OWL_WING.roll)), new Vector3(...OWL_WING.radii));
}

/** Coverts over the outer face of a folded wing, darker toward its tip. */
function wingCoverts(side: number): FeatherPlacement[] {
  const matrix = wingMatrix(side);
  const centre = new Vector3(side * OWL_WING.position[0], OWL_WING.position[1], OWL_WING.position[2]);
  return coverFeathers(ellipsoidSurface(new Vector3(), [1, 1, 1], 0.06, 0.88, matrix), {
    rows: 10,
    perRow: 22,
    inside: centre,
    keep: (_a, _b, p) => (p.x - centre.x) * side > -0.02,
    tint: (a, b) => 0.95 - 0.32 * b + 0.1 * jitter(Math.round(a * 71), Math.round(b * 37)),
  });
}

/** Six long flight feathers fanned at the bottom back of a folded wing, barred light and dark. */
function primaries(side: number): FeatherPlacement[] {
  return Array.from({ length: 6 }, (_, k) => ({
    at: new Vector3(side * (0.13 - 0.012 * k), -0.78 - 0.02 * k, -0.3 + k * 0.085),
    normal: new Vector3(side, 0.05, -0.1),
    toward: new Vector3(side * 0.06, -1, -0.32 + 0.06 * k),
    tint: k % 2 ? 0.66 : 0.9,
    scale: 1 - 0.05 * k,
  }));
}

/** An ear tuft: four long feathers fanned upward from the pivot, the outer ones leaning out. */
function tuft(side: number): FeatherPlacement[] {
  return Array.from({ length: 4 }, (_, k) => ({
    at: new Vector3(side * (k - 1.5) * 0.03, -0.04, 0.01 * k),
    normal: new Vector3(0, 0, 1),
    toward: new Vector3(side * (0.08 + 0.12 * k), 1, -0.05),
    tint: k === 3 ? 0.6 : 0.85 - 0.06 * k,
    scale: 1 - 0.1 * Math.abs(k - 1),
  }));
}

/** The upper beak: a tube along a hooked curve, thick at the face and tapering to a sharp, down-curved tip. */
function buildBeak(): TubeGeometry {
  const path = new CatmullRomCurve3([new Vector3(0, -0.06, 0.66), new Vector3(0, -0.1, 0.77), new Vector3(0, -0.2, 0.83), new Vector3(0, -0.3, 0.8)]);
  const geometry = new TubeGeometry(path, 24, 0.075, 16, false);
  const position = geometry.getAttribute('position');
  const ring = 17;
  const point = new Vector3();
  const centre = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const t = Math.floor(i / ring) / 24;
    path.getPointAt(t, centre);
    point.fromBufferAttribute(position, i).sub(centre);
    const taper = Math.max(0.06, (1 - t) ** 1.1);
    point.multiplyScalar(taper);
    point.x *= 0.8; // narrower than deep
    position.setXYZ(i, centre.x + point.x, centre.y + point.y, centre.z + point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Three toes per foot gripping the ark, each a short scaled segment and a curved dark claw. */
function buildTalons(body: Object3D, toe: Material, claw: Material): BufferGeometry[] {
  const made: BufferGeometry[] = [];
  const feet = new Group();
  feet.name = 'owl-talons';
  body.add(feet);
  for (const side of [-1, 1]) {
    for (const spread of [-0.4, 0, 0.4]) {
      const root = new Vector3(side * 0.22, OWL_TALONS_Y + 0.05, 0.38);
      const dir = new Vector3(Math.sin(spread), 0, Math.cos(spread));
      const knuckle = root.clone().addScaledVector(dir, 0.1).add(new Vector3(0, 0.015, 0));
      const tip = knuckle.clone().addScaledVector(dir, 0.07).add(new Vector3(0, -0.06, 0));
      const toeGeometry = new TubeGeometry(new CatmullRomCurve3([root, knuckle]), 6, 0.034, 10, false);
      const clawCurve = new CatmullRomCurve3([knuckle, knuckle.clone().addScaledVector(dir, 0.05).add(new Vector3(0, 0.005, 0)), tip]);
      const clawGeometry = taperedTube(clawCurve, 0.024);
      made.push(toeGeometry, clawGeometry);
      feet.add(new Mesh(toeGeometry, toe), new Mesh(clawGeometry, claw));
    }
  }
  return made;
}

/** A tube along `curve` from `radius` down to a point. */
function taperedTube(curve: CatmullRomCurve3, radius: number): TubeGeometry {
  const segments = 10;
  const geometry = new TubeGeometry(curve, segments, radius, 8, false);
  const position = geometry.getAttribute('position');
  const ring = 9;
  const centre = new Vector3();
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const t = Math.floor(i / ring) / segments;
    curve.getPointAt(t, centre);
    point.fromBufferAttribute(position, i).sub(centre).multiplyScalar(Math.max(0.05, 1 - t));
    position.setXYZ(i, centre.x + point.x, centre.y + point.y, centre.z + point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The claws' horn: near-black, glossy. */
export function clawMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: 0x1a1410, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
}
