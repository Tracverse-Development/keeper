/**
 * The God Keeper skin: the sixth keeper, the grandest. A sovereign of light hovering over the ark:
 * a mask of polished gold with eyes of pure light, obsidian armour that shimmers like oil on water,
 * an ivory robe falling to small gold feet, gold bands at the collar, waist, sleeves and hem, and
 * all round it the things only it has:
 *
 *   - a crown of light: a sunburst of rays and a bright ring turning slowly behind the head;
 *   - two gyroscope rings turning round the body on their own axes;
 *   - two crystal shards floating at the shoulders;
 *   - a ring of light under its feet and motes of gold always rising;
 *   - its own warm light on the chest.
 *
 * It is built on the human frame (`../human/human-body.ts`), so it moves like a person (waves,
 * cheers, nods) and offers EVERY slot, paws (its feet) included: the God Keeper's race (`divine`,
 * `../races.ts`) wears pieces from every race, each drawn in the divine finish (`parts/divine-finish.ts`).
 * Work spins the rings faster and brightens the crown; thinking turns the crown and the shards
 * inward; a reply arriving flares everything at once ("got it").
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  Points,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { measureZones, zonesByMaterial } from '../../look/zone-focus';
import { PaintableMaterial, zoneOf, type ZoneTarget } from '../../look/zone-paint';
import { zonesOf, type ResolvedLook } from '../../look/zones';
import { PALETTE } from '../../palette';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { addHitProxy } from '../hit-proxy';
import { buildHumanRig, poseArms, type HumanMaterials, type HumanStyle } from '../human/human-body';
import { HUMAN_HEAD_Y, HUMAN_NECK_Y, HUMAN_SOLE_Y } from '../human/human-shape';
import type { Skin, SkinFrame } from '../skin';
import { poseSoftBody, softEyePose } from '../soft-pose';
import { GOD_FRAME, GOD_HOVER } from './god-shape';
import { GOD_REACTIONS as R } from './reactions';
import { createItemMoments } from '../../item-moments';
import { poseHumanMoment } from '../human/human-moments';
import { addGodDetail } from './god-detail';
import { crownFlare, FLARE, GOD_MOMENTS, poseGodMoment } from './god-moments';

type GodZone = 'skin' | 'body' | 'robe' | 'eyes' | 'crown' | 'rings';

/** The God Keeper's colours (not brand tokens, but drawn from them: gold, ivory, the navy night). */
const GOD = { armour: 0x141a33, robe: 0xf3ead8, light: 0xffd88a, eye: 0xfff1cf } as const;
const MOTES = 70;
const CROWN_RAYS = 16;

