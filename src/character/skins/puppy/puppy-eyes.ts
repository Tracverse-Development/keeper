/**
 * The puppy's eyes: big glossy dark eyeballs set into the head, a warm brown iris and
 * pupil that ROLL toward the gaze, two catchlights that stay put (they are reflections of
 * the key light, so the iris moving under them is what reads as "looking at you"), and
 * fur lids that close for blinks and sleep and rise from below for a happy squint.
 *
 * Lids are hemispherical caps a little larger than the eyeball, rotated about the eye's
 * x axis: the upper cap swings down over the front to close, the lower cap swings up to
 * squint. Rotating a cap is free per frame; no geometry is rebuilt.
 *
 * Emotes: `wink` shuts the screen-right eye alone, `pop` swells both eyes (surprise) and
 * `stars` makes the catchlights swell and glint (celebration). All 0 = as before.
 */
import { Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Object3D } from 'three';
import { markIris } from '../../look/iris-glow.ts';
import type { PuppyKit } from './puppy-kit';

const EYE_RADIUS = 0.2;
/** Eye centre in head space (x is mirrored per side) and its outward turn (radians). */
const EYE_POSITION = { x: 0.33, y: 0.08, z: 0.6 };
const EYE_TURN = 0.32;
/** How far the iris rolls for a full gaze (radians). */
const GAZE_YAW = 0.5;
const GAZE_PITCH = 0.38;
/**
 * Lid angles. The upper cap's front edge sits at elevation -angle, the lower cap's at
 * -angle too: open, the edges are far apart; shut, they overlap a little below the eye's
 * middle (0.4 > 0.36), so a closed eye has no gap; a squint raises only the lower lid.
 */
const UPPER_OPEN = -1.15;
const UPPER_SHUT = 0.4;
const LOWER_OPEN = 1.25;
const LOWER_RAISED = 0.36;
/** How far a focused eye's lower lid rises (share of a full squint). */
const NARROW_LIFT = 0.4;

export interface EyePose {
  /** Lid opening 0 shut .. 1 open (>1 is clamped: the puppy's eyes are already wide). */
  open: number;
  /** Happy squint 0..1. */
  squint: number;
  gazeX: number;
  gazeY: number;
  /** Catchlight strength (asleep dims). */
  sparkle: number;
  /** Emote extras 0..1: the screen-right eye shuts, both eyes swell, the catchlights glint. */
  wink?: number;
  pop?: number;
  stars?: number;
  /** Focus 0..1 (`expression-mix.ts`): the lower lids rise flat, a narrowed attentive eye. */
  narrow?: number;
}

export interface PuppyEyes {
  update(pose: EyePose): void;
}

