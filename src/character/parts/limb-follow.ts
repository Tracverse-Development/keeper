/**
 * Sleeves that follow the arms: binds every sleeve piece of a garment (its tube, cuff, bands) to bones
 * per limb, and each frame moves those bones by how far the limb's joints have moved from rest.
 *
 * Pattern: Adapter, the limb twin of following feet (`PartFit.follow`). A garment still builds its
 * sleeves in the slot anchor's space, fitted to the limbs the body publishes (`fit.ts`); this then
 * reads the live limb joints the anchor carries (`skins/anchors.ts`: each sits at its limb's top with
 * the anchor's turn at rest). So at rest every bone is the identity and the garment looks exactly
 * as built, and when an arm waves (a person's `leftArm`, the puppy's `paw`) its sleeve goes with it.
 * Without live joints (the fit test, a body whose limbs never move) the sleeves simply stay.
 *
 * Sleeves bend at the elbow: a limb that bends (`limb.elbow`, with a live elbow joint) turns each
 * sleeve mesh into a skinned mesh with two bones, the upper arm and the forearm, each vertex weighted
 * by how far down the limb it sits (a smooth blend across the elbow, so the cloth folds round it
 * instead of breaking). A limb that does not bend keeps one bone. Skinning runs on the GPU, so a
 * bending sleeve costs no per-frame work in script beyond setting two matrices.
 *
 * Which limb a piece belongs to is read from where it sits: the limb whose top is nearest the
 * piece's centre. Pieces are found by name (`isSleevePiece`), so a garment opts in by naming its
 * sleeve meshes with one of `SLEEVE_WORDS`.
 */
import { Bone, Box3, BufferAttribute, Matrix4, Mesh, Skeleton, SkinnedMesh, Vector3, type BufferGeometry, type Group, type Object3D } from 'three';
import type { BodyShape, Limb, PartFit } from './fit.ts';

/** Words in a mesh name that mark it as part of a sleeve. */
export const SLEEVE_WORDS = ['sleeve', 'cuff', 'arm-band'] as const;

/** True for a mesh name that is part of a sleeve (`top-sleeve`, `ranger-cuff`, `ranger-arm-band`). */
export function isSleevePiece(name: string): boolean {
  return SLEEVE_WORDS.some((word) => name.includes(word));
}

/** How wide the blend across the elbow is, in limb radii either side of the bend. */
const ELBOW_BLEND = 1.1;

/**
 * The forearm bone's weight for a point `along` the limb (distance down from its top): 0 above the
 * elbow, 1 below it, a smooth step across `blend` either side. Pure: tested by `limb-follow.test.ts`.
 */
export function elbowWeight(along: number, at: number, blend: number): number {
  const t = Math.min(1, Math.max(0, (along - (at - blend)) / (2 * blend)));
  return t * t * (3 - 2 * t);
}

/** How far down `limb` (from its top, along its tilt) a point in the anchor's space sits. */
export function alongLimb(limb: Limb, point: readonly [number, number, number]): number {
  const [, y, z] = limb.position;
  return -(point[1] - y) * Math.cos(limb.tilt) - (point[2] - z) * Math.sin(limb.tilt);
}

/**
 * Binds the sleeve pieces of `group` to the limbs of `shape`, and returns the per-frame update that
 * keeps them on the live arm (a no-op without live joints: the fit test, a body whose limbs never
 * move). Call once, after every piece is built and before the group is shown.
 */
