/**
 * The human rig, shared by the man, the woman and the God Keeper: a large soft head with soft eyes
 * (`../soft-eyes.ts`), brows, a nose, a smiling mouth that opens to speak, ears and hair; a torso
 * turned on a lathe from the frame's profile (the top above the waist, the bottom below it); two
 * arms that hang from the shoulders and can wave; and legs with shoes (or bare legs under a skirt,
 * or none under a robe).
 *
 * Rig (joints are Groups, so the skin poses them freely):
 *   root
 *   └ body            - leans and sways (the torso, arms, legs)
 *     ├ head          - turns with the gaze (face, hair, eyes)
 *     ├ leftArm       - the character's own left (+x, screen right): waves hello
 *     │ └ leftForearm - below the elbow: bends forward, wears the watch
 *     ├ rightArm      - its right (-x)
 *     │ └ rightForearm - holds what it carries
 *     └ legs
 *
 * Every soft form is one shared sphere scaled into an ellipsoid (`blob`), so the rig is a handful of
 * geometries. The materials come from the body that builds it (`HumanStyle`): the paint zones own
 * them (skin, hair, eyes, top, bottom, shoes) and `paint` repaints them in place.
 */
import {
  CapsuleGeometry,
  Group,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Material,
  type MeshPhysicalMaterial,
  type Object3D,
} from 'three';
import { profilePoint, type Ring } from '../../parts/fit.ts';
import { addSoftEyes, type SoftEyes } from '../soft-eyes';
import { addBrowStrokes, addFaceDetail, buildHand, sculptedHead, surfaceZ } from './human-face';
import { HUMAN_EYES, HUMAN_HEAD_Y, HUMAN_NECK_Y, HUMAN_SOLE_Y, elbowAt, handY, type HumanFrame } from './human-shape';

export interface HumanMaterials {
  skin: MeshPhysicalMaterial;
  hair: MeshPhysicalMaterial;
  iris: MeshPhysicalMaterial;
  top: MeshPhysicalMaterial;
  bottom: MeshPhysicalMaterial;
  shoes: MeshPhysicalMaterial;
  eye: Material;
  pupil: Material;
  catchlight: Material;
  line: Material;
  mouth: Material;
  lips: MeshPhysicalMaterial;
  /** A beard, when the style has one (the hair's colour, softer). */
  beard?: MeshPhysicalMaterial;
}

export interface HumanStyle {
  readonly frame: HumanFrame;
  readonly materials: HumanMaterials;
  /** How the legs show: trousers (bottom), bare under a skirt (skin), or hidden under a robe. */
  readonly legs: 'trousers' | 'bare' | 'hidden';
  readonly lashes: number;
  /** Adds the hair (and anything else on the head: earrings, a beard) to the head group. */
  readonly dress: (head: Group, blob: Blob) => void;
}

export type Blob = (parent: Object3D, material: Material, radii: readonly [number, number, number], position: readonly [number, number, number]) => Mesh;

export interface HumanRig {
  readonly root: Group;
  readonly body: Group;
  readonly head: Group;
  /** The character's own left arm (+x, screen right: it waves and wears the watch) and right arm (-x: it holds). */
  readonly leftArm: Group;
  readonly rightArm: Group;
  /** The elbows: each forearm (with its hand) bends about its local x, negative = forward. */
  readonly leftForearm: Group;
  readonly rightForearm: Group;
  readonly eyes: SoftEyes;
  /** Where memory sparks leave (the chest). */
  readonly heart: Object3D;
  readonly blob: Blob;
  /** Mouth: opening 0..1, smile -1..1, and the round "o" 0..1. */
  setMouth(open: number, smile: number, o: number): void;
}

/** How far a waving arm lifts (radians about z) and how much it waves. */
const WAVE_LIFT = 1.95;
/** The relaxed elbow's bend (radians, forward) and the extra bend of a waving forearm. */
const REST_BEND = 0.14;
const WAVE_BEND = 0.55;
/** The brows' length (head units): the soft eyes' brow capsule and the hair strokes on it. */
const BROW_LENGTH = 0.13;
/** The mouth's height on the face (head space). */
export const MOUTH_Y = -0.33;

