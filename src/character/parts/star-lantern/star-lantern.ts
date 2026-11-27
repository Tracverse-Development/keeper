/**
 * The Star Lantern (slot `held`, humans): a small brass lantern carried in the right hand: a ring
 * handle in the grip, a cap, four slim posts round a glass chimney and a base, with a star of light
 * turning inside that brightens as the keeper works and flares when a reply arrives.
 *
 * Pattern: Adapter. It hangs from the hand the body publishes (`fit.ts`: the handle's ring is sized
 * to the hand), so it sits in any hand that offers the slot. It rides the arm, so it swings with it.
 *
 * Effects: `color` (the brass), `light` (the star's colour) and `glow` (its brightness).
 */
import { Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, OctahedronGeometry, PointLight, Quaternion, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The lantern's size over the hand's radius. */
const SCALE = 1.9;

export function createStarLantern(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'star-lantern';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const hand = radiusAt(fit.shape, 0) || 0.1;
  const s = hand * SCALE;
  const brass = trimMaterial(effectColour(effects, 'color'));
  const light = new Color(effectColour(effects, 'light'));
  const glowAmount = effectNumber(effects, 'glow');
  const glass = new MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.04, clearcoat: 1, depthWrite: false });
  const starMaterial = new MeshBasicMaterial({ color: light.clone().multiplyScalar(2.2) });

  // The lantern hangs below the grip, a little forward of the hand.
  const lantern = new Group();
  lantern.position.set(0, -hand * 0.4, hand * 0.35);
  group.add(lantern);
  const handle = new Mesh(new TorusGeometry(hand * 0.75, 0.014, 8, 28), brass);
  handle.rotation.y = Math.PI / 2;
  lantern.add(handle);
  const top = -hand * 0.75;
  const cap = new Mesh(new CylinderGeometry(s * 0.18, s * 0.42, s * 0.22, 24), brass);
  cap.position.y = top - s * 0.11;
  lantern.add(cap);
  const chimney = new Mesh(new CylinderGeometry(s * 0.36, s * 0.36, s * 0.7, 28, 1, true), glass);
  chimney.position.y = top - s * 0.57;
  lantern.add(chimney);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new Mesh(new CylinderGeometry(0.008, 0.008, s * 0.72, 6), brass);
    post.position.set(Math.cos(a) * s * 0.37, top - s * 0.57, Math.sin(a) * s * 0.37);
    lantern.add(post);
  }
  const base = new Mesh(new CylinderGeometry(s * 0.44, s * 0.3, s * 0.16, 24), brass);
  base.position.y = top - s * 1.0;
  lantern.add(base);
  const star = new Mesh(new OctahedronGeometry(s * 0.13, 0), starMaterial);
  star.position.y = top - s * 0.57;
  lantern.add(star);
  const halo = new Mesh(new OctahedronGeometry(s * 0.2, 0), new MeshBasicMaterial({ color: light.clone().multiplyScalar(0.6), transparent: true, opacity: 0.35, depthWrite: false }));
  halo.position.copy(star.position);
  lantern.add(halo);
  const upright = new Quaternion();
  const lamp = new PointLight(light, 0, s * 6, 2);
  lamp.position.copy(star.position);
  lantern.add(lamp);

  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      star.rotation.y += frame.dt * (0.9 + 2.5 * frame.work) * frame.motion.speed;
      star.rotation.x = 0.4 + 0.2 * Math.sin(frame.time * 0.8);
      halo.rotation.y = -star.rotation.y * 0.6;
      const flicker = 0.9 + 0.1 * Math.sin(frame.time * 9.1) * Math.sin(frame.time * 3.7);
      const bright = glowAmount * flicker * (1 + 0.8 * frame.work + 1.5 * frame.gotIt);
      starMaterial.color.copy(light).multiplyScalar(1 + 1.4 * bright);
      halo.scale.setScalar(1 + 0.15 * bright);
      lamp.intensity = 0.25 * bright;
      // The lantern hangs straight down whatever the arm does (it turns against the hand's own
      // turn), swinging a little on its handle.
      group.getWorldQuaternion(upright).invert();
      lantern.quaternion.copy(upright);
      lantern.rotateZ(Math.sin(frame.time * 1.2) * 0.06 * frame.motion.amplitude);
    },
    dispose: () => disposeTree(group),
  };
}
