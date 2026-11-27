/**
 * Soft eyes: the glossy cartoon eye the new bodies share (the man, the woman, the owl, the God
 * Keeper). Built like the puppy's (`puppy/puppy-eyes.ts`, which keeps its own tuned copy): an
 * eyeball, an iris and pupil that ROLL toward the gaze under fixed catchlights, and two lid caps
 * in the face's own material that swing shut for blinks and sleep and rise from below for a
 * happy squint. Each body passes its size, place and materials (`SoftEyeSpec`), and may add
 * lashes (they ride the upper lid) and brows (they lift and knit with the mood).
 *
 * Pose: `open` 0..1, `squint` 0..1, gaze -1..1, `sparkle` (catchlights; asleep dims), and the
 * emote extras `wink` (the screen-right eye), `pop` (both swell) and `stars` (catchlights glint).
 * Everything is a rotation or a scale set per frame; nothing is rebuilt.
 */
import { BoxGeometry, CapsuleGeometry, Group, Mesh, SphereGeometry, TorusGeometry, type Material, type Object3D } from 'three';
import { markIris } from '../look/iris-glow.ts';

export interface SoftEyeSpec {
  readonly radius: number;
  /** Eye centre in head space (x mirrored per side) and the outward turn (radians). */
  readonly position: readonly [number, number, number];
  readonly turn: number;
  /** Share of the eyeball the iris covers (radians of the cap); the pupil is ~0.6 of it. */
  readonly iris: number;
  readonly materials: {
    readonly eye: Material;
    readonly iris: Material;
    readonly pupil: Material;
    readonly catchlight: Material;
    /** The lids (the face's own skin or feathers). */
    readonly lid: Material;
    /** Lash line and brows. */
    readonly line: Material;
  };
  /** Lashes on the upper lid (count per eye; 0 = none). */
  readonly lashes?: number;
  /** A brow above each eye: its length and thickness. */
  readonly brow?: { readonly length: number; readonly thickness: number; readonly lift: number };
}

export interface SoftEyePose {
  open: number;
  squint: number;
  gazeX: number;
  gazeY: number;
  sparkle: number;
  wink?: number;
  pop?: number;
  stars?: number;
  /** -1 frown .. 1 raised (surprise, delight); brows only. */
  brows?: number;
}

export interface SoftEyes {
  update(pose: SoftEyePose): void;
}

const GAZE_YAW = 0.5;
const GAZE_PITCH = 0.36;
const UPPER_OPEN = -1.15;
const UPPER_SHUT = 0.4;
const LOWER_OPEN = 1.25;
const LOWER_RAISED = 0.36;

