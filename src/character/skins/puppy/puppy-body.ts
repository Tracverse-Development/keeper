/**
 * The puppy's sitting body: a pear-shaped caramel torso (a lathe of a Catmull-Rom profile,
 * like the robot's torso, so the silhouette is one crafted curve), a cream bib, front legs
 * with cream paws, round haunches, a navy collar with a small gold ark tag, and a tail.
 *
 * Parts the skin animates are returned: the torso (breathing), the tag (it swings) with
 * its glowing heart (memory sparks leave from it), the tail pivot (wagging), the
 * screen-right front leg's shoulder pivot (`paw`: it lifts and waves hello) and the screen-left
 * hind leg (`scratch`: it swings out and up to scratch an ear). At rest every pivot is where the
 * paw always sat, and the scratching leg's shin is hidden, so the puppy looks as it always did.
 */
import {
  CapsuleGeometry,
  Quaternion,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  SplineCurve,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import type { PuppyKit } from './puppy-kit';
import {
  PUPPY_COLLAR,
  PUPPY_FRONT_LEG,
  PUPPY_FRONT_PAW,
  PUPPY_HIND_PAW,
  PUPPY_HIP,
  PUPPY_NECK_Y,
  PUPPY_SEAT_Y,
  PUPPY_TORSO_DEPTH,
  PUPPY_TORSO_PROFILE,
} from './puppy-shape';

/** The rig's measurements live in `puppy-shape.ts` (shared with the anchors wearables fit). */
const NECK_Y = PUPPY_NECK_Y;
const SEAT_Y = PUPPY_SEAT_Y;
const LEG = PUPPY_FRONT_LEG;
/** The waving leg's shoulder (body space): the top of the screen-right front leg. */
const SHOULDER = [LEG.x, -1.24, 0.46] as const;

export interface PuppyBody {
  readonly torso: Mesh;
  readonly tag: Group;
  readonly heart: Mesh;
  readonly tail: Group;
  /** The screen-right front leg's shoulder pivot (rotate it to lift and wave the paw). */
  readonly paw: Group;
  /** The screen-left hind leg: `pose(amount, t)` swings it out and up to scratch (0 = at rest). */
  readonly scratch: ScratchLeg;
}

export interface ScratchLeg {
  /** The joint the hind paw rides (worn nails follow it). */
  readonly pawJoint: Group;
  pose(amount: number, t: number): void;
}

/** Where the scratching paw reaches (body space): up by the ear on its side. */
const SCRATCH_REACH = [-0.86, -0.42, 0.22] as const;
const SHIN_RADIUS = 0.1;
/** The toes on each front paw: their half-extents, how far apart, and how far below the paw's centre. */
const TOE = { radii: [0.062, 0.06, 0.07] as const, spread: 0.085, lift: -0.035 };

export function addPuppyBody(parent: Object3D, kit: PuppyKit): PuppyBody {
  const m = kit.materials;
  const curve = new SplineCurve(PUPPY_TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)));
  const outline = curve.getSpacedPoints(96).map((p) => new Vector2(Math.max(p.x, 0.001), p.y));
  const torso = new Mesh(new LatheGeometry(outline, 96), m.body);
  torso.position.y = SEAT_Y;
  torso.scale.z = PUPPY_TORSO_DEPTH;
  parent.add(torso);

  kit.blob(parent, m.cream, [0.3, 0.42, 0.22], [0, -0.94, 0.27]); // bib
  const paw = new Group();
  paw.position.set(...SHOULDER);
  parent.add(paw);
  const FP = PUPPY_FRONT_PAW;
  const HP = PUPPY_HIND_PAW;
  const scratch = addScratchLeg(parent, kit);
  for (const side of [-1, 1]) {
    kit.blob(parent, m.legs, [0.32, 0.36, 0.44], [side * 0.46, -1.6, 0.02]); // haunch
    if (side === 1) kit.blob(parent, m.paws, HP.radii, [side * HP.x, HP.y, HP.z]); // hind paw (the other rides the scratching leg)
    // The screen-right leg hangs from the shoulder pivot (positions made relative to it).
    const holder = side === 1 ? paw : parent;
    const [ox, oy, oz] = side === 1 ? SHOULDER : [0, 0, 0];
    const leg = new Mesh(new CapsuleGeometry(LEG.radius, LEG.length, 12, 32), m.legs);
    leg.position.set(side * LEG.x - ox, LEG.y - oy, LEG.z - oz);
    leg.rotation.x = LEG.tilt; // top rounds into the chest as a shoulder, paw forward
    holder.add(leg);
    kit.blob(holder, m.paws, FP.radii, [side * FP.x - ox, FP.y - oy, FP.z - oz]); // front paw
    // Three toe pads rounding the front of the paw, inside its published foot (booties still fit).
    for (const toe of [-1, 0, 1]) kit.blob(holder, m.paws, TOE.radii, [side * FP.x + toe * TOE.spread - ox, FP.y + TOE.lift - oy, FP.z + FP.radii[2] - TOE.radii[2] - oz]);
  }

  const collar = new Mesh(new TorusGeometry(PUPPY_COLLAR.radius, PUPPY_COLLAR.tube, 24, 96), m.collar);
  collar.position.set(0, PUPPY_COLLAR.y, PUPPY_COLLAR.z);
  collar.rotation.x = Math.PI / 2 + PUPPY_COLLAR.lean;
  parent.add(collar);

  const { tag, heart } = buildTag(kit);
  tag.position.set(0, NECK_Y - 0.15, 0.5);
  parent.add(tag);

  const tail = buildTail(kit);
  tail.position.set(0.2, -1.7, -0.5);
  tail.scale.setScalar(1.25);
  parent.add(tail);

  return { torso, tag, heart, tail, paw, scratch };
}