export function addPuppyEyes(head: Object3D, kit: PuppyKit): PuppyEyes {
  const m = kit.materials;
  markIris(m.iris); // the glow material lights it as a luminous iris (`look/iris-glow.ts`)
  const lidRadius = EYE_RADIUS * 1.07;
  const upperCap = new SphereGeometry(lidRadius, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const lowerCap = new SphereGeometry(lidRadius, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const irisCap = new SphereGeometry(EYE_RADIUS * 1.006, 48, 16, 0, Math.PI * 2, 0, 0.66);
  const pupilCap = new SphereGeometry(EYE_RADIUS * 1.012, 48, 12, 0, Math.PI * 2, 0, 0.42);

  const eyes = [-1, 1].map((side) => {
    const eye = new Group();
    eye.position.set(side * EYE_POSITION.x, EYE_POSITION.y, EYE_POSITION.z);
    eye.rotation.y = side * EYE_TURN;
    head.add(eye);

    kit.blob(eye, m.eye, [EYE_RADIUS, EYE_RADIUS, EYE_RADIUS], [0, 0, 0]);

    const roll = new Group();
    eye.add(roll);
    for (const [geometry, material] of [
      [irisCap, m.iris],
      [pupilCap, m.pupil],
    ] as const) {
      const cap = new Mesh(geometry, material);
      cap.rotation.x = Math.PI / 2; // the caps are built around +y; face them forward (+z)
      roll.add(cap);
    }

    // Catchlights live on the eye, not on the rolling iris: fixed reflections.
    const sparkles = [
      { dir: new Vector3(0.3 - side * 0.1, 0.4, 0.86), size: 0.05 },
      { dir: new Vector3(-0.28 - side * 0.05, -0.24, 0.93), size: 0.018 },
    ].map(({ dir, size }) => {
      const dot = kit.blob(eye, m.catchlight, [size, size, size * 0.4], [0, 0, 0]);
      dot.position.copy(dir.normalize().multiplyScalar(EYE_RADIUS * 1.01));
      dot.lookAt(dot.position.clone().multiplyScalar(2));
      dot.rotation.z += side * 0.3;
      return { dot, rest: dot.scale.clone() };
    });

    const upper = new Mesh(upperCap, m.head);
    const lower = new Mesh(lowerCap, m.head);
    upper.userData.noFur = lower.userData.noFur = true; // lids stay smooth when the head grows fur (`fur-shells.ts`)
    // The lower lid hangs in its own tilt joint: a squint lifts its outer corner (a smiling eye).
    const lowerTilt = new Group();
    lowerTilt.add(lower);
    eye.add(upper, lowerTilt);
    const seam = addLashLine(eye, kit);
    return { side, group: eye, roll, upper, lower, lowerTilt, seam, sparkles };
  });

  return {
    update(pose) {
      const open = Math.min(Math.max(pose.open, 0), 1);
      const squint = Math.min(Math.max(pose.squint, 0), 1);
      // A squint also lowers the upper lid a little, so the eye becomes a soft smile.
      const baseClosure = Math.max(1 - open, squint * 0.35);
      const wink = Math.min(Math.max(pose.wink ?? 0, 0), 1);
      const glint = 1 + 0.9 * (pose.stars ?? 0);
      const swell = 1 + 0.14 * (pose.pop ?? 0);
      const narrow = NARROW_LIFT * Math.min(Math.max(pose.narrow ?? 0, 0), 1);
      for (const eye of eyes) {
        const closure = eye.side === 1 ? baseClosure + (1 - baseClosure) * wink : baseClosure;
        eye.group.scale.setScalar(swell);
        eye.roll.rotation.y = pose.gazeX * GAZE_YAW - eye.side * 0.05;
        eye.roll.rotation.x = -pose.gazeY * GAZE_PITCH;
        eye.upper.rotation.x = UPPER_OPEN + (UPPER_SHUT - UPPER_OPEN) * closure;
        eye.lower.rotation.x = LOWER_OPEN + (LOWER_RAISED - LOWER_OPEN) * Math.max(squint, 1 - open, eye.side === 1 ? wink : 0, narrow);
        eye.lowerTilt.rotation.z = eye.side * 0.32 * squint;
        const visible = closure < 0.9 && pose.sparkle > 0.05;
        for (const { dot, rest } of eye.sparkles) {
          dot.visible = visible;
          dot.scale.copy(rest).multiplyScalar(glint);
        }
        eye.seam.visible = closure > 0.8;
      }
    },
  };
}

/**
 * The dark lash line where shut lids meet: a thin arc on the lids' meeting great circle
 * (tilted down in front by the lid angle), so a sleeping eye reads as a content curve.
 */
function addLashLine(eye: Object3D, kit: PuppyKit): Object3D {
  const seam = new Group();
  seam.rotation.x = Math.PI / 2 + (UPPER_SHUT + LOWER_RAISED) / 2;
  const arc = new Mesh(new TorusGeometry(EYE_RADIUS * 1.075, 0.011, 8, 40, Math.PI * 0.6), kit.materials.nose);
  arc.rotation.z = Math.PI * 0.2; // centre the arc on the front of the eye
  seam.add(arc);
  seam.visible = false;
  eye.add(seam);
  return seam;
}
