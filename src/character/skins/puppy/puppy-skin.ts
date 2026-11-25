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
 * leans the head into the hand, flops the ears back and sets the tail going.
 */
import { Group, Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { disposeTree } from '../../dispose-tree';
import { damp } from '../../moods';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { addPuppyBody } from './puppy-body';
import { addPuppyHead } from './puppy-head';
import { createPuppyKit } from './puppy-kit';
import { blendPuppyDials, puppyDials } from './puppy-moods';

/** Head centre height (world units) and how far the curled sleep pose lowers it. */
const HEAD_Y = 0.22;
const CURL_DROP = 0.14;
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

    // Breathing lives in the chest; the whole puppy bobs less than the floating robot.
    const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
    const hop = Math.abs(Math.sin(t * Math.PI * 1.7)) * p.bounce;
    root.position.y = (breath * p.bobAmp * 0.5 + hop) * a + 0.06 * poke * a - d.curl * 0.05;
    const chest = 1 + breath * (0.016 + 0.012 * d.curl) * a;
    parts.torso.scale.set(chest, 1 + breath * 0.006 * a, 0.88 * chest);
    body.rotation.x = p.lean * 0.8 + d.curl * 0.1 - 0.05 * poke;
    body.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.015 * a + leanSide * 0.035 * pat;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.38;
    head.rotation.x = -frame.gaze.y * 0.24 + nod + p.lean * 0.4 + d.curl * 0.28 - 0.16 * poke + 0.1 * pat;
    head.rotation.z =
      (Math.sin(t * 0.31) * 0.04 + Math.sin(t * 0.83 + 2) * 0.015) * a -
      frame.gaze.x * 0.06 +
      d.headTilt +
      d.curl * 0.14 +
      leanSide * 0.2 * pat;
    head.position.y = HEAD_Y - d.curl * CURL_DROP;
    head.position.z = d.curl * 0.16;

    face.eyes.update({
      open: p.eyeOpen * (1 - frame.blink),
      squint: p.squint,
      gazeX: frame.gaze.x,
      gazeY: frame.gaze.y,
      sparkle: p.presence,
    });
    face.setMouth(Math.max(d.mouthOpen * (1 - d.curl), frame.mouth, 0.35 * pat), Math.max(d.tongue, 0.8 * pat));
    poseEars(frame, d.earPerk + 0.6 * poke + 0.25 * frame.voice, d.earTwitch, pat, t);

    tailPhase += frame.dt * Math.PI * 2 * (d.tailSpeed + 3.4 * pat + 1.5 * poke) * frame.motion.speed;
    const wag = Math.sin(tailPhase) * (d.tailWag + 0.55 * pat) * a;
    parts.tail.rotation.set(0.15 + d.curl * 0.5, wag * 0.35, -0.38 - d.curl * 0.7 + wag);

    parts.tag.rotation.x = Math.sin(t * 1.1 + 0.4) * 0.05 * a - body.rotation.x * 0.6 + 0.25 * poke;
    parts.tag.rotation.z = Math.sin(t * 0.9) * 0.07 * a - body.rotation.z;
    kit.materials.tagGlow.color.copy(tagColour).multiplyScalar((0.45 + 0.55 * p.presence) * (1 + frame.voice * 0.6));
  }

  /** Ears: perk/droop, a pat flops them back, they trail the head's tilt (inertia + gravity). */
  function poseEars(frame: SkinFrame, perk: number, twitch: number, pat: number, t: number): void {
    headLag = damp(headLag, head.rotation.z, 5, frame.dt);
    const hang = -0.45 * head.rotation.z - 0.7 * (head.rotation.z - headLag);
    const out = Math.max(EAR_REST + EAR_PERK * perk, 0.12) * (1 - 0.45 * pat);
    const back = 0.75 * pat - 0.35 * Math.max(perk, 0); // perked ears also come forward
    const sway = Math.sin(t * 1.3) * 0.03 * frame.motion.amplitude;
    const flick = twitch * Math.max(0, Math.sin(t * 2.3)) ** 12;
    face.setEars(
      { out: out - hang + sway, back },
      { out: out + hang - sway + 0.4 * flick, back: back - 0.25 * flick },
    );
  }

  return {
    id: 'puppy',
    root,
    gazeAnchor: head,
    sparkOrigin: parts.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    dispose: () => disposeTree(root),
  };
}