function godMaterials() {
  // The mask and hands: a warm porcelain gold (part metal, so the face stays readable under the lights).
  const mask = new MeshPhysicalMaterial({ color: 0xb4873f, roughness: 0.32, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.15 });
  // The bands, the crest and the feet: polished gold.
  const gold = new MeshPhysicalMaterial({ color: 0xd49a3c, roughness: 0.26, metalness: 1, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const armour = new MeshPhysicalMaterial({ color: GOD.armour, roughness: 0.22, metalness: 0.7, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 800] });
  const robe = new MeshPhysicalMaterial({ color: GOD.robe, roughness: 0.55, sheen: 1, sheenRoughness: 0.3, sheenColor: new Color(0xffe2a8), side: DoubleSide });
  const eyeLight = new MeshBasicMaterial({ color: new Color(GOD.eye).multiplyScalar(1.5) });
  const iris = new MeshPhysicalMaterial({ color: GOD.light, emissive: new Color(GOD.light), emissiveIntensity: 1.2, roughness: 0.2 });
  const crown = new MeshBasicMaterial({ color: new Color(GOD.light), transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const rings = new MeshBasicMaterial({ color: new Color(GOD.light).multiplyScalar(0.9), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false });
  return { mask, gold, armour, robe, eyeLight, iris, crown, rings };
}

export function createGodSkin(): Skin {
  const g = godMaterials();
  const materials: HumanMaterials = {
    skin: g.mask,
    hair: g.gold,
    iris: g.iris,
    top: g.armour,
    bottom: g.robe,
    shoes: g.gold,
    eye: new MeshPhysicalMaterial({ color: 0x0b0f22, roughness: 0.15, clearcoat: 1 }),
    pupil: g.eyeLight,
    catchlight: new MeshBasicMaterial({ color: new Color(PALETTE.cream50).multiplyScalar(1.6) }),
    line: new MeshPhysicalMaterial({ color: 0x6e4a17, roughness: 0.4, metalness: 0.6 }),
    mouth: new MeshBasicMaterial({ color: new Color(GOD.light).multiplyScalar(1.4) }),
    lips: g.mask,
  };
  const style: HumanStyle = {
    frame: GOD_FRAME,
    materials,
    legs: 'hidden',
    lashes: 0,
    dress(head, blob) {
      blob(head, g.iris, [0.06, 0.08, 0.04], [0, 0.36, GOD_FRAME.head[2] * 0.97]); // the brow jewel
      // A smooth crest over the crown of the head, like a helm of gold.
      const crest = new Mesh(new SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, 1.2), g.gold);
      crest.scale.set(GOD_FRAME.head[0] * 1.03, GOD_FRAME.head[1] * 1.05, GOD_FRAME.head[2] * 1.03);
      crest.rotation.x = -0.6;
      head.add(crest);
    },
  };
  const rig = buildHumanRig(style);
  const { root, body, head } = rig;

  // Gold bands: the collar, the waist, the hem and both sleeves.
  const bands = new Group();
  body.add(bands);
  const band = (radius: number, y: number, depth: number, tube = 0.03): void => {
    const b = new Mesh(new TorusGeometry(radius, tube, 10, 64), g.gold);
    b.rotation.x = Math.PI / 2;
    b.scale.y = depth;
    b.position.y = y;
    bands.add(b);
  };
  band(0.27, HUMAN_NECK_Y - 0.02, GOD_FRAME.depth, 0.04);
  band(0.43, HUMAN_NECK_Y + GOD_FRAME.waist, GOD_FRAME.depth, 0.035);
  band(GOD_HEM_RADIUS, HUMAN_NECK_Y + GOD_HEM_Y, GOD_FRAME.depth, 0.03);
  for (const arm of [rig.leftArm, rig.rightArm]) {
    const cuff = new Mesh(new TorusGeometry(GOD_FRAME.arm.sleeve * 1.02, 0.022, 8, 32), g.gold);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -GOD_FRAME.arm.length * 0.36;
    arm.add(cuff);
  }

  // Feet: small pointed gold slippers under the hem.
  for (const side of [-1, 1]) {
    const foot = new Mesh(new SphereGeometry(1, 24, 16), g.gold);
    foot.scale.set(...GOD_FRAME.shoe);
    foot.position.set(side * GOD_FRAME.leg.x, HUMAN_SOLE_Y + GOD_FRAME.shoe[1], 0.08);
    body.add(foot);
  }

  // The crown of light: a sunburst of rays and a bright ring behind the head.
  const crown = new Group();
  crown.position.set(0, 0.1, -0.35);
  head.add(crown);
  const crownRing = new Mesh(new TorusGeometry(0.97, 0.011, 8, 96), g.crown);
  crown.add(crownRing);
  const innerRing = new Mesh(new TorusGeometry(1.06, 0.005, 8, 96), g.crown);
  crown.add(innerRing);
  const rayGeometry = new PlaneGeometry(0.07, 0.62, 1, 6);
  taper(rayGeometry);
  rayGeometry.translate(0, 1.18, 0);
  const rays = new Group();
  crown.add(rays);
  for (let i = 0; i < CROWN_RAYS; i++) {
    const ray = new Mesh(rayGeometry, g.crown);
    ray.rotation.z = (i / CROWN_RAYS) * Math.PI * 2;
    ray.scale.y = i % 2 ? 0.7 : 1;
    rays.add(ray);
  }
  // Points of light at the long rays' tips.
  const tips = new Group();
  crown.add(tips);
  for (let i = 0; i < CROWN_RAYS; i += 2) {
    const tip = new Mesh(new OctahedronGeometry(0.045, 0), g.eyeLight);
    const a = (i / CROWN_RAYS) * Math.PI * 2;
    tip.position.set(-Math.sin(a) * 1.52, Math.cos(a) * 1.52, 0);
    tips.add(tip);
  }

  // The hero detail: engraving, layered armour, robe folds, filigree and jewels (`god-detail.ts`).
  addGodDetail({ body, crown, mask: g.mask, gold: g.gold, armour: g.armour, robe: g.robe, crownLight: g.crown, jewel: g.eyeLight });
  const filigree = crown.getObjectByName('filigree');

  // Gyroscope rings round the body.
  const gyro = new Group();
  gyro.position.y = HUMAN_NECK_Y - 0.55;
  body.add(gyro);
  const gyroRings = [1.05, 1.18].map((r, i) => {
    const ring = new Mesh(new TorusGeometry(r, 0.012, 8, 128), g.rings);
    ring.rotation.set(Math.PI / 2 + (i ? -0.45 : 0.35), i ? 0.3 : -0.2, 0);
    gyro.add(ring);
    return ring;
  });

  // Crystal shards floating at the shoulders.
  const shardMaterial = new MeshPhysicalMaterial({ color: 0x7fc8f0, emissive: new Color(0x3a8fd0), emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.3, clearcoat: 1, iridescence: 1, flatShading: true });
  const shards = [-1, 1].map((side) => {
    const shard = new Mesh(new OctahedronGeometry(0.13, 0), shardMaterial);
    shard.scale.set(0.7, 1.4, 0.7);
    shard.position.set(side * 0.85, HUMAN_NECK_Y - 0.05, -0.05);
    body.add(shard);
    return shard;
  });

  // A ring of light under the feet it stands on, and motes of gold always rising round the body.
  const footRing = new Mesh(new TorusGeometry(0.42, 0.012, 8, 96), g.rings);
  footRing.rotation.x = Math.PI / 2;
  footRing.position.y = HUMAN_SOLE_Y - 0.06;
  body.add(footRing);
  const motes = risingMotes();
  root.add(motes.points);
  const lamp = new PointLight(GOD.light, 0.35, 3, 2);
  lamp.position.set(0, HUMAN_NECK_Y - 0.4, 1.3);
  body.add(lamp);

  const slots = addSlotAnchors(root, slotsOf('god'), { body, head, leftArm: rig.leftArm, rightArm: rig.rightArm });
  const zoneMaterials = { skin: g.mask, body: g.armour, robe: g.robe, eyes: g.iris };
  const zones: Record<GodZone, ZoneTarget> = {
    skin: new PaintableMaterial(g.mask),
    body: new PaintableMaterial(g.armour),
    robe: new PaintableMaterial(g.robe),
    eyes: new PaintableMaterial(g.iris),
    crown: zoneOf(lightPainter(g.crown, GOD.light, 1.6)),
    rings: zoneOf(lightPainter(g.rings, GOD.light, 1.4)),
  };
  const focus = measureZones(root, { ...zonesByMaterial(root, zoneMaterials), crown: { meshes: [crownRing] }, rings: { meshes: gyroRings } });
  const headProxy = addHitProxy(head, { radii: [0.9, 0.95, 0.85], centre: [0, 0.05, 0] });
  const bodyProxy = addHitProxy(body, { radii: [0.62, 0.9, 0.5], centre: [0, -1.2, 0] });
  const touchOrigin = new Object3D();
  touchOrigin.position.set(0, 0.85, 0.1);
  head.add(touchOrigin);
  let leanSide = 1;
  let spin = 0;
  const moments = createItemMoments(GOD_MOMENTS);

  function apply(f: SkinFrame): void {
    const pose = poseSoftBody(rig, f, R, leanSide, GOD_HOVER);
    const e = f.emote;
    const a = f.motion.amplitude;
    rig.eyes.update(softEyePose(f, R));
    rig.setMouth(Math.max(f.mouth, 0.3 * pose.cheer), f.mood.smile + 0.5 * pose.cheer, e.mouthO);
    poseArms(rig, GOD_FRAME, e.paw, e.swing * a, Math.sin(pose.t * 0.9) * a, pose.cheer * a);
    head.position.y = HUMAN_HEAD_Y;
    const moment = moments.step(f);
    poseHumanMoment(rig, moment);
    poseGodMoment(rig, moment);
    const blaze = crownFlare(moment);
    const flare = 1 + 1.5 * f.gotIt + 0.6 * pose.cheer + FLARE.light * blaze;
    const energy = 1 + 1.6 * pose.work + 0.8 * pose.drama;
    spin += f.dt * f.motion.speed * energy;
    rays.rotation.z = spin * 0.12;
    tips.rotation.z = spin * 0.12;
    innerRing.rotation.z = -spin * 0.3;
    crown.scale.setScalar(1 + 0.04 * Math.sin(pose.t * 1.2) * a + 0.08 * f.gotIt + FLARE.scale * blaze);
    if (filigree) filigree.rotation.z = -spin * 0.06;
    g.crown.opacity = Math.min(1, (0.32 + 0.18 * f.mood.presence) * flare);
    gyroRings[0].rotation.z = spin * 0.5;
    gyroRings[1].rotation.z = -spin * 0.38;
    gyro.rotation.y = spin * 0.1;
    footRing.scale.setScalar(1 + 0.06 * Math.sin(pose.t * 1.6) * a);
    g.rings.opacity = Math.min(1, 0.55 * flare + 0.25 * pose.work);
    shards.forEach((shard, i) => {
      const side = i ? 1 : -1;
      // Thinking draws the shards in toward the head, turning.
      shard.position.x = side * (0.85 - 0.2 * pose.drama);
      shard.position.y = HUMAN_NECK_Y - 0.05 + 0.08 * Math.sin(pose.t * 1.1 + i * 2) * a + 0.25 * pose.drama;
      shard.rotation.y = spin * 0.8 * side;
    });
    shardMaterial.emissiveIntensity = 0.35 * flare;
    g.iris.emissiveIntensity = 1.2 * flare;
    lamp.intensity = 0.35 * flare;
    motes.update(f, energy);
  }

  return {
    id: 'god',
    root,
    gazeAnchor: head,
    sparkOrigin: rig.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    slots,
    reactions: R,
    focus,
    paint(look: ResolvedLook) {
      for (const zone of zonesOf('god')) zones[zone as GodZone]?.paint(look[zone]);
    },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    wearing: (parts) => moments.setWorn(parts),
    setPointScale: (scale) => motes.setPointScale(scale),
    dispose: () => disposeTree(root),
  };
}

/** The hem's place (below the neck) and radius: where the robe ends. */
const GOD_HEM_Y = GOD_FRAME.torso[GOD_FRAME.torso.length - 2][1];
const GOD_HEM_RADIUS = GOD_FRAME.torso[GOD_FRAME.torso.length - 2][0];

/** A light zone (the crown, the rings): its colour is the zone's colour, drawn as light. */
function lightPainter(material: MeshBasicMaterial, rest: number, strength: number): ZoneTarget {
  return {
    paint(zone) {
      material.color.setHex(zone?.color ?? rest).multiplyScalar(strength);
    },
  };
}

/** Narrows a plane to a point at both ends (a ray of light). */
function taper(plane: PlaneGeometry): void {
  const position = plane.getAttribute('position');
  const half = plane.parameters.height / 2;
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * Math.max(0, 1 - Math.abs(position.getY(i)) / half) ** 0.6);
  position.needsUpdate = true;
}

/** Motes of gold rising round the body, faster with work. */
function risingMotes() {
  const positions = new Float32Array(MOTES * 3);
  const sizes = new Float32Array(MOTES);
  const brights = new Float32Array(MOTES);
  const phases = new Float32Array(MOTES);
  const seeds = Array.from({ length: MOTES }, (_, i) => ({ angle: (i * 2.399) % (Math.PI * 2), radius: 0.6 + ((i * 0.618) % 1) * 0.7, start: (i * 0.137) % 1, speed: 0.6 + ((i * 0.377) % 1) * 0.8 }));
  seeds.forEach((_, i) => {
    sizes[i] = 0.025 + ((i * 0.53) % 1) * 0.035;
    phases[i] = (i * 0.29) % 1;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0.5);
  material.uniforms.uWarm.value = new Color(GOD.light);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  let clock = 0;
  return {
    points,
    update(f: SkinFrame, energy: number) {
      clock += f.dt * f.motion.speed * energy;
      for (let i = 0; i < MOTES; i++) {
        const s = seeds[i];
        const rise = (s.start + clock * 0.09 * s.speed) % 1;
        const a = s.angle + clock * 0.25;
        positions[i * 3] = Math.cos(a) * s.radius;
        positions[i * 3 + 1] = HUMAN_SOLE_Y - 0.2 + rise * 3.2;
        positions[i * 3 + 2] = Math.sin(a) * s.radius * 0.8;
        brights[i] = Math.sin(rise * Math.PI) * 1.2;
      }
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
      material.uniforms.uTime.value = f.time;
      material.uniforms.uGlow.value = 1.1 * (0.6 + 0.4 * f.mood.presence);
    },
    setPointScale(scale: number) {
      material.uniforms.uScale.value = scale;
    },
  };
}
