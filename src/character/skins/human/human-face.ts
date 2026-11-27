/**
 * The sculpted details of a human face and hands, laid over the rig's soft forms
 * (`human-body.ts`): every piece is placed ON the head ellipsoid's surface (`surfaceZ`), so it reads
 * as one sculpted face rather than balls stuck on a ball.
 *
 *   nose       a bridge rising between the eyes, a rounded tip, two nostril wings and dark nostrils
 *   head       the head sculpted: cheekbones, a brow ridge, hollows under the cheeks, a chin and the
 *              jaw's corners (`sculptedHead`), so the face is not a perfect egg
 *   ears       the outer ear, a curling helix rim and the bowl inside
 *   brows      hair strokes on each brow (riding the brow the soft eyes move, so they still lift
 *              and knit with the mood), in the hair's colour
 *   hands      a palm, four fingers in two bones each, relaxed in a gentle curl, and a thumb
 *
 * Materials are the zone materials (skin, hair, line), so painting a zone repaints every detail.
 * Pattern: Builder functions over the shared rig; no state of their own.
 */
import { CapsuleGeometry, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Material, type Object3D } from 'three';
import type { HumanFrame } from './human-shape';

/** How far in front of the head's centre its surface is at (x, y), for an ellipsoid head. */
export function surfaceZ(frame: HumanFrame, x: number, y: number): number {
  const [rx, ry, rz] = frame.head;
  return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2));
}

/** Nose placement (head space): the bridge's top and the tip's height. */
const NOSE_TOP_Y = -0.02;
const NOSE_TIP_Y = -0.15;

interface FaceMaterials {
  readonly skin: Material;
  readonly hair: Material;
  readonly line: Material;
}

/** Gaussian bumps sculpted into the head (head-space centre, radius, height along the normal). */
const SCULPT: readonly { readonly at: readonly [number, number, number]; readonly r: number; readonly h: number }[] = [
  // Cheekbones under the outer corners of the eyes.
  { at: [0.36, -0.16, 0.5], r: 0.16, h: 0.035 },
  { at: [-0.36, -0.16, 0.5], r: 0.16, h: 0.035 },
  // The brow ridge over the eyes, a little forward.
  { at: [0, 0.2, 0.68], r: 0.26, h: 0.02 },
  // Soft hollows under the cheekbones, toward the mouth corners.
  { at: [0.3, -0.36, 0.55], r: 0.12, h: -0.02 },
  { at: [-0.3, -0.36, 0.55], r: 0.12, h: -0.02 },
  // The chin, forward and down; the jaw's corners, a touch wider.
  { at: [0, -0.62, 0.42], r: 0.16, h: 0.035 },
  { at: [0.5, -0.45, 0.2], r: 0.22, h: 0.025 },
  { at: [-0.5, -0.45, 0.2], r: 0.22, h: 0.025 },
];

/** How far the sculpt pushes a head-space point `p` (on or near the head) along `normal`. */
function sculptPush(p: Vector3): number {
  let push = 0;
  for (const b of SCULPT) {
    const d2 = (p.x - b.at[0]) ** 2 + (p.y - b.at[1]) ** 2 + (p.z - b.at[2]) ** 2;
    push += b.h * Math.exp(-d2 / (b.r * b.r));
  }
  return push;
}

/** A part of a sphere (three.js' angles: phi round from -x, theta down from the top). */
export interface ShellCut {
  readonly phiStart?: number;
  readonly phiLength?: number;
  readonly thetaStart?: number;
  readonly thetaLength?: number;
  /** Turned back about x by this much before it is sculpted (a hair cap tilts back). */
  readonly tilt?: number;
}

/**
 * A shell over the sculpted head: the frame's ellipsoid grown by `inflate`, cut to `cut`, tilted,
 * then pushed by the same sculpt as the head (`sculptedHead`), so hair, a beard or a fade follows
 * the cheekbones and the chin instead of the chin poking through it.
 */
