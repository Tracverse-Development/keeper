/**
 * The Nail Set (slot `paws`, dogs only): four little polished nails at the front of every paw.
 *
 * Pattern: Adapter. The part reads the feet the body publishes (`BodyShape.feet`: an ellipsoid
 * per paw, `fit.ts`), never the species: on each foot it puts four claws across the toe line,
 * each one standing straight out of the surface along the foot's normal there, from just above
 * it. A foot is convex, so a nail that starts outside the tangent plane never sinks in. When the
 * live foot joints are given (`PartFit.follow`), each foot's nails follow their joint every frame
 * (the waving front paw, the scratching hind paw); without them (the fit test) they rest in place.
 *
 * Effects: `color` (the polish), `shine` (0 a soft matte nail .. 1 a mirror lacquer).
 */
import { Group, Matrix4, Mesh, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { Foot, PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** Nails per paw, how far across the toe line they spread (radians), and how low on the toe they sit. */
const NAILS = 4;
const SPREAD = 0.95;
const DROP = -0.42;
/** A nail's half-length (out of the paw), half-width and the gap it starts above the surface. */
const NAIL_LENGTH = 0.034;
const NAIL_WIDTH = 0.019;
const LIFT = 0.003;

export function createPawNails(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'paw-nails';
  const feet = fit.shape?.feet ?? [];
  const shine = effectNumber(effects, 'shine');
  const polish = new MeshPhysicalMaterial({
    color: effectColour(effects, 'color'),
    roughness: 0.55 - 0.5 * shine,
    metalness: 0.15,
    clearcoat: shine,
    clearcoatRoughness: 0.05,
  });
  const nail = new SphereGeometry(1, 12, 8);
  const holders = feet.map((foot, i) => {
    const holder = new Group();
    holder.name = `paw-nails-${i}`;
    holder.position.set(...foot.position);
    for (const at of nailPlaces(foot)) {
      const mesh = new Mesh(nail, polish);
      mesh.scale.set(NAIL_WIDTH, NAIL_LENGTH, NAIL_WIDTH);
      mesh.position.copy(at.normal).multiplyScalar(NAIL_LENGTH + LIFT).add(at.point);
      mesh.quaternion.setFromUnitVectors(UP, at.normal);
      holder.add(mesh);
    }
    group.add(holder);
    return holder;
  });

  const follow = fit.follow;
  const inverse = new Matrix4();
  function update(_frame: PartFrame): void {
    if (!follow || follow.feet.length !== holders.length) return;
    // Each foot's nails sit where that foot's joint is now, in the slot anchor's space.
    follow.base.updateWorldMatrix(true, false);
    inverse.copy(follow.base.matrixWorld).invert();
    for (let i = 0; i < holders.length; i++) {
      const joint = follow.feet[i];
      joint.updateWorldMatrix(true, false);
      holders[i].matrixAutoUpdate = false;
      holders[i].matrix.multiplyMatrices(inverse, joint.matrixWorld);
      holders[i].matrixWorldNeedsUpdate = true;
    }
  }

  return { group, update, dispose: () => disposeTree(group) };
}

const UP = new Vector3(0, 1, 0);

/** Where each nail of `foot` sits (relative to the foot's centre) and the outward normal there. */
export function nailPlaces(foot: Foot): { point: Vector3; normal: Vector3 }[] {
  const [rx, ry, rz] = foot.radii;
  return Array.from({ length: NAILS }, (_, k) => {
    const across = ((k / (NAILS - 1)) * 2 - 1) * (SPREAD / 2);
    // A point on the ellipsoid by its angles (across the front, a little below the middle).
    const u = new Vector3(Math.sin(across) * Math.cos(DROP), Math.sin(DROP), Math.cos(across) * Math.cos(DROP));
    const point = new Vector3(u.x * rx, u.y * ry, u.z * rz);
    const normal = new Vector3(point.x / (rx * rx), point.y / (ry * ry), point.z / (rz * rz)).normalize();
    return { point, normal };
  });
}
