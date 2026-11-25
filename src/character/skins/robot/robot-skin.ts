/**
 * The robot skin (species), "Umoja": the pearl head with the navy visor face, gold ear
 * rings and the glossy navy spirit torso. The DEFAULT look; its idle pose and expressions
 * are the ones the character first shipped with, unchanged (`body.ts`, `face.ts`).
 *
 * As a `Skin` strategy it maps the shared dials onto the robot: breathing bob and happy
 * hop on the root, lean and sway on the body, gaze yaw/pitch, tilts and nods on the head,
 * and the glyph eyes and mouth on the visor. Touch adds a short head jolt on a poke and a
 * lean into the hand on a pat. Work (`reactions.ts`, `work`) shifts the eyes to cyan then
 * amber, heats the chest light and visor rim, and near the limit raises embers and a fine
 * hum. Every amplitude comes from the data table; at zero touch and zero work every number
 * is exactly what it was.
 */
import { Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { band, effectiveWork, workTint } from '../../work-level';
import { addSlotAnchors } from '../anchors';
import { slotsOf } from '../catalog';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { createBody } from './body';
import { createFace } from './face';
import { HEAD_RADII } from './head-shape';
import { ROBOT_REACTIONS as R } from './reactions';
import { createRobotEmbers } from './robot-embers';

export function createRobotSkin(): Skin {
  const body = createBody();
  const face = createFace();
  body.head.add(face.group);
  const embers = createRobotEmbers();
  body.root.add(embers.group);
  const slots = addSlotAnchors(body.root, slotsOf('robot'));

  const headProxy = addHitProxy(body.head, {
    radii: [HEAD_RADII.x * 1.18, HEAD_RADII.y * 1.04, HEAD_RADII.z * 1.04],
    centre: [0, 0, 0],
  });
  const bodyProxy = addHitProxy(body.body, { radii: [0.6, 0.78, 0.6], centre: [0, -1.12, 0] });
  const touchOrigin = new Object3D();
  touchOrigin.position.set(0, HEAD_RADII.y * 0.95, 0.15);
  body.head.add(touchOrigin);

  /** Which way the head leans into a pat (-1 or 1), picked per pat. */
  let leanSide = 1;
  const tint = { cool: 0, hot: 0 };

  function apply(frame: SkinFrame): void {
    const p = frame.mood;
    const { root, body: torso, head } = body;
    const a = frame.motion.amplitude;
    const t = frame.time * frame.motion.speed;
    const { poke, pat } = frame.touch;
    const work = effectiveWork(frame.work, frame.weights.thinking, R.think.workBoost);
    const hum = band(work, R.work.emberFrom, 1);

    const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
    const hop = Math.abs(Math.sin(t * Math.PI * R.celebrate.hopSpeed)) * p.bounce;
    root.position.y = (breath * p.bobAmp + hop) * a + R.poke.lift * poke * a;
    root.position.x = hum > 0 ? vibration(t, R.work.vibrationSpeed) * R.work.vibration * hum * a : 0;
    root.scale.setScalar(1 + breath * 0.006 * a);

    torso.rotation.x = p.lean - R.poke.bodyPitch * poke;
    torso.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.02 * a + leanSide * R.pat.bodyRoll * pat;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.34;
    head.rotation.x = -frame.gaze.y * 0.2 + nod + p.lean * 0.4 - R.poke.headPitch * poke + R.pat.headPitch * pat;
    head.rotation.z =
      (Math.sin(t * 0.31) * 0.035 + Math.sin(t * 0.83 + 2) * 0.012) * a - frame.gaze.x * 0.05 + leanSide * R.pat.headRoll * pat;

    workTint(work, R.work, tint);
    const voiceGlow = 1 + frame.voice * 0.15;
    face.update({
      eyeOpen: p.eyeOpen * (1 - frame.blink) * (1 + frame.voice * 0.06),
      squint: p.squint,
      eyeBend: p.eyeBend,
      glow: p.glow * voiceGlow,
      gazeX: frame.gaze.x,
      gazeY: frame.gaze.y,
      mouthOpen: frame.mouth,
      smile: p.smile,
      cool: tint.cool,
      hot: tint.hot,
    });
    body.setLights(frame.voice, p.presence, band(work, R.work.heatFrom, 1), R.work.heatGlow);
    embers.update(frame.time, hum, frame.motion.speed);
  }

  return {
    id: 'robot',
    root: body.root,
    gazeAnchor: body.head,
    sparkOrigin: body.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    slots,
    reactions: R,
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    setPointScale: (scale) => embers.setPointScale(scale),
    dispose() {
      face.dispose();
      embers.dispose();
      body.dispose();
    },
  };
}

/** A fine machine hum: two fast sines beating, -1..1. */
function vibration(t: number, speed: number): number {
  return Math.sin(t * speed) * 0.6 + Math.sin(t * speed * 1.37 + 1.3) * 0.4;
}