export function sculptedShell(frame: HumanFrame, inflate: number, cut: ShellCut = {}): SphereGeometry {
  const geometry = new SphereGeometry(1, 96, 72, cut.phiStart ?? 0, cut.phiLength ?? Math.PI * 2, cut.thetaStart ?? 0, cut.thetaLength ?? Math.PI);
  const position = geometry.getAttribute('position');
  const [rx, ry, rz] = frame.head;
  const tilt = cut.tilt ?? 0;
  const c = Math.cos(-tilt);
  const sn = Math.sin(-tilt);
  const p = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const ux = position.getX(i);
    // Tilted about x (the cap leans back so the forehead shows).
    const uy = position.getY(i) * c - position.getZ(i) * sn;
    const uz = position.getY(i) * sn + position.getZ(i) * c;
    p.set(ux * (rx + inflate), uy * (ry + inflate), uz * (rz + inflate));
    normal.set(p.x / (rx * rx), p.y / (ry * ry), p.z / (rz * rz)).normalize();
    p.addScaledVector(normal, sculptPush(p));
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The head itself, sculpted: the frame's ellipsoid with soft cheekbones, a brow ridge, hollows
 * under the cheeks, a chin and the jaw's corners pushed out along the surface normal. The bumps
 * stay small (a few hundredths), so everything placed on `surfaceZ` still sits on the skin.
 */
export function sculptedHead(frame: HumanFrame): SphereGeometry {
  return sculptedShell(frame, 0);
}

/** Adds the nose and ears to `head` (head space). */
export function addFaceDetail(head: Group, frame: HumanFrame, m: FaceMaterials): void {
  const sphere = new SphereGeometry(1, 32, 24);
  const blob = (material: Material, radii: readonly [number, number, number], at: readonly [number, number, number], rot: readonly [number, number, number] = [0, 0, 0]): Mesh => {
    const mesh = new Mesh(sphere, material);
    mesh.scale.set(...radii);
    mesh.position.set(...at);
    mesh.rotation.set(...rot);
    head.add(mesh);
    return mesh;
  };
  const on = (x: number, y: number, out = 0): number => surfaceZ(frame, x, y) + out;

  // The nose: bridge, tip, wings and nostrils.
  blob(m.skin, [0.036, 0.085, 0.04], [0, (NOSE_TOP_Y + NOSE_TIP_Y) / 2, on(0, -0.08, 0.008)], [-0.25, 0, 0]);
  blob(m.skin, [0.06, 0.052, 0.05], [0, NOSE_TIP_Y, on(0, NOSE_TIP_Y, 0.04)]);
  for (const side of [-1, 1]) {
    blob(m.skin, [0.038, 0.034, 0.036], [side * 0.052, NOSE_TIP_Y - 0.018, on(side * 0.052, NOSE_TIP_Y, 0.012)], [0, side * 0.4, 0]);
    blob(m.line, [0.016, 0.009, 0.012], [side * 0.026, NOSE_TIP_Y - 0.045, on(side * 0.026, NOSE_TIP_Y - 0.045, 0.03)], [0.4, 0, side * 0.5]);
  }
  // Ears: an outer ear, a helix curling round its rim, and the bowl inside.
  for (const side of [-1, 1]) {
    const ear = new Group();
    ear.position.set(side * frame.head[0] * 0.97, -0.05, -0.02);
    ear.rotation.y = side * 0.25;
    head.add(ear);
    const outer = new Mesh(sphere, m.skin);
    outer.scale.set(0.05, 0.15, 0.085);
    outer.position.x = side * 0.035;
    ear.add(outer);
    const helix = new Mesh(new TorusGeometry(0.085, 0.022, 8, 24, Math.PI * 1.45), m.skin);
    helix.rotation.set(0, side * Math.PI / 2, Math.PI * 0.27);
    helix.scale.set(1, 1.55, 1);
    helix.position.set(side * 0.06, 0.005, -0.005);
    ear.add(helix);
    const bowl = new Mesh(sphere, m.line);
    bowl.scale.set(0.012, 0.055, 0.03);
    bowl.position.set(side * 0.08, -0.01, 0.01);
    ear.add(bowl);
  }
}

/** Strokes per brow, and their size (head units). */
const BROW_STROKES = 11;
const STROKE_LENGTH = 0.06;
const STROKE_RADIUS = 0.0075;

/**
 * Hair strokes on each brow mesh the soft eyes made (found among `added`, the head's new children):
 * they ride the brow, so they lift and knit with it. The brow capsule lies along its own y (it is
 * turned a quarter about z), so the strokes lie along y, tipped up toward the temple.
 */
export function addBrowStrokes(added: readonly Object3D[], hair: Material, length: number): void {
  const brows = added.filter((o): o is Mesh => o instanceof Mesh && o.geometry instanceof CapsuleGeometry);
  const stroke = new CapsuleGeometry(STROKE_RADIUS, STROKE_LENGTH, 3, 6);
  for (const brow of brows) {
    // Which side of the face (x in head space): strokes lean toward the outer end.
    const side = Math.sign(brow.position.x) || 1;
    for (let i = 0; i < BROW_STROKES; i++) {
      const t = i / (BROW_STROKES - 1) - 0.5;
      const s = new Mesh(stroke, hair);
      // Local y runs along the brow (toward -x in head space after the quarter turn); local x is up.
      // Spread a little above and below the brow's line and in front of it, so the hairs feather its edge.
      s.position.set(0.024 * Math.sin(i * 2.3), t * length * 1.15, 0.018);
      // Along the brow, tipped up toward the temple (hairs grow outward and a little up).
      s.rotation.z = side * (0.32 + 0.25 * t);
      s.scale.y = 0.75 + 0.35 * Math.cos(t * Math.PI);
      brow.add(s);
    }
  }
}

/** The hand's proportions, as shares of the frame's hand size. */
const PALM = { x: 0.42, y: 0.78, z: 0.72 } as const;
const FINGER_RADIUS = 0.17;
const FINGER_BONE = 0.36;
/** How much each finger curls toward the palm (radians per bone). */
const CURL = 0.35;

/**
 * A hand at the end of a hanging arm (arm-bone space: the arm points down -y), its palm facing the
 * body (-x for the left arm, +x for the right), fingers relaxed in a gentle curl, the thumb in
 * front. `centre` is where the old round hand was (held things sit there).
 */
export function buildHand(skin: Material, frame: HumanFrame, side: number, centre: number): Group {
  const h = frame.arm.hand;
  const hand = new Group();
  hand.position.y = centre;
  const sphere = new SphereGeometry(1, 24, 18);
  const palm = new Mesh(sphere, skin);
  palm.scale.set(h * PALM.x, h * PALM.y, h * PALM.z);
  palm.position.y = h * 0.15;
  hand.add(palm);
  const bone = new CapsuleGeometry(h * FINGER_RADIUS, h * FINGER_BONE, 4, 10);
  const inward = -side; // toward the body
  const fingers = [-0.42, -0.14, 0.14, 0.42];
  fingers.forEach((zShare, i) => {
    const length = [0.86, 1, 0.96, 0.8][i];
    const root = new Group();
    root.position.set(0, -h * 0.5, zShare * h * 1.15);
    root.rotation.z = inward * CURL * 0.6;
    hand.add(root);
    const first = new Mesh(bone, skin);
    first.position.y = -h * FINGER_BONE * 0.5 * length;
    first.scale.y = length;
    root.add(first);
    const knuckle = new Group();
    knuckle.position.y = -h * FINGER_BONE * length;
    knuckle.rotation.z = inward * CURL;
    root.add(knuckle);
    const second = new Mesh(bone, skin);
    second.position.y = -h * FINGER_BONE * 0.45 * length;
    second.scale.set(0.92, length * 0.85, 0.92);
    knuckle.add(second);
  });
  // The thumb: in front, angled forward and in, two bones.
  const thumb = new Group();
  thumb.position.set(inward * h * 0.15, -h * 0.05, h * 0.62);
  thumb.rotation.set(0.7, 0, inward * 0.5);
  hand.add(thumb);
  const t1 = new Mesh(bone, skin);
  t1.position.y = -h * FINGER_BONE * 0.5;
  t1.scale.set(1.12, 1, 1.12);
  thumb.add(t1);
  const t2 = new Mesh(bone, skin);
  t2.position.y = -h * FINGER_BONE * 1.15;
  t2.rotation.z = inward * 0.3;
  t2.scale.set(1.05, 0.8, 1.05);
  thumb.add(t2);
  return hand;
}
