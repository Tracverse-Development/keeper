/**
 * The puppy skin: a soft caramel-and-cream puppy companion with a navy collar and a gold
 * ark tag, sitting over the same ark, under the same halo, as the robot.
 *
 * As a `Skin` strategy it reads the shared dials (eyes, gaze, blink, bob, bounce, lean,
 * mouth, voice, touch) and adds its own body language from `puppy-moods.ts`, blended by
 * the mood weights: ears perk when listening and droop asleep, the head tilts, the tail
 * wags harder when happy or petted, the jaw pants with the tongue out, and asleep it
 * settles into a curl with slow breathing. Ears trail the head's movement a little
 * (inertia + gravity), so they feel soft. A poke jolts it and pops the ears up; a pat
 * leans the head into the hand, flops the ears back and sets the tail going. Work makes
 * it concentrate: ears perk and twitch, the tail goes faster, the head bobs, it pants at
 * high work and a sweat drop beads at the very top. Thinking (drama from `thinking.ts`) adds a
 * puzzled side-to-side head tilt, alternating ear twitches, slow tail sweeps, a sniffing nose
 * and a looping thought bubble (`puppy-thinking.ts`); a reply arriving makes the eyes sparkle
 * and the ears pop ("got it"). Emotes (`frame.emote`) squash and stretch the whole puppy,
 * hop and spin it, lift and wave its paw hello, swell its eyes in surprise, wink, glint its
 * catchlights, open a yawn, perk or droop the ears and set the tail going.
 * Every amplitude and timing is data (`reactions.ts`); at zero touch, zero work, no thinking
 * and no emote every number is what it shipped with.
 *
 * The coat is real fur by default (`fur-shells.ts`; a zone painted any other material is smooth),
 * and with things on, the dog now and then plays with them (`puppy-moments.ts`): a head shake under
 * a hat, a sniff at its brooch, a proud wag in a bandana, a look at its booties, a wriggle in a coat.
 */
import { Group, Object3D, type Mesh, type MeshPhysicalMaterial } from 'three';
import { createItemMoments } from '../../item-moments';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { measureZones, type ZoneParts } from '../../look/zone-focus';
import { PaintableMaterial } from '../../look/zone-paint';
import { LOOK_ZONES, type ResolvedLook } from '../../look/zones';
import { damp } from '../../moods';
import { cyclePhase, holdWave, sniff, thinkDrama, twitch } from '../../thinking';
import { band, effectiveWork } from '../../work-level';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { createFur, type FurZone } from '../fur-shells';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { addPuppyBody } from './puppy-body';
import { addPuppyHead } from './puppy-head';
import { createPuppyKit } from './puppy-kit';
import { hasFur, momentDials, PUPPY_MOMENTS } from './puppy-moments';
import { blendPuppyDials, puppyDials } from './puppy-moods';
import { PUPPY_HEAD_Y } from './puppy-shape';
import { addPuppySweat } from './puppy-sweat';
import { addPuppyThinking } from './puppy-thinking';
import { PUPPY_REACTIONS as R } from './reactions';

/** Head centre height (world units). */
const HEAD_Y = PUPPY_HEAD_Y;
/** Ears hang this far out from the head at rest, and swing this much more fully perked. */
const EAR_REST = 0.26;
const EAR_PERK = 0.5;

