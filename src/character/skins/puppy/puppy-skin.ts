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
 */
import { Group, Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { damp } from '../../moods';
import { cyclePhase, holdWave, sniff, thinkDrama, twitch } from '../../thinking';
import { band, effectiveWork } from '../../work-level';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { addPuppyBody } from './puppy-body';
import { addPuppyHead } from './puppy-head';
import { createPuppyKit } from './puppy-kit';
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
  const slots = addSlotAnchors(root, slotsOf('puppy'), { body, head });

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
    const a = frame.motion.amplitude;
    const t = frame.time * frame.motion.speed;
    const { poke, pat } = frame.touch;
    const w = effectiveWork(frame.work, frame.weights.thinking, R.think.workBoost);
    const pant = band(w, R.work.pantFrom, R.work.pantTo);
    const T = R.think;
    const drama = thinkDrama(frame.weights.thinking, frame.work);

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
    body.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.015 * a + leanSide * R.pat.bodyRoll * pat + (e.roll + 0.04 * e.swing) * a;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.38;
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
    head.rotation.x += e.pitch * a;
    // The hello wave: the paw lifts forward and up, then waves from the shoulder.
    parts.paw.rotation.set(-2.1 * e.paw * (0.6 + 0.4 * a), 0, 0.35 * e.swing * e.paw * a);
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
      d.earPerk + R.poke.earPop * poke + 0.25 * frame.voice + R.work.earPerk * w + T.gotItEars * frame.gotIt + 0.8 * e.wide + 0.5 * e.stars + 0.35 * e.paw - 0.45 * e.sleepy;
    const flickLeft = drama * T.earTwitch * twitch(cyclePhase(t, T.earTwitchSeconds));
    const flickRight = drama * T.earTwitch * twitch(cyclePhase(t + T.earTwitchSeconds / 2, T.earTwitchSeconds));
    poseEars(frame, perk, d.earTwitch, R.work.earTwitch * w, Math.max(pat, 0.7 * e.hearts), t, flickLeft, flickRight);
    face.sniff(drama * sniff(cyclePhase(t, T.sniffSeconds)));

    const tailSpeed = d.tailSpeed + R.pat.tailSpeed * pat + R.poke.tailSpeed * poke + R.work.tailSpeed * w + 3 * cheer + 2 * e.paw;
    tailPhase += frame.dt * Math.PI * 2 * tailSpeed * frame.motion.speed;
    const sweep = drama > 0 ? drama * T.tailSweep * Math.sin(t * T.tailSweepSpeed) : 0;
    const wag = (Math.sin(tailPhase) * (d.tailWag + R.pat.tailWag * pat + R.work.tailWag * w + 0.5 * cheer + 0.3 * e.paw) + sweep) * a;
    parts.tail.rotation.set(0.15 + d.curl * 0.5, wag * 0.35, -0.38 - d.curl * 0.7 + wag);

    parts.tag.rotation.x = Math.sin(t * 1.1 + 0.4) * 0.05 * a - body.rotation.x * 0.6 + R.poke.tagSwing * poke;
    parts.tag.rotation.z = Math.sin(t * 0.9) * 0.07 * a - body.rotation.z;
    kit.materials.tagGlow.color.copy(tagColour).multiplyScalar((0.45 + 0.55 * p.presence) * (1 + frame.voice * 0.6));
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
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    setPointScale: (scale) => bubble.setPointScale(scale),
    dispose: () => disposeTree(root),
  };
}