export function buildHumanRig(style: HumanStyle): HumanRig {
  const { frame, materials: m } = style;
  const sphere = new SphereGeometry(1, 56, 40);
  const blob: Blob = (parent, material, radii, position) => {
    const mesh = new Mesh(sphere, material);
    mesh.scale.set(...radii);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const root = new Group();
  root.name = 'human';
  const body = new Group();
  root.add(body);

  // Torso: the top above the waist, the bottom below it (both from the one profile curve).
  const [above, below] = splitProfile(frame.torso, frame.waist);
  for (const [rings, material] of [
    [above, m.top],
    [below, style.legs === 'trousers' ? m.bottom : m.bottom],
  ] as const) {
    const lathe = new Mesh(new LatheGeometry(rings.map(([r, y]) => new Vector2(r, y)), 64), material);
    lathe.position.y = HUMAN_NECK_Y;
    lathe.scale.z = frame.depth;
    body.add(lathe);
  }
  // The neck, between the collar and the head.
  const neck = new Mesh(new CapsuleGeometry(0.15, 0.12, 6, 20), m.skin);
  neck.position.y = HUMAN_NECK_Y + 0.08;
  body.add(neck);

  const heart = new Group();
  heart.position.set(0, HUMAN_NECK_Y - 0.3, frame.torso[4][0] * frame.depth * 0.9);
  body.add(heart);

  const [right, left] = [-1, 1].map((side) => addArm(body, frame, m, side));
  if (style.legs !== 'hidden') addLegs(body, frame, m, style.legs);

  const head = new Group();
  head.name = 'human-head';
  head.position.y = HUMAN_HEAD_Y;
  body.add(head);
  head.add(new Mesh(sculptedHead(frame), m.skin));
  // The sculpted face (nose, cheeks, jaw, chin, ears) over the soft head (`human-face.ts`).
  addFaceDetail(head, frame, m);

  const before = new Set(head.children);
  const eyes = addSoftEyes(head, {
    radius: HUMAN_EYES.radius,
    position: [HUMAN_EYES.x, HUMAN_EYES.y, HUMAN_EYES.z],
    turn: HUMAN_EYES.turn,
    iris: 0.78,
    materials: { eye: m.eye, iris: m.iris, pupil: m.pupil, catchlight: m.catchlight, lid: m.skin, line: m.line },
    lashes: style.lashes,
    brow: { length: BROW_LENGTH, thickness: 0.026, lift: 0.02 },
  });
  // Hair strokes ride the brows the soft eyes just made.
  addBrowStrokes(head.children.filter((c) => !before.has(c)), m.hair, BROW_LENGTH);

  // The mouth: a smiling line (an arc) that opens into a dark oval with lips round it.
  const mouth = new Group();
  // On the sculpted skin (`surfaceZ`), so the lips stand just proud of it.
  mouth.position.set(0, MOUTH_Y, surfaceZ(frame, 0, MOUTH_Y) - 0.012);
  mouth.rotation.x = -0.18;
  head.add(mouth);
  const smileArc = new Mesh(new TorusGeometry(0.12, 0.02, 8, 28, Math.PI), m.line);
  smileArc.rotation.z = Math.PI; // the arc opens upward: a smile
  mouth.add(smileArc);
  // Closed lips round the smile line: a fuller lower lip, a cupid's-bow upper lip.
  const closedLips = new Group();
  mouth.add(closedLips);
  blob(closedLips, m.lips, [0.1, 0.022, 0.03], [0, 0.03, -0.008]);
  for (const side of [-1, 1]) blob(closedLips, m.lips, [0.05, 0.02, 0.028], [side * 0.035, 0.036, -0.006]);
  blob(closedLips, m.lips, [0.085, 0.032, 0.036], [0, -0.035, -0.006]);
  const opening = blob(mouth, m.mouth, [0.1, 0.06, 0.05], [0, -0.04, 0]);
  const lip = new Mesh(new TorusGeometry(1, 0.18, 8, 28), m.lips);
  lip.scale.set(0.1, 0.06, 0.05);
  lip.position.set(0, -0.04, 0.01);
  mouth.add(lip);

  style.dress(head, blob);

  return {
    root,
    body,
    head,
    leftArm: left.shoulder,
    rightArm: right.shoulder,
    leftForearm: left.forearm,
    rightForearm: right.forearm,
    eyes,
    heart,
    blob,
    setMouth(open, smile, o) {
      const a = Math.min(Math.max(Math.max(open, o * 0.8), 0), 1);
      const s = Math.min(Math.max(smile, -1), 1);
      // Closed: only the smile line (curving up as it smiles, flat or down when sad).
      smileArc.visible = closedLips.visible = a < 0.12;
      // The lips follow the smile: wider and lifted at a smile, pressed at a frown.
      closedLips.scale.set(1 + 0.12 * Math.max(s, 0) - 0.15 * o, 1 - 0.2 * Math.abs(s), 1);
      closedLips.position.y = 0.012 * s;
      smileArc.scale.set(1 - 0.15 * o, 0.25 + 0.75 * s, 1);
      smileArc.position.y = 0.03 * (1 - s);
      if (s < 0) smileArc.rotation.z = 0; // a frown: the arc turns over
      else smileArc.rotation.z = Math.PI;
      smileArc.scale.y = 0.2 + 0.7 * Math.abs(s);
      const width = 0.1 * (1 - 0.35 * o) * (0.9 + 0.2 * Math.max(s, 0));
      const height = 0.02 + 0.08 * a;
      opening.visible = lip.visible = a >= 0.12;
      opening.scale.set(width, height, 0.05);
      lip.scale.set(width * 1.04, height * 1.08, 0.05);
    },
  };
}

/** Splits a profile at height `waist` into the rings above and below it (sharing the waist ring). */
function splitProfile(profile: readonly Ring[], waist: number): [Ring[], Ring[]] {
  const samples = Array.from({ length: 72 }, (_, i) => profilePoint(profile, i / 71));
  const cut = samples.findIndex(([, y]) => y <= waist);
  const at = Math.max(1, cut);
  return [samples.slice(0, at + 1), samples.slice(at)];
}

/**
 * One arm hanging from the shoulder: a sleeve and the upper arm on the shoulder joint, then the
 * forearm and a hand on an elbow joint below it. Returns both joints.
 */
function addArm(body: Object3D, frame: HumanFrame, m: HumanMaterials, side: number): { shoulder: Group; forearm: Group } {
  const { arm, shoulder } = frame;
  const joint = new Group();
  joint.name = side < 0 ? 'arm-right' : 'arm-left';
  joint.position.set(side * shoulder.x, HUMAN_NECK_Y + shoulder.y, 0);
  joint.rotation.z = side * arm.spread;
  body.add(joint);
  const sleeveLength = arm.length * 0.36;
  const sleeve = new Mesh(new CapsuleGeometry(arm.sleeve, sleeveLength, 6, 18), m.top);
  sleeve.position.y = -sleeveLength / 2;
  joint.add(sleeve);
  const elbow = elbowAt(frame);
  // The upper arm runs into the elbow; a small ball rounds the joint so a bend never shows a seam.
  const upper = new Mesh(new CapsuleGeometry(arm.radius, elbow - arm.radius * 0.4, 6, 16), m.skin);
  upper.position.y = -elbow / 2;
  joint.add(upper);
  const forearm = new Group();
  forearm.name = side < 0 ? 'forearm-right' : 'forearm-left';
  forearm.position.y = -elbow;
  joint.add(forearm);
  const knob = new Mesh(new SphereGeometry(arm.radius * 0.98, 20, 14), m.skin);
  forearm.add(knob);
  const lowerLength = arm.length * 0.92 - elbow;
  const lower = new Mesh(new CapsuleGeometry(arm.radius * 0.94, lowerLength, 6, 16), m.skin);
  lower.position.y = -lowerLength / 2;
  forearm.add(lower);
  // A hand with fingers and a thumb (`human-face.ts`), centred where held things sit.
  forearm.add(buildHand(m.skin, frame, side, handY(frame) + elbow));
  return { shoulder: joint, forearm };
}

function addLegs(body: Object3D, frame: HumanFrame, m: HumanMaterials, legs: 'trousers' | 'bare'): void {
  const { leg, shoe } = frame;
  for (const side of [-1, 1]) {
    const limb = new Mesh(new CapsuleGeometry(leg.radius, leg.length, 6, 16), legs === 'trousers' ? m.bottom : m.skin);
    limb.position.set(side * leg.x, leg.top - leg.length / 2, 0);
    body.add(limb);
    const foot = new Mesh(new SphereGeometry(1, 28, 18), m.shoes);
    foot.scale.set(...shoe);
    foot.position.set(side * leg.x, HUMAN_SOLE_Y + shoe[1], 0.06);
    body.add(foot);
  }
}

/** The arm pose: `wave` 0..1 lifts the left arm and waves it with `swing`; `sway` swings both a little. */
export function poseArms(rig: HumanRig, frame: HumanFrame, wave: number, swing: number, sway: number, cheer: number): void {
  rig.rightArm.rotation.set(sway * 0.06, 0, -frame.arm.spread - 0.5 * cheer);
  rig.leftArm.rotation.set(-sway * 0.06 - 0.3 * wave, 0, frame.arm.spread + WAVE_LIFT * wave + 0.5 * cheer + 0.5 * swing * wave);
  // Relaxed elbows keep a soft bend that breathes with the sway; a wave bends the forearm up and in.
  rig.rightForearm.rotation.set(-REST_BEND - 0.04 * sway - 0.5 * cheer, 0, 0);
  rig.leftForearm.rotation.set(-REST_BEND + 0.04 * sway - WAVE_BEND * wave - 0.5 * cheer, 0, 0);
}