/**
 * The screen-left hind leg, built to scratch: a hip pivot whose leg points at the paw. At rest the
 * leg points down at the paw's own place (the shin hidden: the haunch covers the hip), so the paw
 * sits exactly where it always did; scratching swings the leg out, forward and up toward the ear
 * on that side (a slerp between the two directions, so it sweeps round the outside, never
 * through the body), stretches the shin and shakes it fast. The paw keeps its own level (it is
 * counter-turned), so it reads as a paw, not a stick end.
 */
function addScratchLeg(parent: Object3D, kit: PuppyKit): ScratchLeg {
  const HP = PUPPY_HIND_PAW;
  const hip = new Group();
  hip.name = 'scratch-hip';
  hip.position.set(...PUPPY_HIP);
  parent.add(hip);
  const restDir = new Vector3(-HP.x, HP.y, HP.z).sub(new Vector3(...PUPPY_HIP));
  const restLength = restDir.length();
  const reachDir = new Vector3(...SCRATCH_REACH).sub(new Vector3(...PUPPY_HIP));
  const reachLength = reachDir.length();
  const UP = new Vector3(0, 1, 0);
  const rest = new Quaternion().setFromUnitVectors(UP, restDir.normalize());
  const reach = new Quaternion().setFromUnitVectors(UP, reachDir.normalize());
  const swing = new Group();
  hip.add(swing);
  const shin = new Mesh(new CapsuleGeometry(SHIN_RADIUS, 1, 8, 20), kit.materials.legs);
  shin.visible = false;
  swing.add(shin);
  const pawJoint = new Group();
  pawJoint.name = 'scratch-paw';
  swing.add(pawJoint);
  kit.blob(pawJoint, kit.materials.paws, HP.radii, [0, 0, 0]);
  const level = new Quaternion();

  function pose(amount: number, t: number): void {
    const s = Math.min(Math.max(amount, 0), 1);
    swing.quaternion.slerpQuaternions(rest, reach, s * s * (3 - 2 * s));
    if (s > 0) swing.rotateZ(0.16 * Math.sin(t * 31) * s);
    const length = restLength + (reachLength - restLength) * s;
    pawJoint.position.set(0, length, 0);
    pawJoint.quaternion.copy(level.copy(swing.quaternion).invert());
    shin.visible = s > 0.04;
    shin.position.y = length / 2;
    shin.scale.set(1, length / (1 + 2 * SHIN_RADIUS), 1);
  }
  pose(0, 0);
  return { pawJoint, pose };
}

/** A gold disc on a ring with a small ark crescent and a glowing heart-light on it. */
function buildTag(kit: PuppyKit): { tag: Group; heart: Mesh } {
  const m = kit.materials;
  const tag = new Group();
  const ring = new Mesh(new TorusGeometry(0.034, 0.01, 12, 32), m.gold);
  ring.position.y = -0.005;
  tag.add(ring);

  const disc = new Mesh(new CylinderGeometry(0.1, 0.1, 0.024, 48), m.gold);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = -0.13;
  tag.add(disc);

  const hull = new Mesh(new TorusGeometry(0.055, 0.011, 12, 48, Math.PI), m.gold);
  hull.rotation.z = Math.PI;
  hull.position.set(0, -0.135, 0.016);
  tag.add(hull);

  const heart = new Mesh(new SphereGeometry(0.019, 16, 12), m.tagGlow);
  heart.position.set(0, -0.115, 0.018);
  tag.add(heart);
  return { tag, heart };
}

/** A tapered curling tail on a pivot at its root; the tip is cream. */
function buildTail(kit: PuppyKit): Group {
  const pivot = new Group();
  const path = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(0.1, 0.12, -0.16),
    new Vector3(0.24, 0.36, -0.2),
    new Vector3(0.3, 0.6, -0.08),
    new Vector3(0.24, 0.76, 0.04),
  ]);
  const segments = 48;
  const radial = 20;
  const geometry = new TubeGeometry(path, segments, 0.085, radial, false);
  const position = geometry.getAttribute('position');
  const centre = new Vector3();
  const vertex = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    path.getPointAt(u, centre);
    const taper = 1 - 0.75 * u ** 1.4;
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j;
      vertex.fromBufferAttribute(position, index).sub(centre).multiplyScalar(taper).add(centre);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  pivot.add(new Mesh(geometry, kit.materials.tail));
  const tip = path.getPointAt(1);
  kit.blob(pivot, kit.materials.cream, [0.03, 0.03, 0.03], [tip.x, tip.y, tip.z]);
  kit.blob(pivot, kit.materials.tail, [0.085, 0.085, 0.085], [0, 0, 0]); // rounded root
  return pivot;
}
