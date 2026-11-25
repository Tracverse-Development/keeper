/**
 * The puppy's sitting body: a pear-shaped caramel torso (a lathe of a Catmull-Rom profile,
 * like the robot's torso, so the silhouette is one crafted curve), a cream bib, front legs
 * with cream paws, round haunches, a navy collar with a small gold ark tag, and a tail.
 *
 * Parts the skin animates are returned: the torso (breathing), the tag (it swings) with
 * its glowing heart (memory sparks leave from it), and the tail pivot (wagging).
 */
import {
  CapsuleGeometry,
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

/** World height of the neck (top of the torso) and of the seat. */
export const NECK_Y = -0.5;
const SEAT_Y = -1.95;

/** Torso silhouette as (radius, height above the seat). */
const TORSO_PROFILE: readonly [number, number][] = [
  [0.001, 0],
  [0.4, 0.02],
  [0.62, 0.12],
  [0.7, 0.34],
  [0.66, 0.6],
  [0.56, 0.88],
  [0.47, 1.12],
  [0.42, 1.3],
  [0.33, 1.44],
  [0.001, 1.5],
];

export interface PuppyBody {
  readonly torso: Mesh;
  readonly tag: Group;
  readonly heart: Mesh;
  readonly tail: Group;
}

export function addPuppyBody(parent: Object3D, kit: PuppyKit): PuppyBody {
  const m = kit.materials;
  const curve = new SplineCurve(TORSO_PROFILE.map(([r, y]) => new Vector2(r, y)));
  const outline = curve.getSpacedPoints(96).map((p) => new Vector2(Math.max(p.x, 0.001), p.y));
  const torso = new Mesh(new LatheGeometry(outline, 96), m.caramel);
  torso.position.y = SEAT_Y;
  torso.scale.z = 0.88;
  parent.add(torso);

  kit.blob(parent, m.cream, [0.3, 0.42, 0.22], [0, -0.94, 0.27]); // bib
  for (const side of [-1, 1]) {
    kit.blob(parent, m.caramel, [0.32, 0.36, 0.44], [side * 0.46, -1.6, 0.02]); // haunch
    kit.blob(parent, m.cream, [0.15, 0.085, 0.2], [side * 0.6, -1.9, 0.16]); // hind paw
    const leg = new Mesh(new CapsuleGeometry(0.14, 0.46, 12, 32), m.caramel);
    leg.position.set(side * 0.22, -1.55, 0.49);
    leg.rotation.x = -0.15; // top rounds into the chest as a shoulder, paw forward
    parent.add(leg);
    kit.blob(parent, m.cream, [0.17, 0.11, 0.21], [side * 0.22, -1.88, 0.55]); // front paw
  }

  const collar = new Mesh(new TorusGeometry(0.37, 0.066, 24, 96), m.collar);
  collar.position.set(0, NECK_Y - 0.02, 0.03);
  collar.rotation.x = Math.PI / 2 + 0.3;
  parent.add(collar);

  const { tag, heart } = buildTag(kit);
  tag.position.set(0, NECK_Y - 0.15, 0.5);
  parent.add(tag);

  const tail = buildTail(kit);
  tail.position.set(0.2, -1.7, -0.5);
  tail.scale.setScalar(1.25);
  parent.add(tail);

  return { torso, tag, heart, tail };
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
  pivot.add(new Mesh(geometry, kit.materials.caramel));
  const tip = path.getPointAt(1);
  kit.blob(pivot, kit.materials.cream, [0.03, 0.03, 0.03], [tip.x, tip.y, tip.z]);
  kit.blob(pivot, kit.materials.caramel, [0.085, 0.085, 0.085], [0, 0, 0]); // rounded root
  return pivot;
}