export function addSoftEyes(head: Object3D, spec: SoftEyeSpec): SoftEyes {
  const r = spec.radius;
  const m = spec.materials;
  // Painted with the glow material, this iris lights as a luminous ring, not a flat disc.
  markIris(m.iris);
  const ball = new SphereGeometry(r, 40, 28);
  const upperCap = new SphereGeometry(r * 1.07, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const lowerCap = new SphereGeometry(r * 1.07, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const irisCap = new SphereGeometry(r * 1.006, 40, 12, 0, Math.PI * 2, 0, spec.iris);
  const pupilCap = new SphereGeometry(r * 1.012, 40, 10, 0, Math.PI * 2, 0, spec.iris * 0.6);
  const dot = new SphereGeometry(1, 16, 12);

  const eyes = [-1, 1].map((side) => {
    const eye = new Group();
    eye.position.set(side * spec.position[0], spec.position[1], spec.position[2]);
    eye.rotation.y = side * spec.turn;
    head.add(eye);
    eye.add(new Mesh(ball, m.eye));

    const roll = new Group();
    eye.add(roll);
    for (const [geometry, material] of [
      [irisCap, m.iris],
      [pupilCap, m.pupil],
    ] as const) {
      const cap = new Mesh(geometry, material);
      cap.rotation.x = Math.PI / 2;
      roll.add(cap);
    }

    const sparkles = [
      { x: 0.3 - side * 0.1, y: 0.42, size: 0.24 },
      { x: -0.3 - side * 0.05, y: -0.24, size: 0.09 },
    ].map(({ x, y, size }) => {
      const mesh = new Mesh(dot, m.catchlight);
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      mesh.position.set(x * r * 1.01, y * r * 1.01, z * r * 1.01);
      mesh.scale.set(size * r, size * r, size * r * 0.4);
      mesh.lookAt(mesh.position.clone().multiplyScalar(2));
      eye.add(mesh);
      return { mesh, rest: mesh.scale.clone() };
    });

    const upper = new Mesh(upperCap, m.lid);
    const lower = new Mesh(lowerCap, m.lid);
    const lowerTilt = new Group();
    lowerTilt.add(lower);
    eye.add(upper, lowerTilt);
    if (spec.lashes) addLashes(upper, r, side, spec.lashes, m.line);

    const seam = new Group();
    seam.rotation.x = Math.PI / 2 + (UPPER_SHUT + LOWER_RAISED) / 2;
    const arc = new Mesh(new TorusGeometry(r * 1.075, r * 0.06, 6, 32, Math.PI * 0.6), m.line);
    arc.rotation.z = Math.PI * 0.2;
    seam.add(arc);
    seam.visible = false;
    eye.add(seam);

    let brow: Mesh | null = null;
    if (spec.brow) {
      brow = new Mesh(new CapsuleGeometry(spec.brow.thickness, spec.brow.length, 4, 10), m.line);
      brow.rotation.z = Math.PI / 2;
      brow.position.set(side * spec.position[0], spec.position[1] + r * 1.25 + spec.brow.lift, spec.position[2] + r * 0.2);
      head.add(brow);
    }
    return { side, eye, roll, upper, lower, lowerTilt, seam, sparkles, brow, browRest: brow?.position.y ?? 0 };
  });

  return {
    update(pose) {
      const open = Math.min(Math.max(pose.open, 0), 1);
      const squint = Math.min(Math.max(pose.squint, 0), 1);
      const baseClosure = Math.max(1 - open, squint * 0.35);
      const wink = Math.min(Math.max(pose.wink ?? 0, 0), 1);
      const glint = 1 + 0.9 * (pose.stars ?? 0);
      const swell = 1 + 0.14 * (pose.pop ?? 0);
      const brows = Math.min(Math.max(pose.brows ?? 0, -1), 1);
      for (const e of eyes) {
        const closure = e.side === 1 ? baseClosure + (1 - baseClosure) * wink : baseClosure;
        e.eye.scale.setScalar(swell);
        e.roll.rotation.y = pose.gazeX * GAZE_YAW - e.side * 0.05;
        e.roll.rotation.x = -pose.gazeY * GAZE_PITCH;
        e.upper.rotation.x = UPPER_OPEN + (UPPER_SHUT - UPPER_OPEN) * closure;
        e.lower.rotation.x = LOWER_OPEN + (LOWER_RAISED - LOWER_OPEN) * Math.max(squint, 1 - open, e.side === 1 ? wink : 0);
        e.lowerTilt.rotation.z = e.side * 0.32 * squint;
        const visible = closure < 0.9 && pose.sparkle > 0.05;
        for (const { mesh, rest } of e.sparkles) {
          mesh.visible = visible;
          mesh.scale.copy(rest).multiplyScalar(glint);
        }
        e.seam.visible = closure > 0.8;
        if (e.brow) {
          // Raised brows lift and open out; a frown lowers them and knits them toward the nose.
          e.brow.position.y = e.browRest + 0.05 * brows * spec.radius * 4 - 0.04 * closure * spec.radius;
          e.brow.rotation.y = 0;
          e.brow.rotation.x = 0;
          e.brow.rotation.z = Math.PI / 2 - e.side * (0.12 * brows - 0.05);
        }
      }
    },
  };
}

/** Lashes: thin blades on the upper lid's outer half, flicking up and out (they move with the lid). */
function addLashes(upper: Object3D, r: number, side: number, count: number, material: Material): void {
  const blade = new BoxGeometry(r * 0.07, r * 0.42, r * 0.04);
  blade.translate(0, r * 0.21, 0);
  for (let i = 0; i < count; i++) {
    const along = 0.25 + (0.55 * i) / Math.max(count - 1, 1); // from the middle out to the corner
    const angle = side * along * 1.25;
    const lash = new Mesh(blade, material);
    // On the lid's front rim (the cap's open edge is its equator, facing +z after the swing).
    lash.position.set(Math.sin(angle) * r * 1.07, 0, Math.cos(angle) * r * 1.07);
    lash.rotation.set(Math.PI / 2 - 0.5, angle, -side * (0.3 + 0.5 * along));
    upper.add(lash);
  }
}
