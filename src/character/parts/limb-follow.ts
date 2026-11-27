/**
 * Sleeves that follow the arms: moves every sleeve piece of a garment (its tube, cuff, bands) onto a
 * holder per limb, and each frame turns that holder by how far the limb's bone has moved from rest.
 *
 * Pattern: Adapter, the limb twin of following feet (`PartFit.follow`). A garment still builds its
 * sleeves in the slot anchor's space, fitted to the limbs the body publishes (`fit.ts`); this then
 * reads the live limb joints the anchor carries (`skins/anchors.ts`: each sits at its limb's top with
 * the anchor's turn at rest). So at rest every holder is the identity and the garment looks exactly
 * as built, and when an arm waves (a person's `leftArm`, the puppy's `paw`) its sleeve goes with it.
 * Without live joints (the fit test, a body whose limbs never move) the sleeves simply stay.
 *
 * Which limb a piece belongs to is read from where it sits: the limb whose top is nearest the
 * piece's centre. Pieces are found by name (`isSleevePiece`), so a garment opts in by naming its
 * sleeve meshes with one of `SLEEVE_WORDS`.
 */
import { Box3, Group, Matrix4, Vector3, type Object3D } from 'three';
import type { BodyShape, PartFit } from './fit.ts';

/** Words in a mesh name that mark it as part of a sleeve. */
export const SLEEVE_WORDS = ['sleeve', 'cuff', 'arm-band'] as const;

/** True for a mesh name that is part of a sleeve (`top-sleeve`, `ranger-cuff`, `ranger-arm-band`). */
export function isSleevePiece(name: string): boolean {
  return SLEEVE_WORDS.some((word) => name.includes(word));
}

/**
 * Moves the sleeve pieces of `group` onto one holder per limb of `shape`, and returns the per-frame
 * update that keeps each holder on its limb (a no-op without live joints). Call once, after every
 * piece is built.
 */
export function followLimbs(group: Group, shape: BodyShape, fit: PartFit): () => void {
  const limbs = shape.limbs ?? [];
  if (!limbs.length) return () => undefined;
  const holders = limbs.map((_, i) => {
    const holder = new Group();
    holder.name = `limb-holder-${i}`;
    return holder;
  });
  const box = new Box3();
  const centre = new Vector3();
  const pieces = group.children.filter((child) => isSleevePiece(child.name));
  for (const piece of pieces) {
    box.setFromObject(piece);
    if (box.isEmpty()) continue;
    box.getCenter(centre);
    holders[nearestLimb(shape, centre)].add(piece);
  }
  for (const holder of holders) if (holder.children.length) group.add(holder);

  const joints = fit.follow?.limbs;
  const base = fit.follow?.base;
  if (!joints || !base || joints.length !== limbs.length) return () => undefined;
  // Each holder = (base⁻¹ · joint) · rest⁻¹, where rest is where the joint sat in the anchor's space
  // when the rig was built: the identity until the bone moves.
  const restInverse = limbs.map((limb) => new Matrix4().makeTranslation(-limb.position[0], -limb.position[1], -limb.position[2]));
  const inverse = new Matrix4();
  return () => {
    base.updateWorldMatrix(true, false);
    inverse.copy(base.matrixWorld).invert();
    holders.forEach((holder, i) => {
      const joint: Object3D = joints[i];
      joint.updateWorldMatrix(true, false);
      holder.matrixAutoUpdate = false;
      holder.matrix.multiplyMatrices(inverse, joint.matrixWorld).multiply(restInverse[i]);
      holder.matrixWorldNeedsUpdate = true;
    });
  };
}

/** The limb whose top is nearest `point` (anchor space). */
function nearestLimb(shape: BodyShape, point: Vector3): number {
  let best = 0;
  let bestDistance = Infinity;
  (shape.limbs ?? []).forEach((limb, i) => {
    const d = point.distanceToSquared(new Vector3(...limb.position));
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}
