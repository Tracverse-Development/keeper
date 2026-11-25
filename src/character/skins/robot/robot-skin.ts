/**
 * The robot skin, "Umoja": the pearl head with the navy visor face, gold ear rings and
 * the glossy navy spirit torso. The DEFAULT look; its idle pose and expressions are the
 * ones the character first shipped with, unchanged (`body.ts`, `face.ts`).
 *
 * As a `Skin` strategy it maps the shared dials onto the robot: breathing bob and happy
 * hop on the root, lean and sway on the body, gaze yaw/pitch, tilts and nods on the head,
 * and the glyph eyes and mouth on the visor. Touch adds a short head jolt on a poke and a
 * lean into the hand on a pat; at zero touch every number is exactly what it was.
 */
import { Object3D } from 'three';
import type { TouchKind } from '../../contract';
import { addHitProxy } from '../hit-proxy';
import type { Skin, SkinFrame } from '../skin';
import { createBody } from './body';
import { createFace } from './face';
import { HEAD_RADII } from './head-shape';

export function createRobotSkin(): Skin {
  const body = createBody();
  const face = createFace();
  body.head.add(face.group);

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

  function apply(frame: SkinFrame): void {
    const p = frame.mood;
    const { root, body: torso, head } = body;
    const a = frame.motion.amplitude;
    const t = frame.time * frame.motion.speed;
    const { poke, pat } = frame.touch;

    const breath = Math.sin(t * Math.PI * 2 * p.bobSpeed);
    const hop = Math.abs(Math.sin(t * Math.PI * 1.7)) * p.bounce;
    root.position.y = (breath * p.bobAmp + hop) * a + 0.05 * poke * a;
    root.scale.setScalar(1 + breath * 0.006 * a);

    torso.rotation.x = p.lean - 0.05 * poke;
    torso.rotation.z = Math.sin(t * 0.29 + 0.7) * 0.02 * a + leanSide * 0.04 * pat;

    const nod = Math.sin(t * 5.4) * p.nod * (0.4 + frame.mouth) * a;
    head.rotation.y = frame.gaze.x * 0.34;
    head.rotation.x = -frame.gaze.y * 0.2 + nod + p.lean * 0.4 - 0.14 * poke + 0.07 * pat;
    head.rotation.z =
      (Math.sin(t * 0.31) * 0.035 + Math.sin(t * 0.83 + 2) * 0.012) * a - frame.gaze.x * 0.05 + leanSide * 0.16 * pat;

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
    });
    body.setEarGlow(frame.voice);
    body.setPresence(p.presence);
  }

  return {
    id: 'robot',
    root: body.root,
    gazeAnchor: body.head,
    sparkOrigin: body.heart,
    touchOrigin,
    hitRegions: { head: [headProxy], body: [bodyProxy] },
    apply,
    react(kind: TouchKind) {
      if (kind === 'pat') leanSide = Math.random() < 0.5 ? -1 : 1;
    },
    dispose() {
      face.dispose();
      body.dispose();
    },
  };
}
