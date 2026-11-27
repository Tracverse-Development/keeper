/**
 * The human skins, "Man" and "Woman": stylised people in the same family as the robot and the dog
 * (a large soft head, a small body, standing on the ark). The man has close-cut hair, a trimmed
 * beard, a cream linen shirt and navy trousers; the woman has a crown of natural hair gathered in
 * a high puff, lashes, gold hoop earrings and a teal top over a cream skirt.
 *
 * As a `Skin` strategy each reads the shared dials through `soft-pose.ts` (breathing, hops,
 * squash and stretch, lean, gaze, nods, the thinking tilt, poke and pat) and adds its own: the eyes
 * blink, squint and roll (`soft-eyes.ts`), the brows lift and knit, the mouth smiles and opens with
 * speech, the right arm waves hello, both arms lift when it cheers, and work bobs the head. Every
 * amplitude is data (`reactions.ts`).
 *
 * Slots: the man and the woman offer every slot but paws, including the face (spectacles), the left
 * wrist (a watch) and the right hand (something held): the human-only pieces.
 */
import { Color, MeshBasicMaterial, MeshPhysicalMaterial, Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { measureZones, zonesByMaterial, type ZoneParts } from '../../look/zone-focus';
import { PaintableMaterial } from '../../look/zone-paint';
import { zonesOf, type ResolvedLook } from '../../look/zones';
import { PALETTE } from '../../palette';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { poseSoftBody } from '../soft-pose';
import { faceMouthO, softFacePose } from '../expression-face';
import { buildHumanRig, poseArms, type Blob, type HumanMaterials, type HumanRig, type HumanStyle } from './human-body';
import { BEARD_COLOUR, dressManHair, dressWomanHair, syncHair, type ManHair } from './human-hair';
import { HUMAN_HEAD_Y, MAN_FRAME, WOMAN_FRAME, type HumanFrame } from './human-shape';
import { HUMAN_REACTIONS as R } from './reactions';
import { createItemMoments } from '../../item-moments';
import { HUMAN_MOMENTS, poseHumanMoment } from './human-moments';

export type HumanVariant = 'man' | 'woman';

/** The rest height of the root: low enough that the soles stand on the ark. */
const HUMAN_ROOT_Y = 0.12;
/** People are drawn a touch larger than their frame (the frame stays the unit the slots are measured in). */
export const HUMAN_SCALE = 1.1;
/** How much of its own colour the skin gives off (a hint of light scattered under the skin). */
const SKIN_GLOW = 0.08;

/** Skin and hair colours (not brand tokens): warm deep browns under the gold rim lights. */
const TONES = {
  man: { skin: 0x8a5636, hair: 0x1a1210, iris: 0x3a2214, top: 0xefe6d2, bottom: 0x24305a, shoes: 0x7a4a26 },
  woman: { skin: 0x9a6243, hair: 0x1c1311, iris: 0x4a2a18, top: 0x1f8a86, bottom: 0xf1e7d4, shoes: 0xb57b2c },
} as const;

/** The materials a human is made of; the zones own skin, hair, iris, top, bottom and shoes. */
export function humanMaterials(tone: (typeof TONES)[HumanVariant]): HumanMaterials {
  // Skin: a soft sheen and a faint warm glow from within (light scattered under the skin), a thin oily coat.
  const skin = new MeshPhysicalMaterial({
    color: tone.skin,
    roughness: 0.5,
    sheen: 0.6,
    sheenRoughness: 0.45,
    sheenColor: new Color(0xffc29a),
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    emissive: new Color(tone.skin).multiplyScalar(SKIN_GLOW),
  });
  const cloth = (color: number, roughness = 0.8) =>
    new MeshPhysicalMaterial({ color, roughness, sheen: 0.8, sheenRoughness: 0.55, sheenColor: new Color(color).lerp(new Color(0xffffff), 0.25) });
  return {
    skin,
    hair: new MeshPhysicalMaterial({ color: tone.hair, roughness: 0.62, sheen: 1, sheenRoughness: 0.35, sheenColor: new Color(0x6b4a36) }),
    iris: new MeshPhysicalMaterial({ color: tone.iris, emissive: new Color(PALETTE.caramel700), emissiveIntensity: 0.25, roughness: 0.3, clearcoat: 0.5 }),
    top: cloth(tone.top),
    bottom: cloth(tone.bottom, 0.84),
    shoes: new MeshPhysicalMaterial({ color: tone.shoes, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    eye: new MeshPhysicalMaterial({ color: 0xf7f1e8, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.05 }),
    pupil: new MeshPhysicalMaterial({ color: 0x050303, roughness: 0.15, clearcoat: 0.6 }),
    catchlight: new MeshBasicMaterial({ color: new Color(PALETTE.cream50).multiplyScalar(1.4) }),
    line: new MeshPhysicalMaterial({ color: 0x1a110e, roughness: 0.6 }),
    mouth: new MeshPhysicalMaterial({ color: PALETTE.mouth900, roughness: 0.7 }),
    lips: new MeshPhysicalMaterial({ color: new Color(tone.skin).multiplyScalar(0.72).getHex(), roughness: 0.4, clearcoat: 0.4 }),
  };
}

/** A style and the hair it was dressed with (the man's fade follows the painted hair colour). */
interface Dressed {
  readonly style: HumanStyle;
  readonly hair: { current: ManHair | null };
}

function manStyle(m: HumanMaterials): Dressed {
  // The beard is the hair's colour, a little softer (short hair catches more light).
  const beardMaterial = m.hair.clone();
  beardMaterial.color.copy(BEARD_COLOUR);
  beardMaterial.roughness = 0.85;
  const dressed = { ...m, beard: beardMaterial };
  const hair: Dressed['hair'] = { current: null };
  return {
    hair,
    style: {
      frame: MAN_FRAME,
      materials: dressed,
      legs: 'trousers',
      lashes: 0,
      dress(head) {
        hair.current = dressManHair(head, dressed, beardMaterial);
      },
    },
  };
}

function womanStyle(m: HumanMaterials): Dressed {
  return {
    hair: { current: null },
    style: {
      frame: WOMAN_FRAME,
      materials: m,
      legs: 'bare',
      lashes: 4,
      dress(head, blob: Blob) {
        dressWomanHair(head, m, blob);
      },
    },
  };
}

export function createHumanSkin(variant: HumanVariant): Skin {
  const tone = TONES[variant];
  const materials = humanMaterials(tone);
  const dressed = variant === 'man' ? manStyle(materials) : womanStyle(materials);
  const style = dressed.style;
  const frame = style.frame;
  const rig = buildHumanRig(style);
  rig.body.scale.setScalar(HUMAN_SCALE);
  const slots = addSlotAnchors(rig.root, slotsOf(variant), { body: rig.body, head: rig.head, leftArm: rig.leftArm, rightArm: rig.rightArm, leftForearm: rig.leftForearm, rightForearm: rig.rightForearm });
  const zones = humanZones(materials);
  const focus = measureZones(rig.root, zoneParts(rig.root, materials));

  const headProxy = addHitProxy(rig.head, { radii: [frame.hat[0] * 1.08, frame.hat[1] * 1.05, frame.hat[2] * 1.05], centre: [0, 0.05, 0] });
  const bodyProxy = addHitProxy(rig.body, { radii: [0.55, 0.85, 0.45], centre: [0, -1.2, 0] });
  const touchOrigin = new Object3D();
  touchOrigin.position.set(0, frame.hat[1] * 0.95, 0.1);
  rig.head.add(touchOrigin);
  let leanSide = 1;
  // Small idle gestures with what it wears (`human-moments.ts`).
  const moments = createItemMoments(HUMAN_MOMENTS);

  return {
    id: variant,
    root: rig.root,
    gazeAnchor: rig.head,
    sparkOrigin: rig.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    slots,
    reactions: R,
    focus,
    paint(look: ResolvedLook) {
      for (const zone of zonesOf(variant)) zones[zone as HumanZone]?.paint(look[zone]);
      syncHair(materials, dressed.hair.current);
    },
    apply(frame) {
      applyHuman(rig, style.frame, frame, leanSide);
      poseHumanMoment(rig, style.frame, moments.step(frame));
    },
    wearing: (parts) => moments.setWorn(parts),
    playMoment: (id) => moments.play(id),
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    dispose: () => disposeTree(rig.root),
  };
}

/** One frame of a human: the shared soft pose, then the eyes, the mouth and the arms. */
export function applyHuman(rig: HumanRig, frame: HumanFrame, f: SkinFrame, leanSide: number): void {
  const pose = poseSoftBody(rig, f, R, leanSide, HUMAN_ROOT_Y);
  const e = f.emote;
  rig.eyes.update(softFacePose(f, R));
  rig.setMouth(Math.max(f.mouth, 0.3 * pose.cheer), f.mood.smile + 0.5 * pose.cheer + 0.3 * f.touch.pat, faceMouthO(f));
  const a = f.motion.amplitude;
  const sway = Math.sin(pose.t * 1.1) * a + 0.5 * e.swing;
  poseArms(rig, frame, e.paw, e.swing * a, sway, pose.cheer * a);
  rig.head.position.y = HUMAN_HEAD_Y;
}

type HumanZone = 'skin' | 'hair' | 'eyes' | 'top' | 'bottom' | 'shoes';

function zoneMaterials(m: HumanMaterials): Record<HumanZone, MeshPhysicalMaterial> {
  return { skin: m.skin, hair: m.hair, eyes: m.iris, top: m.top, bottom: m.bottom, shoes: m.shoes };
}

function humanZones(m: HumanMaterials): Record<HumanZone, PaintableMaterial> {
  const out = {} as Record<HumanZone, PaintableMaterial>;
  for (const [zone, material] of Object.entries(zoneMaterials(m)) as [HumanZone, MeshPhysicalMaterial][]) out[zone] = new PaintableMaterial(material);
  return out;
}

function zoneParts(root: Object3D, m: HumanMaterials): Record<string, ZoneParts> {
  return zonesByMaterial(root, zoneMaterials(m), { hair: 0.4 });
}
