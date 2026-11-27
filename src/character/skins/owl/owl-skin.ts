/**
 * The owl skin, "Owl": a wise tawny owl perched on the ark, feathered all over (`owl-plumage.ts`):
 * an egg of a body in brickwork feathers, a pale breast barred with dark chevrons, a round head with
 * a cream facial disc ringed by dark rim feathers, great amber eyes under pale feather brows, a
 * hooked gold beak, ear tufts of long feathers, folded wings with barred primaries and taloned feet.
 *
 * As a `Skin` strategy it reads the shared dials through `soft-pose.ts` and adds its own: the great
 * eyes blink slowly and roll (`soft-eyes.ts`), the brows lift, the beak parts as it speaks, the ear
 * tufts perk when it listens and droop when it sleeps, a wave lifts one wing, a cheer flaps both, and
 * thinking swivels the head further than any other body can (an owl's trick). Every amplitude is data
 * (`reactions.ts`). With things on, it now and then plays with them (`owl-moments.ts`): it nudges
 * its spectacles with a wing tip, settles its cloak, tilts its hat, preens its scarf, checks its pack.
 */
import { Color, ConeGeometry, Group, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, SphereGeometry, Vector2, type Material } from 'three';
import { createItemMoments, type ActiveMoment } from '../../item-moments';
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
import { OWL_MOMENTS } from './owl-moments';
import { addOwlPlumage, clawMaterial, OWL_BREAST, OWL_WING } from './owl-plumage';
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
  // The pale breast (its feathers and chevrons are the plumage).
  blob(body, m.belly, OWL_BREAST.radii, OWL_BREAST.centre);
  const heart = new Object3D();
  heart.position.set(0, OWL_NECK_Y - 0.5, 0.55);
  body.add(heart);

  // Wings: folded along the sides, hinged at the shoulder (the left one waves).
  const [rightWing, leftWing] = [-1, 1].map((side) => {
    const joint = new Group();
    joint.position.set(side * OWL_SHOULDER.x, OWL_NECK_Y + OWL_SHOULDER.y, -0.02);
    body.add(joint);
    const wing = blob(joint, m.wings, OWL_WING.radii, [side * OWL_WING.position[0], OWL_WING.position[1], OWL_WING.position[2]]);
    wing.rotation.z = side * OWL_WING.roll;
    return joint;
  });
  // A short fan of tail feathers behind, and the talons in front.
  blob(body, m.wings, [0.32, 0.12, 0.3], [0, -1.86, -0.42]).rotation.x = -0.5;

  const head = new Group();
  head.name = 'owl-head';
  head.position.y = OWL_HEAD_Y;
  body.add(head);
  blob(head, m.head, OWL_HEAD, [0, 0, 0]);
  for (const side of [-1, 1]) blob(head, m.face, [0.36, 0.38, 0.14], [side * OWL_EYES.x, OWL_EYES.y - 0.02, 0.56]); // facial disc
  const lowerBeak = new Mesh(new ConeGeometry(0.045, 0.09, 14), m.beak);
  lowerBeak.position.set(0, -0.25, 0.7);
  lowerBeak.rotation.x = Math.PI + 0.5;
  head.add(lowerBeak);
  const tufts = [-1, 1].map((side) => {
    const pivot = new Group();
    pivot.position.set(side * 0.46, 0.55, 0.02);
    head.add(pivot);
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

  addOwlPlumage(body, head, [rightWing, leftWing], tufts, { body: m.body, belly: m.belly, head: m.head, face: m.face, wings: m.wings, beak: m.beak, claw: clawMaterial() });
  const moments = createItemMoments(OWL_MOMENTS);

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
    const moment = moments.step(f);
    const eyePose = softEyePose(f, R);
    if (moment?.id === 'adjust-spectacles') eyePose.open *= 1 - 0.85 * Math.max(0, Math.sin(moment.progress * Math.PI * 2.2)) ** 6;
    eyes.update(eyePose);
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
    leftWing.rotation.x = 0;
    body.position.y = 0;
    if (moment) playMoment(moment);
  }

  /** One item moment, added on top of the pose (its envelope is 0 at both ends, so nothing jumps). */
  function playMoment(m: ActiveMoment): void {
    const k = m.envelope;
    switch (m.id) {
      case 'adjust-spectacles': // the left wing tip comes up to the face and taps the frame
        leftWing.rotation.z += 2.3 * k;
        leftWing.rotation.x -= 0.7 * k;
        leftWing.rotation.z += 0.08 * Math.sin(m.elapsed * 14) * k;
        head.rotation.x += 0.12 * k;
        break;
      case 'settle-cloak': { // a shrug of both wings
        const shrug = Math.abs(Math.sin(m.elapsed * 7)) * k;
        leftWing.rotation.z += 0.35 * shrug;
        rightWing.rotation.z -= 0.35 * shrug;
        body.position.y = 0.03 * shrug;
        break;
      }
      case 'tassel-tilt': // a long, curious tilt
        head.rotation.z += 0.34 * k;
        head.rotation.y += 0.16 * k;
        break;
      case 'preen-neck': // head down to the neck, nibbling side to side
        head.rotation.x += 0.42 * k;
        head.rotation.y += 0.22 * Math.sin(m.elapsed * 6) * k;
        break;
      case 'check-pack': // the owl's trick: a long look back over its shoulder
        head.rotation.y += 1.25 * k;
        break;
    }
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
    wearing: (parts) => moments.setWorn(parts),
    playMoment: (id) => moments.play(id),
    dispose: () => disposeTree(root),
  };
}