export function createPuppySkin(): Skin {
  const kit = createPuppyKit();
  const root = new Group();
  root.name = 'puppy';
  const body = new Group();
  root.add(body);
  const parts = addPuppyBody(body, kit);
  const face = addPuppyHead(body, kit, HEAD_Y);
  const head = face.head;
  const sweat = addPuppySweat(head, kit);
  const bubble = addPuppyThinking(body);
  const slots = addSlotAnchors(root, slotsOf('puppy'), { body, head, paw: parts.paw, hindPaw: parts.scratch.pawJoint });
  const zones = puppyZones(kit);
  const focus = measureZones(root, zoneParts(root, kit));
  // Real fur on every coat zone, unless its look asks for another material (smooth, gloss, metal...).
  const fur = createFur(root, furZones(kit), { lighter: new Map([[kit.blobGeometry, kit.furGeometry]]) });
  const moments = createItemMoments(PUPPY_MOMENTS);

  const headProxy = addHitProxy(head, { radii: [1.06, 0.9, 0.95], centre: [0, 0, 0.05] });
  const bodyProxy = addHitProxy(body, { radii: [0.72, 0.8, 0.66], centre: [0, -1.2, 0.05] });
  const touchOrigin = new Object3D();
  touchOrigin.position.set(0, 0.78, 0.1);
  head.add(touchOrigin);

  const tagColour = kit.materials.tagGlow.color.clone();
  const dials = puppyDials();
  let tailPhase = 0;
  let headLag = 0;
  /** Which way the head leans into a pat (-1 or 1), picked per pat. */
  let leanSide = 1;

  function apply(frame: SkinFrame): void {
    const p = frame.mood;
    const d = blendPuppyDials(frame.weights, dials);
    // A real nap curls it up like the asleep mood does.
    d.curl = Math.max(d.curl, frame.emote.nap);
    const a = frame.motion.amplitude;
    const t = frame.time * frame.motion.speed;
    const { poke, pat } = frame.touch;
    const w = effectiveWork(frame.work, frame.weights.thinking, R.think.workBoost);
    const pant = band(w, R.work.pantFrom, R.work.pantTo);
    const T = R.think;
    const drama = thinkDrama(frame.weights.thinking, frame.work, frame.dramaFloor);
    const moment = moments.step(frame);
    const mo = momentDials(moment);

    // Breathing lives in the chest; the whole puppy bobs less than the floating robot.
    const e = frame.emote;
    const cheer = Math.max(e.stars, e.hearts);
    const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
    const hop = Math.abs(Math.sin(t * Math.PI * R.celebrate.hopSpeed)) * p.bounce;
    root.position.y = (breath * p.bobAmp * 0.5 + hop) * a + R.poke.lift * poke * a - d.curl * R.sleep.sink + e.lift * a;
    const squash = e.squash * a;
    root.scale.set(1 - 0.5 * squash, 1 + squash, 1 - 0.5 * squash);
    root.rotation.y = a >= 1 ? e.yaw : 0; // a spin is skipped under reduced motion
    const chest = 1 + breath * (0.016 + 0.012 * d.curl) * a;
    parts.torso.scale.set(chest, 1 + breath * 0.006 * a, 0.88 * chest);
    body.rotation.x = p.lean * 0.8 + d.curl * 0.1 - R.poke.bodyPitch * poke;
    body.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.015 * a + leanSide * R.pat.bodyRoll * pat + (e.roll + 0.04 * e.swing) * a + mo.bodyRoll;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.38 + 0.9 * e.chase * a; // chasing: it looks back at its tail
    const bob = Math.sin(t * R.work.headBobSpeed) * R.work.headBob * w * a;
    head.rotation.x = -frame.gaze.y * 0.24 + nod + p.lean * 0.4 + d.curl * 0.28 - R.poke.headPitch * poke + R.pat.headPitch * pat + bob;
    head.rotation.z =
      (Math.sin(t * 0.31) * 0.04 + Math.sin(t * 0.83 + 2) * 0.015) * a -
      frame.gaze.x * 0.06 +
      d.headTilt +
      d.curl * 0.14 +
      leanSide * R.pat.headRoll * pat;
    if (drama > 0) head.rotation.z += drama * a * T.tilt * holdWave(cyclePhase(t, T.tiltSeconds));
    head.rotation.z += (0.6 * e.roll + 0.12 * e.swing) * a;
    head.rotation.x += e.pitch * a + mo.headPitch;
    head.rotation.y += mo.headYaw;
    head.rotation.z += mo.headRoll;
    // Scratching: the head leans down toward the scratching hind leg (its screen-left side).
    head.rotation.z += 0.42 * e.scratch * a;
    head.rotation.x += 0.12 * e.scratch * a;
    parts.scratch.pose(e.scratch * (0.5 + 0.5 * a), t);
    // The hello wave: the paw lifts forward and up, then waves from the shoulder.
    parts.paw.rotation.set(-2.1 * e.paw * (0.6 + 0.4 * a) - mo.pawLift, 0, 0.35 * e.swing * e.paw * a);
    head.position.y = HEAD_Y - d.curl * R.sleep.headDrop;
    head.position.z = d.curl * R.sleep.headForward;

    face.eyes.update({
      open: p.eyeOpen * (1 - frame.blink),
      squint: p.squint,
      gazeX: frame.gaze.x,
      gazeY: frame.gaze.y,
      sparkle: p.presence * (1 + T.gotItSparkle * frame.gotIt),
      wink: e.wink,
      pop: e.wide,
      stars: e.stars,
    });
    const panting = pant * (0.42 + 0.2 * Math.sin(t * Math.PI * 2 * R.work.pantSpeed) * a);
    face.setMouth(
      Math.max(d.mouthOpen * (1 - d.curl), frame.mouth, R.pat.mouth * pat, panting, 0.75 * e.mouthO, 0.5 * cheer),
      Math.max(d.tongue, R.pat.tongue * pat, pant, cheer),
    );
    const perk =
      mo.earPerk + d.earPerk + R.poke.earPop * poke + 0.25 * frame.voice + R.work.earPerk * w + T.gotItEars * frame.gotIt + 0.8 * e.wide + 0.5 * e.stars + 0.35 * e.paw - 0.45 * e.sleepy;
    const flickLeft = drama * T.earTwitch * twitch(cyclePhase(t, T.earTwitchSeconds));
    const flickRight = drama * T.earTwitch * twitch(cyclePhase(t + T.earTwitchSeconds / 2, T.earTwitchSeconds));
    // The scratched ear flaps with the shaking leg.
    const scratched = e.scratch * Math.abs(Math.sin(t * 31)) * 0.5;
    poseEars(frame, perk, d.earTwitch, R.work.earTwitch * w, Math.max(pat, 0.7 * e.hearts), t, flickLeft + scratched + mo.earFlap, flickRight + mo.earFlap);
    face.sniff(Math.max(drama * sniff(cyclePhase(t, T.sniffSeconds)), mo.sniff));

    const tailSpeed = mo.tailSpeed + d.tailSpeed + R.pat.tailSpeed * pat + R.poke.tailSpeed * poke + R.work.tailSpeed * w + 3 * cheer + 2 * e.paw + 5 * e.chase;
    tailPhase += frame.dt * Math.PI * 2 * tailSpeed * frame.motion.speed;
    const sweep = drama > 0 ? drama * T.tailSweep * Math.sin(t * T.tailSweepSpeed) : 0;
    const wag = (Math.sin(tailPhase) * (mo.tailWag + d.tailWag + R.pat.tailWag * pat + R.work.tailWag * w + 0.5 * cheer + 0.3 * e.paw + 0.5 * e.chase) + sweep) * a;
    parts.tail.rotation.set(0.15 + d.curl * 0.5, wag * 0.35, -0.38 - d.curl * 0.7 + wag);

    parts.tag.rotation.x = Math.sin(t * 1.1 + 0.4) * 0.05 * a - body.rotation.x * 0.6 + R.poke.tagSwing * poke;
    parts.tag.rotation.z = Math.sin(t * 0.9) * 0.07 * a - body.rotation.z;
    kit.materials.tagGlow.color.copy(tagColour).multiplyScalar((0.45 + 0.55 * p.presence) * (1 + frame.voice * 0.6));
    fur.update(frame.time * frame.motion.speed);
    sweat.update(band(w, R.work.sweatFrom, 1), frame.time, frame.motion.speed);
    bubble.update(drama, t);
  }

  /**
   * Ears: perk/droop, a pat flops them back, they trail the head's tilt (inertia + gravity).
   * `twitch` flicks one ear now and then (thinking); `busyTwitch` adds quicker flicks of both
   * ears while working; `flickLeft`/`flickRight` are the thinking twitches, one ear then the other.
   */
  function poseEars(
    frame: SkinFrame,
    perk: number,
    twitch: number,
    busyTwitch: number,
    pat: number,
    t: number,
    flickLeft: number,
    flickRight: number,
  ): void {
    headLag = damp(headLag, head.rotation.z, 5, frame.dt);
    const hang = -0.45 * head.rotation.z - 0.7 * (head.rotation.z - headLag);
    const out = Math.max(EAR_REST + EAR_PERK * perk, 0.12) * (1 - R.pat.earFlop * pat);
    const back = R.pat.earBack * pat - 0.35 * Math.max(perk, 0); // perked ears also come forward
    const sway = Math.sin(t * 1.3) * 0.03 * frame.motion.amplitude;
    const busy = busyTwitch > 0 ? busyTwitch * Math.max(0, Math.sin(t * 5.3 + 0.6)) ** 10 * 0.5 : 0;
    const flick = twitch * Math.max(0, Math.sin(t * 2.3)) ** 12 + busy;
    face.setEars(
      { out: out - hang + sway + 0.4 * flickLeft, back: back - 0.25 * flickLeft },
      { out: out + hang - sway + 0.4 * (flick + flickRight), back: back - 0.25 * (flick + flickRight) },
    );
  }

  return {
    id: 'puppy',
    root,
    gazeAnchor: head,
    sparkOrigin: parts.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    slots,
    reactions: R,
    focus,
    paint(look: ResolvedLook) {
      for (const zone of LOOK_ZONES.puppy) {
        zones[zone].paint(look[zone]);
        fur.show(zone, hasFur(zone, look[zone]?.material));
      }
      fur.sync();
    },
    wearing: (parts) => moments.setWorn(parts),
    playMoment: (id) => moments.play(id),
    covered(slots) {
      for (const [zone, under] of Object.entries(FUR_UNDER)) fur.trim(zone, under.slots.some((slot) => slots.includes(slot)) ? under.share : 1);
    },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    setPointScale: (scale) => bubble.setPointScale(scale),
    dispose: () => {
      fur.dispose();
      kit.furGeometry.dispose();
      disposeTree(root);
    },
  };
}