export function followLimbs(group: Group, shape: BodyShape, fit: PartFit): () => void {
  const limbs = shape.limbs ?? [];
  const joints = fit.follow?.limbs;
  const base = fit.follow?.base;
  if (!limbs.length || !joints || !base || joints.length !== limbs.length) return () => undefined;
  const elbows = fit.follow?.elbows ?? [];
  const pieces = group.children.filter((child) => isSleevePiece(child.name));
  if (!pieces.length) return () => undefined;

  group.updateMatrixWorld(true);
  const groupInverse = new Matrix4().copy(group.matrixWorld).invert();
  // Two bones per limb, in the group's space (the anchor's), set each frame: identity at rest.
  const rigs = limbs.map((limb, i) => {
    const upper = new Bone();
    const lower = new Bone();
    upper.name = `limb-${i}-upper`;
    lower.name = `limb-${i}-lower`;
    for (const bone of [upper, lower]) {
      bone.matrixAutoUpdate = false;
      group.add(bone);
    }
    group.updateMatrixWorld(true);
    const skeleton = new Skeleton([upper, lower]);
    const bends = Boolean(limb.elbow && elbows[i]);
    return { limb, upper, lower, skeleton, bends };
  });

  const box = new Box3();
  const centre = new Vector3();
  for (const piece of pieces) {
    box.setFromObject(piece);
    if (box.isEmpty()) continue;
    box.getCenter(centre);
    const rig = rigs[nearestLimb(shape, centre.applyMatrix4(groupInverse))];
    const meshes: Mesh[] = [];
    piece.traverse((o) => {
      if ((o as Mesh).isMesh && !(o as SkinnedMesh).isSkinnedMesh) meshes.push(o as Mesh);
    });
    for (const mesh of meshes) skin(mesh, rig, groupInverse);
  }

  const restInverse = limbs.map((limb) => new Matrix4().makeTranslation(-limb.position[0], -limb.position[1], -limb.position[2]));
  const elbowRestInverse = limbs.map((limb) => {
    const at = limb.elbow?.at ?? 0;
    return new Matrix4().makeTranslation(-limb.position[0], -(limb.position[1] - at * Math.cos(limb.tilt)), -(limb.position[2] - at * Math.sin(limb.tilt)));
  });
  const inverse = new Matrix4();
  return () => {
    base.updateWorldMatrix(true, false);
    inverse.copy(base.matrixWorld).invert();
    rigs.forEach((rig, i) => {
      // Each bone = (base⁻¹ · joint) · rest⁻¹: where the joint sat in the anchor's space when the
      // rig was built, so the identity until the bone moves.
      const joint: Object3D = joints[i];
      joint.updateWorldMatrix(true, false);
      rig.upper.matrix.multiplyMatrices(inverse, joint.matrixWorld).multiply(restInverse[i]);
      const elbow = elbows[i];
      if (rig.bends && elbow) {
        elbow.updateWorldMatrix(true, false);
        rig.lower.matrix.multiplyMatrices(inverse, elbow.matrixWorld).multiply(elbowRestInverse[i]);
      } else rig.lower.matrix.copy(rig.upper.matrix);
      rig.upper.matrixWorldNeedsUpdate = rig.lower.matrixWorldNeedsUpdate = true;
    });
  };
}

/** Replaces `mesh` with a skinned twin on `rig`'s two bones, weighted down the limb. */
function skin(mesh: Mesh, rig: { limb: Limb; skeleton: Skeleton; bends: boolean }, groupInverse: Matrix4): void {
  const geometry: BufferGeometry = mesh.geometry.clone();
  const position = geometry.getAttribute('position');
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  mesh.updateWorldMatrix(true, false);
  const toAnchor = new Matrix4().multiplyMatrices(groupInverse, mesh.matrixWorld);
  const p = new Vector3();
  const at = rig.limb.elbow?.at ?? 0;
  const blend = rig.limb.radius * ELBOW_BLEND;
  for (let v = 0; v < position.count; v++) {
    p.fromBufferAttribute(position, v).applyMatrix4(toAnchor);
    const w = rig.bends ? elbowWeight(alongLimb(rig.limb, [p.x, p.y, p.z]), at, blend) : 0;
    indices[v * 4] = 0;
    indices[v * 4 + 1] = 1;
    weights[v * 4] = 1 - w;
    weights[v * 4 + 1] = w;
  }
  geometry.setAttribute('skinIndex', new BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  const skinned = new SkinnedMesh(geometry, mesh.material);
  skinned.name = mesh.name;
  skinned.position.copy(mesh.position);
  skinned.quaternion.copy(mesh.quaternion);
  skinned.scale.copy(mesh.scale);
  skinned.renderOrder = mesh.renderOrder;
  skinned.castShadow = mesh.castShadow;
  skinned.receiveShadow = mesh.receiveShadow;
  skinned.userData = { ...mesh.userData };
  // The bones move it off its rest bounds: never cull it by them.
  skinned.frustumCulled = false;
  const parent = mesh.parent!;
  parent.add(skinned);
  parent.remove(mesh);
  skinned.updateWorldMatrix(true, false);
  skinned.bind(rig.skeleton, skinned.matrixWorld);
  mesh.geometry.dispose();
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
