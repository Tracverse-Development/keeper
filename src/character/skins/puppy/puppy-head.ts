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
 * The face mix (`../../expression-mix.ts`) moves the brow ridges and the ears (`setFace`): focus
 * draws the brows in and down and brings the ears forward, surprise lifts the brows and pricks the
 * ears, sleep lowers both, a happy face lifts the brows a touch and lays the ears softly back. The
 * ears' share is an OFFSET added on top of whatever `setEars` was given, so their sway, flops and
 * twitches keep playing.
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
  /** Jaw opening 0..1 and tongue 0..1. */
  setMouth(open: number, tongue: number): void;
  /** Ear poses, left (-x) then right (+x). */
  setEars(left: EarPose, right: EarPose): void;
  /** A sniff 0..1: the nose twitches up and puffs wider (0 = the nose at rest, exactly). */
  sniff(amount: number): void;
  /** The face mix 0..1 each (brows and the ears' offset); call before `setEars`. All 0 = at rest, exactly. */
  setFace(face: Readonly<PuppyFace>): void;
}

/** The expressions the head draws (the shared `FaceMix`'s fields). */
export interface PuppyFace {
  readonly happy: number;
  readonly focused: number;
  readonly sleepy: number;
  readonly surprised: number;
}

/** How the brows move per expression: lift (head units), in toward the nose, and tilt (+ raises the inner end). */
const BROW_MOVE = {
  happy: { lift: 0.025, inward: 0, tilt: 0.05 },
  focused: { lift: -0.045, inward: 0.035, tilt: -0.32 },
  sleepy: { lift: -0.035, inward: 0, tilt: 0.18 },
  surprised: { lift: 0.08, inward: -0.01, tilt: 0.22 },
} as const;
/** How the ears move per expression (added to their pose): out (+ pricks up and out) and back (+ lays back, - forward). */
const EAR_MOVE = {
  happy: { out: -0.06, back: 0.22 },
  focused: { out: 0.18, back: -0.28 },
  sleepy: { out: -0.16, back: 0.12 },
  surprised: { out: 0.35, back: -0.3 },
} as const;
const FACE_KEYS = ['happy', 'focused', 'sleepy', 'surprised'] as const;

export function addPuppyHead(parent: Object3D, kit: PuppyKit, centreY: number): PuppyHead {
  const m = kit.materials;
  const head = new Group();
  head.name = 'puppy-head';
  head.position.y = centreY;
  parent.add(head);

  kit.blob(head, m.head, SKULL, [0, 0, 0]);
  kit.blob(head, m.muzzle, [0.17, 0.4, 0.12], [0, 0.14, 0.67]); // blaze between the eyes
  for (const side of [-1, 1]) kit.blob(head, m.muzzle, [0.25, 0.2, 0.24], [side * 0.19, -0.27, 0.56]); // cheeks
  const brows = [-1, 1].map((side) => {
    kit.blob(head, m.muzzle, CHEEK_TUFT.radii, [side * CHEEK_TUFT.at[0], CHEEK_TUFT.at[1], CHEEK_TUFT.at[2]]); // cheek tufts
    const brow = kit.blob(head, m.ears, BROW.radii, [side * BROW.at[0], BROW.at[1], BROW.at[2]]);
    brow.rotation.set(-0.35, side * 0.4, side * BROW.tilt);
    return { side, brow };
  });
  const earOffset = { out: 0, back: 0 };
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
      ears[0].rotation.set(left.back + earOffset.back, 0, -(left.out + earOffset.out));
      ears[1].rotation.set(right.back + earOffset.back, 0, right.out + earOffset.out);
    },
    setFace(face) {
      let lift = 0;
      let inward = 0;
      let tilt = 0;
      earOffset.out = 0;
      earOffset.back = 0;
      for (const key of FACE_KEYS) {
        const w = face[key];
        lift += BROW_MOVE[key].lift * w;
        inward += BROW_MOVE[key].inward * w;
        tilt += BROW_MOVE[key].tilt * w;
        earOffset.out += EAR_MOVE[key].out * w;
        earOffset.back += EAR_MOVE[key].back * w;
      }
      for (const { side, brow } of brows) {
        brow.position.set(side * (BROW.at[0] - inward), BROW.at[1] + lift, BROW.at[2]);
        // The ridge's outer end rises with its rest tilt; + tilt here raises the inner end instead.
        brow.rotation.z = side * (BROW.tilt - tilt);
      }
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