/** Fur lies short under clothes: each zone, the slots that cover it, and the share of its length left. */
const FUR_UNDER: Readonly<Record<string, { readonly slots: readonly string[]; readonly share: number }>> = {
  body: { slots: ['torso', 'back'], share: 0.3 },
  legs: { slots: ['torso'], share: 0.45 },
  head: { slots: ['head'], share: 0.4 },
  paws: { slots: ['paws'], share: 0.3 },
};

type PuppyZone = (typeof LOOK_ZONES.puppy)[number];

/** Each paint zone's material (the eyes zone paints the irises). */
function zoneMaterials(kit: ReturnType<typeof createPuppyKit>): Record<PuppyZone, MeshPhysicalMaterial> {
  const m = kit.materials;
  return { head: m.head, ears: m.ears, muzzle: m.muzzle, eyes: m.iris, body: m.body, legs: m.legs, paws: m.paws, tail: m.tail };
}

/**
 * Where fur grows when a zone is painted `fur`, and how long: a long coat with cheek tufts on the
 * head, a short muzzle, a ruffed chest (the cream bib grows with the body), shorter legs and paws.
 */
function furZones(kit: ReturnType<typeof createPuppyKit>): Record<string, FurZone> {
  const m = kit.materials;
  // The eyes and the nose stay clear (head space: `puppy-eyes.ts`, `puppy-head.ts`).
  const bare = [[0.33, 0.08, 0.6, 0.2], [-0.33, 0.08, 0.6, 0.2], [0, -0.07, 0.9, 0.11], [0, -0.36, 0.62, 0.12]] as const;
  return {
    head: { materials: [m.head], length: 0.07, tuft: 1.1, bare },
    ears: { materials: [m.ears], length: 0.05 },
    muzzle: { materials: [m.muzzle], length: 0.035, tuft: 0.8, bare },
    body: { materials: [m.body, m.cream], length: 0.058, tuft: 0.4 },
    legs: { materials: [m.legs], length: 0.05 },
    paws: { materials: [m.paws], length: 0.035 },
    tail: { materials: [m.tail], length: 0.09 },
  };
}

function puppyZones(kit: ReturnType<typeof createPuppyKit>): Record<PuppyZone, PaintableMaterial> {
  const out = {} as Record<PuppyZone, PaintableMaterial>;
  for (const [zone, material] of Object.entries(zoneMaterials(kit)) as [PuppyZone, MeshPhysicalMaterial][]) out[zone] = new PaintableMaterial(material);
  return out;
}

/** The meshes of each zone (every mesh wearing its material) and the side to frame it from. */
function zoneParts(root: Object3D, kit: ReturnType<typeof createPuppyKit>): Record<string, ZoneParts> {
  const materials = zoneMaterials(kit);
  const meshes: Record<string, Object3D[]> = {};
  root.traverse((node) => {
    const material = (node as Mesh).material;
    for (const [zone, m] of Object.entries(materials)) if (material === m && node.visible) (meshes[zone] ??= []).push(node);
  });
  const YAW: Partial<Record<PuppyZone, number>> = { ears: 0.5, tail: 2.2, legs: 0.35 };
  return Object.fromEntries(Object.entries(meshes).map(([zone, list]) => [zone, { meshes: list, yaw: YAW[zone as PuppyZone] ?? 0 }]));
}
