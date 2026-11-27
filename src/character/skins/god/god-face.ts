/**
 * The God Keeper's expressions, drawn in light: its face is a gold mask, so the soft eyes' gold
 * brows and lids vanish into it under the bloom. It wears brows of light instead (two glowing
 * strokes over the eyes) and its whole radiance answers the face mix (`../../expression-mix.ts`):
 *
 *   happy      brows lift and arch outward, the light warms brighter
 *   focused    brows draw in and down to a V, the light steadies a little lower
 *   sleepy     brows settle with their outer ends falling, the light dims
 *   surprised  brows fly up, everything flares
 *
 * `addGodFace` builds the brows on the head; `update` poses them and returns the radiance factor the
 * skin multiplies into its flare (exactly 1 with an all-zero mix). Pattern: Builder returning a small
 * pose function; `godFaceGlow` is pure.
 */
import { CapsuleGeometry, Mesh, type Material, type Object3D } from 'three';
import type { FaceMix } from '../../expression-mix';
import { HUMAN_EYES } from '../human/human-shape.ts';

/** The light brows: length, thickness, and where they sit over each eye (head space). */
const BROW = { length: 0.15, thickness: 0.016, x: HUMAN_EYES.x, y: HUMAN_EYES.y + HUMAN_EYES.radius * 1.45, z: HUMAN_EYES.z + 0.07 } as const;
/** Per expression: lift (head units), in toward the middle, and tilt (radians; + raises the inner end). */
const MOVE = {
  happy: { lift: 0.02, inward: 0, tilt: -0.12 },
  focused: { lift: -0.035, inward: 0.03, tilt: -0.42 },
  sleepy: { lift: -0.03, inward: 0, tilt: 0.24 },
  surprised: { lift: 0.07, inward: -0.01, tilt: 0.18 },
} as const;
/** How much each expression changes the radiance (a share added or taken away). */
const GLOW = { happy: 0.25, focused: -0.12, sleepy: -0.35, surprised: 0.6 } as const;
const KEYS = ['happy', 'focused', 'sleepy', 'surprised'] as const;

/** The radiance factor for a face mix: 1 at rest, brighter glad or surprised, dimmer sleepy. */
export function godFaceGlow(face: Readonly<FaceMix>): number {
  let glow = 1;
  for (const key of KEYS) glow += GLOW[key] * face[key];
  return Math.max(glow, 0.3);
}

export interface GodFace {
  /** Poses the brows for `face` and returns the radiance factor (`godFaceGlow`). */
  update(face: Readonly<FaceMix>): number;
}

/** Adds the brows of light to `head` in `light` (the eyes' own glowing material). */
export function addGodFace(head: Object3D, light: Material): GodFace {
  const geometry = new CapsuleGeometry(BROW.thickness, BROW.length, 4, 10);
  const brows = [-1, 1].map((side) => {
    const brow = new Mesh(geometry, light);
    brow.rotation.z = Math.PI / 2;
    head.add(brow);
    return { side, brow };
  });
  const pose = (face: Readonly<FaceMix>): void => {
    let lift = 0;
    let inward = 0;
    let tilt = 0;
    for (const key of KEYS) {
      lift += MOVE[key].lift * face[key];
      inward += MOVE[key].inward * face[key];
      tilt += MOVE[key].tilt * face[key];
    }
    for (const { side, brow } of brows) {
      brow.position.set(side * (BROW.x - inward), BROW.y + lift, BROW.z);
      // The capsule lies along x after its quarter turn; this tilt raises its inner end when positive.
      brow.rotation.z = Math.PI / 2 - side * (tilt - 0.06);
    }
  };
  pose({ happy: 0, focused: 0, sleepy: 0, surprised: 0 });
  return {
    update(face) {
      pose(face);
      return godFaceGlow(face);
    },
  };
}
