/**
 * The robot's fine detail, laid over the body `body.ts` builds (hero pass): it reads as a made
 * machine up close and stays calm at stage size.
 *
 *   seams      panel grooves over the pearl shell (a band round the back of the head, two arcs over
 *              the crown) and round the torso
 *   screws     small gold screw heads round each ear ring and at the visor's corners
 *   visor      a thin line of inner light between the gold rim and the glass, and a soft reflection
 *              sweeping across the glass, so the visor has depth
 *   cables     braided cables from the collar up into the back of the head, with gold ferrules
 *   vents      three slots on each side of the chest
 *
 * Grooves and slots use one dark material; the screws use the body's gold. Pattern: Builder.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import { HEAD_RADII, ellipsoidPatch, surfaceZ } from './head-shape';

interface DetailParts {
  readonly head: Group;
  readonly body: Group;
  readonly gold: Material;
  /** Head centre and neck heights (body space). */
  readonly headY: number;
  readonly neckY: number;
  /** The torso's radius at a height below the neck. */
  readonly torsoRadius: (depth: number) => number;
}

/** Groove size (world units) and the inner light's colour and brightness. */
const GROOVE = 0.0045;
/** How far the crown seams run from the nape (radians round the head's side section). */
const CROWN_ARC = 1.85;
const INNER_LIGHT = 0x3fd8ff;
const INNER_STRENGTH = 1.15;

/** Adds the detail to the body's head and torso (its materials ride the tree, so `disposeTree` frees them). */
export function addRobotDetail(parts: DetailParts): void {
  // Grooves read as shadowed seams in the pearl, not drawn lines: a warm dark grey.
  const groove = new MeshPhysicalMaterial({ color: 0x5a5448, roughness: 0.7, metalness: 0.1 });
  const rubber = new MeshPhysicalMaterial({ color: 0x14182a, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const { head, body, gold } = parts;
  const { x: rx, y: ry, z: rz } = HEAD_RADII;

  // Seams on the head, kept off the face: two arcs from the nape over the crown on each side, a band
  // round the back of the head below the ears, and a ring round the crown above the visor.
  const arcOverCrown = (x: number): void => {
    const k = Math.sqrt(1 - (x / rx) ** 2);
    // A torus lying in the y-z plane; its arc starts at the back (-z) and runs over the top.
    const ring = new Mesh(new TorusGeometry(1, GROOVE / k, 6, 120, CROWN_ARC), groove);
    ring.rotation.y = Math.PI / 2;
    ring.scale.set(rz * k * 1.002, ry * k * 1.002, 1);
    ring.position.x = x;
    head.add(ring);
  };
  arcOverCrown(0.34);
  arcOverCrown(-0.34);
  const band = (y: number, arc: number): void => {
    const k = Math.sqrt(1 - (y / ry) ** 2);
    const holder = new Group();
    holder.rotation.x = Math.PI / 2;
    holder.position.y = y;
    const ring = new Mesh(new TorusGeometry(1, GROOVE / k, 6, 120, arc), groove);
    // Turned so the arc covers the back half (it starts at +x and runs through -z to -x).
    ring.rotation.z = arc < Math.PI * 2 ? Math.PI : 0;
    ring.scale.set(rx * k * 1.002, rz * k * 1.002, 1);
    holder.add(ring);
    head.add(holder);
  };
  band(-0.48, Math.PI);
  band(0.66, Math.PI * 2);

  // Screws: round each ear ring, and at the visor's four corners.
  const screwHead = new CylinderGeometry(0.02, 0.022, 0.012, 20);
  const slot = new BoxGeometry(0.03, 0.004, 0.004);
  const screw = (at: Vector3, normal: Vector3): void => {
    const s = new Group();
    s.position.copy(at);
    s.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal.clone().normalize());
    s.add(new Mesh(screwHead, gold));
    const a = new Mesh(slot, groove);
    a.position.y = 0.007;
    const b = a.clone();
    b.rotation.y = Math.PI / 2;
    s.add(a, b);
    head.add(s);
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const y = 0.02 + Math.sin(a) * 0.235;
      const z = Math.cos(a) * 0.235;
      const x = side * rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2 - (z / rz) ** 2)) * 1.004;
      screw(new Vector3(x, y, z), new Vector3(x / (rx * rx), y / (ry * ry), z / (rz * rz)));
    }
  }
  for (const [x, y] of [[0.66, 0.37], [-0.66, 0.37], [0.66, -0.33], [-0.66, -0.33]]) {
    const z = surfaceZ(x, y, 0.012);
    screw(new Vector3(x, y, z), new Vector3(x / (rx * rx), y / (ry * ry), z / (rz * rz)));
  }

  // The visor's inner light (a sliver between the rim and the glass) and a reflection on the glass.
  const visor = { halfWidth: 0.716, halfHeight: 0.416, centreY: 0.02, exponent: 4.2 };
  const innerLight = new MeshBasicMaterial({ color: new Color(INNER_LIGHT).multiplyScalar(INNER_STRENGTH) });
  head.add(new Mesh(ellipsoidPatch({ ...visor, inflate: 0.0115 }), innerLight));
  const reflection = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, blending: AdditiveBlending, depthWrite: false });
  const sweep = new Mesh(ellipsoidPatch({ halfWidth: 0.16, halfHeight: 0.34, centreY: 0.06, exponent: 2.4, inflate: 0.016 }), reflection);
  sweep.rotation.set(0, -0.38, 0.5);
  head.add(sweep);

  // Cables from the collar up into the back of the head (they ride the head, so they turn with it).
  const neckInHead = parts.neckY - parts.headY;
  const ferrule = new CylinderGeometry(0.034, 0.034, 0.05, 16);
  for (const [x, bow] of [[-0.18, 0.08], [0, 0.12], [0.18, 0.08]]) {
    const start = new Vector3(x, neckInHead + 0.03, -0.22);
    const end = new Vector3(x * 1.4, -0.55, -rz * 0.62);
    const mid = start.clone().lerp(end, 0.5).add(new Vector3(0, 0, -bow));
    const curve = new CatmullRomCurve3([start, mid, end]);
    head.add(new Mesh(new TubeGeometry(curve, 24, 0.026, 10), rubber));
    for (const [at, t] of [[start, 0], [end, 1]] as const) {
      const f = new Mesh(ferrule, gold);
      f.position.copy(at);
      f.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), curve.getTangent(t));
      head.add(f);
    }
  }

  // Torso: two panel grooves and vents on the chest sides.
  for (const depth of [-0.24, -0.86]) {
    const r = parts.torsoRadius(depth);
    const ring = new Mesh(new TorusGeometry(r * 1.003, GROOVE, 6, 128), groove);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = parts.neckY + depth;
    body.add(ring);
  }
  const vent = new BoxGeometry(0.11, 0.016, 0.02);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const depth = -0.38 - i * 0.06;
      const r = parts.torsoRadius(depth);
      const angle = side * 0.95;
      const v = new Mesh(vent, groove);
      v.position.set(Math.sin(angle) * r, parts.neckY + depth, Math.cos(angle) * r);
      v.rotation.y = angle;
      body.add(v);
    }
  }
}
