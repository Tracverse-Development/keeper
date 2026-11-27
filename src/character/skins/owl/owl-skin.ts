/**
 * The owl skin, "Owl": a wise tawny owl perched on the ark: an egg of a body with a pale chest
 * marked in soft chevrons, a round head with a cream facial disc, great amber eyes under pale
 * feather brows, a small gold beak, two ear tufts, folded wings and gold talons.
 *
 * As a `Skin` strategy it reads the shared dials through `soft-pose.ts` and adds its own: the great
 * eyes blink slowly and roll (`soft-eyes.ts`), the brows lift, the beak parts as it speaks, the ear
 * tufts perk when it listens and droop when it sleeps, a wave lifts one wing, a cheer flaps both, and
 * thinking swivels the head further than any other body can (an owl's trick). Every amplitude is data
 * (`reactions.ts`).
 */
import { Color, ConeGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, SphereGeometry, Vector2, type Material } from 'three';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { measureZones, zonesByMaterial } from '../../look/zone-focus';
import { PaintableMaterial } from '../../look/zone-paint';
import { zonesOf, type ResolvedLook } from '../../look/zones';
import { profilePoint } from '../../parts/fit.ts';
import { PALETTE } from '../../palette';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { addSoftEyes } from '../soft-eyes';
import { poseSoftBody, softEyePose } from '../soft-pose';
import { OWL_BODY_DEPTH, OWL_BODY_PROFILE, OWL_EYES, OWL_HEAD, OWL_HEAD_Y, OWL_NECK_Y, OWL_SHOULDER } from './owl-shape';
import { OWL_REACTIONS as R } from './reactions';

type OwlZone = 'head' | 'face' | 'eyes' | 'body' | 'belly' | 'wings' | 'beak';

