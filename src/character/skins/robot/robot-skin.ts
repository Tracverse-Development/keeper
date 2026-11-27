/**
 * The robot skin (species), "Robot": the pearl head with the navy visor face, gold ear
 * rings and the glossy navy spirit torso. The DEFAULT look; its idle pose and expressions
 * are the ones the character first shipped with, unchanged (`body.ts`, `face.ts`).
 *
 * As a `Skin` strategy it maps the shared dials onto the robot: breathing bob and happy
 * hop on the root, lean and sway on the body, gaze yaw/pitch, tilts and nods on the head,
 * and the glyph eyes and mouth on the visor. Touch adds a short head jolt on a poke and a
 * lean into the hand on a pat. Work (`reactions.ts`, `work`) shifts the eyes to cyan then
 * amber, heats the chest light and visor rim, and near the limit raises embers and a fine
 * hum. Thinking (`R.think`, drama from `thinking.ts`) is a cinematic state on top: the eyes
 * become a cyan scanning display, data lines flow across the visor, energy rings pulse out
 * from the head, the head tilts and looks up and aside in concentration and the chest light
 * beats like a heart that quickens with work; a reply arriving flashes the eyes ("got it").
 * Emotes (`frame.emote`) add squash and stretch, hops, spins, sways and nods to the rig and
 * draw on the screen: heart eyes, sparkle-star eyes, a wink, an "o" mouth; thinking turns the
 * eyes into spinning loader rings, and speaking (or listening) turns the mouth into an
 * equaliser that follows the voice (`speech-bars.ts`).
 * Every amplitude comes from the data table; at zero touch, zero work, no thinking and no
 * emote every number is exactly what it was.
 */
import { Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { measureZones } from '../../look/zone-focus';
import { LOOK_ZONES, type ResolvedLook } from '../../look/zones';
import { speechBars } from '../../speech-bars';
import { cyclePhase, heartbeat, heartbeatRate, scanSweep, thinkDrama } from '../../thinking';
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
import { addRobotThinking } from './robot-thinking';
import { createItemMoments } from '../../item-moments';
import { poseRobotMoment, ROBOT_MOMENTS } from './robot-moments';

/** The speaking equaliser's floor between words (share of full height). */
const BAR_MURMUR = 0.18;

export function createRobotSkin(): Skin {
  const body = createBody();
  const face = createFace();
  body.head.add(face.group);
  const embers = createRobotEmbers();
  body.root.add(embers.group);
  const thinking = addRobotThinking(body.head);
  const slots = addSlotAnchors(body.root, slotsOf('robot'), { body: body.body, head: body.head });
  const zones = { ...body.zones, eyes: { paint: face.paintEyes } };
  const z = body.zoneMeshes;
  const focus = measureZones(body.root, {
    head: { meshes: z.head },
    face: { meshes: z.face },
    eyes: { meshes: face.eyeMeshes },
    body: { meshes: z.body },
    core: { meshes: z.core },
    antenna: { meshes: z.antenna, yaw: 0.7 },
  });

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
  /** The heartbeat's own clock: its rate follows work, so the phase is accumulated (no jumps). */
  let beatPhase = 0;
  /** Small idle gestures with what it wears (`robot-moments.ts`). */
  const moments = createItemMoments(ROBOT_MOMENTS);

  function apply(frame: SkinFrame): void {
    const p = frame.mood;
    const { root, body: torso, head } = body;
    const a = frame.motion.amplitude;
    const t = frame.time * frame.motion.speed;
    const { poke, pat } = frame.touch;
    const work = effectiveWork(frame.work, frame.weights.thinking, R.think.workBoost);
    const hum = band(work, R.work.emberFrom, 1);
    const drama = thinkDrama(frame.weights.thinking, frame.work, frame.dramaFloor);
    const T = R.think;

    const e = frame.emote;
    const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
    const hop = Math.abs(Math.sin(t * Math.PI * R.celebrate.hopSpeed)) * p.bounce;
    root.position.y = (breath * p.bobAmp + hop) * a + R.poke.lift * poke * a + e.lift * a;
    root.position.x = hum > 0 ? vibration(t, R.work.vibrationSpeed) * R.work.vibration * hum * a : 0;
    const scale = 1 + breath * 0.006 * a;
    const squash = e.squash * a;
    root.scale.set(scale * (1 - 0.5 * squash), scale * (1 + squash), scale * (1 - 0.5 * squash));
    root.rotation.y = a >= 1 ? e.yaw : 0; // a spin is skipped under reduced motion

    torso.rotation.x = p.lean - R.poke.bodyPitch * poke;
    torso.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.02 * a + leanSide * R.pat.bodyRoll * pat + (e.roll + 0.08 * e.swing) * a;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.34;
    head.rotation.x = -frame.gaze.y * 0.2 + nod + p.lean * 0.4 - R.poke.headPitch * poke + R.pat.headPitch * pat;
    head.rotation.z =
      (Math.sin(t * 0.31) * 0.035 + Math.sin(t * 0.83 + 2) * 0.012) * a - frame.gaze.x * 0.05 + leanSide * R.pat.headRoll * pat;
    head.rotation.z += (0.6 * e.roll - 0.14 * e.swing) * a;
    head.rotation.x += e.pitch * a;
    if (drama > 0) {
      // Concentrating: the head cocks, lifts and glances slowly aside, as if reading upward.
      head.rotation.z += drama * a * (T.tilt + T.tiltSway * Math.sin(t * 0.7));
      head.rotation.y += drama * a * T.glance * Math.sin(t * 0.42 + 0.6);
      head.rotation.x -= drama * a * T.lookUp;
      beatPhase = (beatPhase + frame.dt * frame.motion.speed * heartbeatRate(frame.work)) % 1;
    }
    poseRobotMoment(head, torso, moments.step(frame));
    const scanTime = t * (1 + work);

    // Humming shows a soft equaliser too, swaying to its own little tune.
    const bars = Math.min(1, frame.weights.speaking + frame.weights.listening + 0.8 * e.hum);
    workTint(work, R.work, tint);
    const voiceGlow = 1 + frame.voice * 0.15;
    face.update({
      eyeOpen: p.eyeOpen * (1 - frame.blink) * (1 + frame.voice * 0.06) * (1 + T.gotItWiden * frame.gotIt),
      squint: p.squint,
      eyeBend: p.eyeBend,
      glow: p.glow * voiceGlow * (1 + T.gotItFlash * frame.gotIt),
      gazeX: frame.gaze.x,
      gazeY: frame.gaze.y,
      mouthOpen: frame.mouth,
      smile: p.smile,
      cool: tint.cool,
      hot: tint.hot,
      scan: drama * (1 - frame.gotIt),
      scanX: scanSweep(cyclePhase(scanTime, T.scanSeconds)),
      scanTime,
      hearts: e.hearts,
      stars: e.stars,
      loader: drama * (1 - frame.gotIt),
      wink: e.wink,
      mouthO: e.mouthO,
      bars,
      time: frame.time,
    });
    // While it speaks the bars never lie flat (a low murmur between words); the square root
    // makes quiet speech still read as movement.
    const tune = e.hum > 0 ? e.hum * (0.3 + 0.2 * Math.sin(frame.time * 5.4)) : 0;
    speechBars(Math.sqrt(Math.max(frame.mouth, frame.voice, BAR_MURMUR * frame.weights.speaking, tune)), frame.time, face.barHeights);
    const beat = drama * T.heartbeat * heartbeat(beatPhase) + T.gotItFlash * frame.gotIt;
    body.setLights(frame.voice, p.presence, band(work, R.work.heatFrom, 1), R.work.heatGlow, beat);
    thinking.update(drama * (0.4 + 0.6 * a), t); // reduced motion: calmer rings and lines
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
    focus,
    paint(look: ResolvedLook) {
      for (const zone of LOOK_ZONES.robot) zones[zone].paint(look[zone]);
    },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    wearing: (parts) => moments.setWorn(parts),
    playMoment: (id) => moments.play(id),
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
