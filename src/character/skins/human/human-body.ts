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
 *     ├ leftArm       - the character's own left (+x, screen right): waves hello, wears the watch
 *     ├ rightArm      - its right (-x): holds what it carries
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
import { HUMAN_EYES, HUMAN_HEAD_Y, HUMAN_NECK_Y, HUMAN_SOLE_Y, handY, type HumanFrame } from './human-shape';

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
  readonly eyes: SoftEyes;
  /** Where memory sparks leave (the chest). */
  readonly heart: Object3D;
  readonly blob: Blob;
  /** Mouth: opening 0..1, smile -1..1, and the round "o" 0..1. */
  setMouth(open: number, smile: number, o: number): void;
}

/** How far a waving arm lifts (radians about z) and how much it waves. */
const WAVE_LIFT = 1.95;

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

  const [rightArm, leftArm] = [-1, 1].map((side) => addArm(body, frame, m, side));
  if (style.legs !== 'hidden') addLegs(body, frame, m, style.legs);

  const head = new Group();
  head.name = 'human-head';
  head.position.y = HUMAN_HEAD_Y;
  body.add(head);
  blob(head, m.skin, frame.head, [0, 0, 0]);
  for (const side of [-1, 1]) blob(head, m.skin, [0.09, 0.15, 0.08], [side * frame.head[0] * 0.97, -0.05, -0.02]); // ears
  blob(head, m.skin, [0.075, 0.085, 0.07], [0, -0.13, frame.head[2] * 0.97]); // nose

  const eyes = addSoftEyes(head, {
    radius: HUMAN_EYES.radius,
    position: [HUMAN_EYES.x, HUMAN_EYES.y, HUMAN_EYES.z],
    turn: HUMAN_EYES.turn,
    iris: 0.78,
    materials: { eye: m.eye, iris: m.iris, pupil: m.pupil, catchlight: m.catchlight, lid: m.skin, line: m.line },
    lashes: style.lashes,
    brow: { length: 0.13, thickness: 0.026, lift: 0.02 },
  });

  // The mouth: a smiling line (an arc) that opens into a dark oval with lips round it.
  const mouth = new Group();
  mouth.position.set(0, -0.33, frame.head[2] * 0.86);
  mouth.rotation.x = -0.18;
  head.add(mouth);
  const smileArc = new Mesh(new TorusGeometry(0.12, 0.02, 8, 28, Math.PI), m.line);
  smileArc.rotation.z = Math.PI; // the arc opens upward: a smile
  mouth.add(smileArc);
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
    leftArm,
    rightArm,
    eyes,
    heart,
    blob,
    setMouth(open, smile, o) {
      const a = Math.min(Math.max(Math.max(open, o * 0.8), 0), 1);
      const s = Math.min(Math.max(smile, -1), 1);
      // Closed: only the smile line (curving up as it smiles, flat or down when sad).
      smileArc.visible = a < 0.12;
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

/** One arm hanging from the shoulder: a sleeve, the bare arm and a hand. Returns the shoulder joint. */
function addArm(body: Object3D, frame: HumanFrame, m: HumanMaterials, side: number): Group {
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
  const limb = new Mesh(new CapsuleGeometry(arm.radius, arm.length * 0.82, 6, 16), m.skin);
  limb.position.y = -arm.length * 0.5;
  joint.add(limb);
  const hand = new Mesh(new SphereGeometry(arm.hand, 24, 18), m.skin);
  hand.position.y = handY(frame);
  hand.scale.set(1, 1.1, 0.85);
  joint.add(hand);
  return joint;
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
}