const feathers = (color: number, sheen: number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({ color, roughness: 0.7, sheen: 1, sheenRoughness: 0.45, sheenColor: new Color(sheen) });

function owlMaterials(): Record<OwlZone, MeshPhysicalMaterial> & { eye: Material; pupil: Material; catchlight: Material; line: Material; mark: Material } {
  return {
    head: feathers(0x8a6744, PALETTE.gold300),
    face: feathers(0xeee0c6, PALETTE.cream50),
    eyes: new MeshPhysicalMaterial({ color: 0xf2a51f, emissive: new Color(0xd97a0c), emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 0.8 }),
    body: feathers(0x8a6744, PALETTE.gold300),
    belly: feathers(0xdcc7a2, PALETTE.cream50),
    wings: feathers(0x6e4f33, PALETTE.gold400),
    beak: new MeshPhysicalMaterial({ color: 0xd8a24a, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 }),
    eye: new MeshPhysicalMaterial({ color: 0x1a120c, roughness: 0.2, clearcoat: 0.6 }),
    pupil: new MeshPhysicalMaterial({ color: 0x030202, roughness: 0.15, clearcoat: 0.6 }),
    catchlight: new MeshBasicMaterial({ color: new Color(PALETTE.cream50).multiplyScalar(1.4) }),
    line: feathers(0xf6ecd8, PALETTE.cream50),
    mark: feathers(0x6a4b2f, PALETTE.gold400),
  };
}

export function createOwlSkin(): Skin {
  const m = owlMaterials();
  const sphere = new SphereGeometry(1, 56, 40);
  const blob = (parent: Object3D, material: Material, radii: readonly [number, number, number], position: readonly [number, number, number]): Mesh => {
    const mesh = new Mesh(sphere, material);
    mesh.scale.set(...radii);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const root = new Group();
  root.name = 'owl';
  const body = new Group();
  root.add(body);
  const egg = new Mesh(
    new LatheGeometry(Array.from({ length: 48 }, (_, i) => profilePoint(OWL_BODY_PROFILE, i / 47)).map(([r, y]) => new Vector2(r, y)), 64),
    m.body,
  );
  egg.position.y = OWL_NECK_Y;
  egg.scale.z = OWL_BODY_DEPTH;
  body.add(egg);
  // The pale chest and its soft chevrons.
  const CHEST_Y = OWL_NECK_Y - 0.82;
  blob(body, m.belly, [0.48, 0.6, 0.3], [0, CHEST_Y, 0.36]);
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row % 2 === 1 && col === 0) continue;
      const x = col * 0.17 + (row % 2) * 0.085 * Math.sign(col || 1);
      // On the chest's surface (the chest is an ellipsoid centred CHEST_Y, half-depth 0.3, 0.36 forward).
      const y = OWL_NECK_Y - 0.55 - row * 0.17;
      const inside = 1 - (x / 0.48) ** 2 - ((y - CHEST_Y) / 0.6) ** 2;
      const mark = blob(body, m.mark, [0.045, 0.022, 0.02], [x, y, 0.36 + 0.3 * Math.sqrt(Math.max(inside, 0)) - 0.004]);
      mark.rotation.z = 0.5 * Math.sign(x || 1);
    }
  }
  const heart = new Object3D();
  heart.position.set(0, OWL_NECK_Y - 0.5, 0.55);
  body.add(heart);

  // Wings: folded along the sides, hinged at the shoulder (the left one waves).
  const [rightWing, leftWing] = [-1, 1].map((side) => {
    const joint = new Group();
    joint.position.set(side * OWL_SHOULDER.x, OWL_NECK_Y + OWL_SHOULDER.y, -0.02);
    body.add(joint);
    const wing = blob(joint, m.wings, [0.15, 0.6, 0.42], [side * 0.06, -0.48, -0.02]);
    wing.rotation.z = -side * 0.12;
    for (let i = 0; i < 3; i++) blob(joint, m.wings, [0.1, 0.24, 0.12], [side * 0.08, -0.98 - i * 0.04, -0.2 + i * 0.12]); // primaries
    return joint;
  });
  // A short fan of tail feathers behind, and the talons in front.
  blob(body, m.wings, [0.32, 0.12, 0.3], [0, -1.86, -0.42]).rotation.x = -0.5;
  const toe = new ConeGeometry(0.035, 0.14, 10);
  for (const side of [-1, 1]) {
    for (const spread of [-0.35, 0, 0.35]) {
      const t = new Mesh(toe, m.beak);
      t.position.set(side * 0.22 + Math.sin(spread) * 0.07, -1.93, 0.42 + Math.cos(spread) * 0.06);
      t.rotation.set(Math.PI / 2, 0, -spread);
      body.add(t);
    }
  }

  const head = new Group();
  head.name = 'owl-head';
  head.position.y = OWL_HEAD_Y;
  body.add(head);
  blob(head, m.head, OWL_HEAD, [0, 0, 0]);
  for (const side of [-1, 1]) blob(head, m.face, [0.36, 0.38, 0.14], [side * OWL_EYES.x, OWL_EYES.y - 0.02, 0.56]); // facial disc
  const beak = new Mesh(new ConeGeometry(0.075, 0.2, 18), m.beak);
  beak.position.set(0, -0.16, 0.74);
  beak.rotation.x = Math.PI + 0.35;
  head.add(beak);
  const lowerBeak = new Mesh(new ConeGeometry(0.05, 0.1, 14), m.beak);
  lowerBeak.position.set(0, -0.24, 0.7);
  lowerBeak.rotation.x = Math.PI + 0.5;
  head.add(lowerBeak);
  const tufts = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * 0.46, 0.55, 0.02);
    head.add(pivot);
    const tuft = new Mesh(new ConeGeometry(0.11, 0.34, 16), m.head);
    tuft.position.y = 0.14;
    pivot.add(tuft);
    return pivot;
  });
  const eyes = addSoftEyes(head, {
    radius: OWL_EYES.radius,
    position: [OWL_EYES.x, OWL_EYES.y, OWL_EYES.z],
    turn: OWL_EYES.turn,
    iris: 0.95,
    materials: { eye: m.eye, iris: m.eyes, pupil: m.pupil, catchlight: m.catchlight, lid: m.face, line: m.line },
    brow: { length: 0.2, thickness: 0.035, lift: 0.05 },
  });

  const slots = addSlotAnchors(root, slotsOf('owl'), { body, head, leftArm: leftWing, rightArm: rightWing });
  const zoneMaterials: Record<OwlZone, MeshPhysicalMaterial> = { head: m.head, face: m.face, eyes: m.eyes, body: m.body, belly: m.belly, wings: m.wings, beak: m.beak };
  const zones = Object.fromEntries(Object.entries(zoneMaterials).map(([z, mat]) => [z, new PaintableMaterial(mat)])) as Record<OwlZone, PaintableMaterial>;
  const focus = measureZones(root, zonesByMaterial(root, zoneMaterials, { wings: 0.9 }));
  const headProxy = addHitProxy(head, { radii: [OWL_HEAD[0] * 1.08, OWL_HEAD[1] * 1.2, OWL_HEAD[2] * 1.05], centre: [0, 0.05, 0] });
  const bodyProxy = addHitProxy(body, { radii: [0.72, 0.8, 0.62], centre: [0, -1.15, 0] });
  const touchOrigin = new Object3D();
  touchOrigin.position.set(0, OWL_HEAD[1] * 1.05, 0.1);
  head.add(touchOrigin);
  let leanSide = 1;

  function apply(f: SkinFrame): void {
    const pose = poseSoftBody({ root, body, head }, f, R, leanSide);
    const e = f.emote;
    const a = f.motion.amplitude;
    // Thinking: the owl's own trick, a slow, wide swivel of the head.
    head.rotation.y += pose.drama * a * 0.5 * Math.sin(pose.t * 0.6);
    eyes.update(softEyePose(f, R));
    const open = Math.max(f.mouth, 0.6 * e.mouthO);
    lowerBeak.rotation.x = Math.PI + 0.5 + 0.5 * open;
    lowerBeak.position.y = -0.24 - 0.03 * open;
    const perk = f.weights.listening * 0.3 + 0.3 * e.wide + 0.2 * f.gotIt - 0.4 * Math.max(e.nap, f.weights.asleep);
    tufts.forEach((tuft, i) => {
      const side = i === 0 ? -1 : 1;
      tuft.rotation.z = -side * (0.45 - 0.25 * perk) + Math.sin(pose.t * 1.3 + i) * 0.02 * a;
    });
    // Wings: a wave lifts the left wing; a cheer flaps both.
    const flap = pose.cheer * Math.abs(Math.sin(pose.t * 9)) * a;
    leftWing.rotation.z = 1.9 * e.paw + 0.35 * e.swing * e.paw + 0.9 * flap;
    rightWing.rotation.z = -0.9 * flap;
  }

  return {
    id: 'owl',
    root,
    gazeAnchor: head,
    sparkOrigin: heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    slots,
    reactions: R,
    focus,
    paint(look: ResolvedLook) {
      for (const zone of zonesOf('owl')) zones[zone as OwlZone]?.paint(look[zone]);
    },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    dispose: () => disposeTree(root),
  };
}
