/**
 * The people's mouth (the man, the woman and the God Keeper's light-drawn lips), on the sculpted
 * skin (`human-face.ts` `surfaceZ`):
 *
 *   closed   a cupid's-bow upper lip and a fuller lower lip, with a fine seam between them that is
 *            only as wide as the lips; smiling lifts its corners (and the upper lip's side lobes)
 *            into a gentle curve that stays inside the lips, a low mood turns the curve over
 *   open     a dark oval with lips round it, for speech, a yawn and the round "o" of surprise
 *
 * The seam is a shallow arc of a circle whose depth follows the smile but never reaches below the
 * lower lip: a deep half-ring there read as a horseshoe hanging under the mouth (the man's "odd"
 * mouth, and it cut into his beard). Pattern: Builder returning a small pose function.
 */
import { Group, Mesh, TorusGeometry, type Material, type Object3D } from 'three';
import { surfaceZ } from './human-face.ts';
import type { HumanFrame } from './human-shape.ts';

/** Places a scaled unit sphere (the rig's `blob`). */
type Blob = (parent: Object3D, material: Material, radii: readonly [number, number, number], position: readonly [number, number, number]) => Mesh;

/** The mouth's height on the face (head space). */
export const MOUTH_Y = -0.33;
/** The seam's circle radius (its ends sit just past the lips' corners) and thickness. */
const SEAM_RADIUS = 0.105;
const SEAM_TUBE = 0.014;
/** The seam's depth as a share of its radius: at rest, and added at a full smile (or frown). */
const SEAM_REST = 0.14;
const SEAM_SMILE = 0.62;
/** Where the lips meet, in the mouth group (between the upper lips' underside and the lower lip's top). */
const SEAM_Y = 0.0;

/** Mouth pose: opening 0..1, smile -1..1, the round "o" 0..1. */
export type MouthPose = (open: number, smile: number, o: number) => void;

/** Adds the mouth to `head` and returns its pose function. */
export function addMouth(head: Object3D, frame: HumanFrame, m: { readonly line: Material; readonly lips: Material; readonly mouth: Material }, blob: Blob): MouthPose {
  const mouth = new Group();
  // On the sculpted skin, so the lips stand just proud of it.
  mouth.position.set(0, MOUTH_Y, surfaceZ(frame, 0, MOUTH_Y) - 0.012);
  mouth.rotation.x = -0.18;
  head.add(mouth);

  const seam = new Mesh(new TorusGeometry(SEAM_RADIUS, SEAM_TUBE, 8, 32, Math.PI), m.line);
  mouth.add(seam);
  // Closed lips: a cupid's-bow upper lip (a centre and two side lobes that lift with a smile) and a fuller lower lip.
  const closedLips = new Group();
  mouth.add(closedLips);
  // The upper lip only just rises out of the skin (the mouth is tipped back, the skin above it
  // rises toward the nose), so the face reads as one fine line over a fuller lower lip.
  blob(closedLips, m.lips, [0.07, 0.014, 0.028], [0, 0.012, 0.0]);
  const lobes = [-1, 1].map((side) => ({ side, mesh: blob(closedLips, m.lips, [0.046, 0.014, 0.027], [side * 0.034, 0.016, -0.002]) }));
  blob(closedLips, m.lips, [0.078, 0.026, 0.034], [0, -0.021, -0.002]);
  const opening = blob(mouth, m.mouth, [0.1, 0.06, 0.05], [0, -0.04, 0]);
  const lip = new Mesh(new TorusGeometry(1, 0.18, 8, 28), m.lips);
  lip.scale.set(0.1, 0.06, 0.05);
  lip.position.set(0, -0.04, 0.01);
  mouth.add(lip);

  return (open, smile, o) => {
    const a = Math.min(Math.max(Math.max(open, o * 0.8), 0), 1);
    const s = Math.min(Math.max(smile, -1), 1);
    const closed = a < 0.12;
    seam.visible = closedLips.visible = closed;
    if (closed) {
      // The lips widen a touch and their corners lift with a smile; pressed a little at a frown.
      closedLips.scale.set(1 + 0.2 * Math.max(s, 0) - 0.15 * o, 1 - 0.12 * Math.abs(s), 1);
      closedLips.position.y = 0.006 * s;
      for (const { side, mesh } of lobes) {
        mesh.rotation.z = side * 0.28 * s;
        mesh.position.y = 0.016 + 0.006 * Math.max(s, 0);
      }
      // A smile is the arc opening upward (corners up), a frown the arc turned over; the arc's
      // middle sits on the seam, so only its corners show past the lips.
      const depth = SEAM_REST + SEAM_SMILE * Math.abs(s);
      seam.rotation.z = s < 0 ? 0 : Math.PI;
      seam.scale.set((1 - 0.15 * o) * (1 + 0.18 * Math.max(s, 0)), depth, 1);
      seam.position.y = SEAM_Y + (s < 0 ? -1 : 1) * SEAM_RADIUS * depth * 0.55;
    }
    const width = 0.1 * (1 - 0.35 * o) * (0.9 + 0.2 * Math.max(s, 0));
    const height = 0.02 + 0.08 * a;
    opening.visible = lip.visible = !closed;
    opening.scale.set(width, height, 0.05);
    lip.scale.set(width * 1.04, height * 1.08, 0.05);
  };
}
