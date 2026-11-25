/**
 * The puppy's head: a round caramel skull with a cream blaze, cream cheeks and muzzle, a
 * glossy nose, a hinged lower jaw carrying the tongue, the eyes (`puppy-eyes.ts`) and two
 * long floppy ears.
 *
 * Rig inside the head group (all joints are Groups, so the skin poses them freely):
 *   head
 *   ├ eyes            - lids and rolling irises (PuppyEyes.update)
 *   ├ jaw             - opens about its hinge; the tongue slides out along it
 *   └ ear pivots x2   - at the top of the skull; ears hang from them and swing
 *
 * The ears are bent once at build time (wider and flared at the tip, narrow at the root),
 * so they hang like soft leather rather than flat paddles.
 */
import { Group, Mesh, SphereGeometry, type Object3D } from 'three';
import { addPuppyEyes, type PuppyEyes } from './puppy-eyes';
import type { PuppyKit } from './puppy-kit';

/** Skull half-extents (x wide, y tall, z deep). */
export const SKULL = [0.86, 0.76, 0.78] as const;
const EAR = { thickness: 0.09, length: 0.58, width: 0.33, pivotX: 0.62, pivotY: 0.42, pivotZ: 0.06 };
const JAW_HINGE = [0, -0.33, 0.52] as const;
/** Largest jaw opening (radians) and how far the tongue slides out at full `tongue`. */
const JAW_MAX = 0.42;
const TONGUE_REACH = 0.11;

/** One ear's pose: swing out from the head, flop back, and droop forward (radians). */
export interface EarPose {
  out: number;
  back: number;
}

export interface PuppyHead {
  readonly head: Group;
  readonly eyes: PuppyEyes;
  /** Jaw opening 0..1 and tongue 0..1. */
  setMouth(open: number, tongue: number): void;
  /** Ear poses, left (-x) then right (+x). */
  setEars(left: EarPose, right: EarPose): void;
}

export function addPuppyHead(parent: Object3D, kit: PuppyKit, centreY: number): PuppyHead {
  const m = kit.materials;
  const head = new Group();
  head.name = 'puppy-head';
  head.position.y = centreY;
  parent.add(head);

  kit.blob(head, m.caramel, SKULL, [0, 0, 0]);
  kit.blob(head, m.cream, [0.17, 0.4, 0.12], [0, 0.14, 0.67]); // blaze between the eyes
  for (const side of [-1, 1]) kit.blob(head, m.cream, [0.25, 0.2, 0.24], [side * 0.19, -0.27, 0.56]); // cheeks
  kit.blob(head, m.cream, [0.3, 0.2, 0.27], [0, -0.2, 0.64]); // muzzle
  kit.blob(head, m.nose, [0.12, 0.08, 0.09], [0, -0.07, 0.9]);
  kit.blob(head, m.mouth, [0.16, 0.09, 0.16], [0, -0.34, 0.6]); // inside of the mouth

  const jaw = new Group();
  jaw.position.set(...JAW_HINGE);
  head.add(jaw);
  kit.blob(jaw, m.cream, [0.16, 0.065, 0.17], [0, -0.03, 0.09]);
  const tongue = kit.blob(jaw, m.tongue, [0.105, 0.034, 0.16], [0, -0.025, 0.16]);

  const eyes = addPuppyEyes(head, kit);
  const ears = [-1, 1].map((side) => addEar(head, kit, side));

  return {
    head,
    eyes,
    setMouth(open, tongueOut) {
      const o = Math.min(Math.max(open, 0), 1);
      const t = Math.min(Math.max(tongueOut, 0), 1) * Math.min(1, 0.25 + o * 1.5);
      jaw.rotation.x = o * JAW_MAX;
      tongue.position.z = 0.16 + t * TONGUE_REACH;
      tongue.position.y = -0.025 - t * 0.03;
      tongue.rotation.x = t * 0.35;
      tongue.visible = o > 0.02 || t > 0.02;
    },
    setEars(left, right) {
      ears[0].rotation.set(left.back, 0, -left.out);
      ears[1].rotation.set(right.back, 0, right.out);
    },
  };
}

/** A long soft ear hanging from a pivot at the top of the skull (side -1 left, 1 right). */
function addEar(head: Object3D, kit: PuppyKit, side: number): Group {
  const pivot = new Group();
  pivot.position.set(side * EAR.pivotX, EAR.pivotY, EAR.pivotZ);
  head.add(pivot);

  const geometry = new SphereGeometry(1, 48, 36);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = (1 - position.getY(i)) / 2; // 0 at the root, 1 at the tip
    const width = EAR.width * (0.55 + 0.45 * Math.sin(Math.min(t * 1.35, 1) * (Math.PI / 2)));
    const x = position.getX(i) * EAR.thickness + side * 0.13 * t * t; // tips flare out
    const y = position.getY(i) * EAR.length - EAR.length * 0.8;
    const z = position.getZ(i) * width + 0.04 * t; // and sit a touch forward
    position.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  pivot.add(new Mesh(geometry, kit.materials.caramelDeep));
  return pivot;
}
