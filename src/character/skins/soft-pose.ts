/**
 * The shared pose of the soft bodies (the man, the woman, the owl, the God Keeper): how the root,
 * the body and the head answer one frame of shared dials. Breathing and the happy hop lift the
 * root; emotes squash, stretch, lift and spin it; the body leans with the mood and into a pat;
 * the head follows the gaze, nods while it talks, tilts and looks up as it thinks, jolts back at a
 * poke and leans into a pat. Each body adds its own on top (arms, wings, a crown of light).
 *
 * Every amplitude is read from the body's reaction table (`SoftReactions`); at zero touch, zero
 * work, no thinking and no emote this is the idle pose. Pattern: Template Method by composition:
 * the skin calls `poseSoftBody` first, then poses what only it has.
 */
import type { Object3D } from 'three';
import { cyclePhase, holdWave, thinkDrama } from '../thinking';
import { effectiveWork } from '../work-level';
import type { ReactionTable, ThinkTuning } from './reactions-table';
import type { SkinFrame } from './skin';

export interface SoftThinkTuning extends ThinkTuning {
  /** Head roll while concentrating (radians), how long one puzzled tilt takes, and a look up. */
  readonly tilt: number;
  readonly tiltSeconds: number;
  readonly lookUp: number;
  /** Eye widening as a reply arrives ("got it"). */
  readonly gotItWiden: number;
}

export interface SoftReactions extends ReactionTable {
  readonly think: SoftThinkTuning;
  /** How much the whole body floats and bobs (1 = standing; the God Keeper hovers). */
  readonly float: number;
}

export interface SoftRig {
  readonly root: Object3D;
  readonly body: Object3D;
  readonly head: Object3D;
}

export interface SoftPose {
  /** Thinking drama 0..1, effective work 0..1, the happy cheer 0..1, the clock (s, motion speed). */
  readonly drama: number;
  readonly work: number;
  readonly cheer: number;
  readonly t: number;
}

/** Poses root, body and head from `frame`; `leanSide` is the side a pat leans to (-1 or 1). */
export function poseSoftBody(rig: SoftRig, frame: SkinFrame, R: SoftReactions, leanSide: number, rootY = 0): SoftPose {
  const p = frame.mood;
  const a = frame.motion.amplitude;
  const t = frame.time * frame.motion.speed;
  const { poke, pat } = frame.touch;
  const e = frame.emote;
  const work = effectiveWork(frame.work, frame.weights.thinking, R.think.workBoost);
  const drama = thinkDrama(frame.weights.thinking, frame.work, frame.dramaFloor);
  const cheer = Math.max(e.stars, e.hearts, e.happy);

  const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
  const hop = Math.abs(Math.sin(t * Math.PI * R.celebrate.hopSpeed)) * p.bounce;
  const nap = Math.max(e.nap, frame.weights.asleep);
  rig.root.position.y = rootY + (breath * p.bobAmp * R.float + hop) * a + R.poke.lift * poke * a + e.lift * a - nap * R.sleep.sink;
  const squash = e.squash * a;
  const chest = 1 + breath * 0.008 * a;
  rig.root.scale.set(chest * (1 - 0.5 * squash), 1 + squash, chest * (1 - 0.5 * squash));
  rig.root.rotation.y = a >= 1 ? e.yaw : 0;

  rig.body.rotation.x = p.lean * 0.7 - R.poke.bodyPitch * poke + nap * 0.06;
  rig.body.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.018 * a + leanSide * R.pat.bodyRoll * pat + (e.roll + 0.05 * e.swing) * a;

  const head = rig.head;
  const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
  const bob = Math.sin(t * R.work.headBobSpeed) * R.work.headBob * work * a;
  head.rotation.y = frame.gaze.x * 0.38;
  head.rotation.x = -frame.gaze.y * 0.22 + nod + p.lean * 0.4 - R.poke.headPitch * poke + R.pat.headPitch * pat + bob + nap * 0.25 + e.pitch * a;
  head.rotation.z =
    (Math.sin(t * 0.31) * 0.035 + Math.sin(t * 0.83 + 2) * 0.012) * a - frame.gaze.x * 0.05 + leanSide * R.pat.headRoll * pat + (0.6 * e.roll + 0.12 * e.swing) * a + nap * 0.12;
  if (drama > 0) {
    head.rotation.z += drama * a * R.think.tilt * holdWave(cyclePhase(t, R.think.tiltSeconds));
    head.rotation.x -= drama * a * R.think.lookUp;
  }
  return { drama, work, cheer, t };
}

/** The shared eye pose: lids, squint, gaze and the emote extras, with "got it" widening. */
export function softEyePose(frame: SkinFrame, R: SoftReactions) {
  const p = frame.mood;
  const e = frame.emote;
  return {
    open: p.eyeOpen * (1 - frame.blink) * (1 + R.think.gotItWiden * frame.gotIt) * (1 - 0.55 * e.sleepy),
    squint: Math.max(p.squint, 0.7 * e.happy),
    gazeX: frame.gaze.x,
    gazeY: frame.gaze.y,
    sparkle: p.presence * (1 + frame.gotIt),
    wink: e.wink,
    pop: e.wide,
    stars: e.stars,
    brows: Math.min(1, 0.8 * e.wide + 0.4 * frame.gotIt + 0.3 * p.smile) - 0.4 * frame.weights.thinking,
  };
}
