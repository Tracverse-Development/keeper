/**
 * The puppy's head: a round caramel skull with a cream blaze, soft brow ridges in deeper caramel,
 * cream cheeks with fluffy cheek tufts and a muzzle, a glossy nose with nostrils and the groove
 * below it, a hinged lower jaw carrying the tongue, the eyes (`puppy-eyes.ts`) and two long
 * floppy ears.
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
import { PUPPY_SKULL } from './puppy-shape';

/** Skull half-extents (x wide, y tall, z deep). */
export const SKULL = PUPPY_SKULL;
const EAR = { thickness: 0.09, length: 0.58, width: 0.33, pivotX: 0.62, pivotY: 0.42, pivotZ: 0.06 };
const JAW_HINGE = [0, -0.33, 0.52] as const;
/** Largest jaw opening (radians) and how far the tongue slides out at full `tongue`. */
const JAW_MAX = 0.42;
const TONGUE_REACH = 0.11;
const NOSE_RADII = [0.12, 0.08, 0.09] as const;
const NOSE_AT = [0, -0.07, 0.9] as const;
/** The brow ridges over each eye: centre (side +1), half-extents and their tilt (outer end up). */
const BROW = { at: [0.3, 0.31, 0.65] as const, radii: [0.15, 0.042, 0.075] as const, tilt: 0.22 };
/** The cheek tufts: fluffy cream fullness either side of the muzzle (side +1). */
const CHEEK_TUFT = { at: [0.48, -0.24, 0.38] as const, radii: [0.17, 0.15, 0.15] as const };
/** Nostrils on the nose's front, in the nose's own unit space (side +1), and their size there. */
const NOSTRIL = { at: [0.36, -0.22, 0.88] as const, radii: [0.22, 0.2, 0.2] as const };

/** One ear's pose: swing out from the head, flop back, and droop forward (radians). */
export interface EarPose {
  out: number;
  back: number;
}

export interface PuppyHead {
  readonly head: Group;
  readonly eyes: PuppyEyes;
  /** The ear pivots, left (-x) then right (+x), and where each ear's tip hangs from its pivot. */
  readonly ears: readonly Group[];
  readonly earTips: readonly (readonly [number, number, number])[];
  /** Jaw opening 0..1 and tongue 0..1. */
  setMouth(open: number, tongue: number): void;
  /** Ear poses, left (-x) then right (+x). */
  setEars(left: EarPose, right: EarPose): void;
  /** A sniff 0..1: the nose twitches up and puffs wider (0 = the nose at rest, exactly). */
  sniff(amount: number): void;
}

export function addPuppyHead(parent: Object3D, kit: PuppyKit, centreY: number): PuppyHead {
  const m = kit.materials;
  const head = new Group();
  head.name = 'puppy-head';
  head.position.y = centreY;
  parent.add(head);

  kit.blob(head, m.head, SKULL, [0, 0, 0]);
  kit.blob(head, m.muzzle, [0.17, 0.4, 0.12], [0, 0.14, 0.67]); // blaze between the eyes
  for (const side of [-1, 1]) kit.blob(head, m.muzzle, [0.25, 0.2, 0.24], [side * 0.19, -0.27, 0.56]); // cheeks
  for (const side of [-1, 1]) {
    kit.blob(head, m.muzzle, CHEEK_TUFT.radii, [side * CHEEK_TUFT.at[0], CHEEK_TUFT.at[1], CHEEK_TUFT.at[2]]); // cheek tufts
    const brow = kit.blob(head, m.ears, BROW.radii, [side * BROW.at[0], BROW.at[1], BROW.at[2]]);
    brow.rotation.set(-0.35, side * 0.4, side * BROW.tilt);
  }
  kit.blob(head, m.muzzle, [0.3, 0.2, 0.27], [0, -0.2, 0.64]); // muzzle
  const nose = kit.blob(head, m.nose, NOSE_RADII, NOSE_AT);
  // Nostrils ride the nose (they puff with its sniff); the groove runs down from it to the mouth.
  for (const side of [-1, 1]) kit.blob(nose, m.mouth, NOSTRIL.radii, [side * NOSTRIL.at[0], NOSTRIL.at[1], NOSTRIL.at[2]]).userData.noFur = true;
  kit.blob(head, m.mouth, [0.009, 0.06, 0.012], [0, -0.19, 0.895]).userData.noFur = true;
  kit.blob(head, m.mouth, [0.16, 0.09, 0.16], [0, -0.34, 0.6]); // inside of the mouth

  const jaw = new Group();
  jaw.position.set(...JAW_HINGE);
  head.add(jaw);
  kit.blob(jaw, m.muzzle, [0.16, 0.065, 0.17], [0, -0.03, 0.09]);
  const tongue = kit.blob(jaw, m.tongue, [0.105, 0.034, 0.16], [0, -0.025, 0.16]);

  const eyes = addPuppyEyes(head, kit);
  const ears = [-1, 1].map((side) => addEar(head, kit, side));

  return {
    head,
    eyes,
    ears,
    earTips: [-1, 1].map((side) => [side * 0.13, -EAR.length * 1.8, 0.04] as const),
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
    sniff(amount) {
      nose.scale.set(NOSE_RADII[0] * (1 + 0.12 * amount), NOSE_RADII[1] * (1 - 0.1 * amount), NOSE_RADII[2]);
      nose.position.y = NOSE_AT[1] + 0.012 * amount;
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
  pivot.add(new Mesh(geometry, kit.materials.ears));
  return pivot;
}
