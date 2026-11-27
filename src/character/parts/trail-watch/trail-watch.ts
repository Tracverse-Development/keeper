/**
 * The Trail Watch (slot `wrist`, humans): a round field watch on a strap, wrapped round the left
 * wrist the body publishes (`fit.ts`), with a bezel, a softly lit dial and two hands that keep the
 * real time (hours and minutes).
 *
 * Pattern: Adapter. The strap's ring is the wrist's own ring plus a little ease, so it fits a man's
 * wrist, a woman's, and the God Keeper's. The face looks out from the back of the hand (+z when the
 * arm hangs at rest). It rides the arm bone, so it swings and waves with the arm.
 *
 * Effects: `color` (the strap), `face` (the dial) and `glow` (how brightly the dial is lit).
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { radiusAt, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The strap sits just off the wrist: its tube's inner edge clears the skin. */
const STRAP_TUBE = 0.024;
const EASE = STRAP_TUBE + 0.003;

export function createTrailWatch(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'trail-watch';
  if (!fit.shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const wrist = radiusAt(fit.shape, 0) || 0.1;
  const r = wrist + EASE;
  const strap = new MeshPhysicalMaterial({ color: effectColour(effects, 'color'), roughness: 0.55, clearcoat: 0.3, sheen: 0.4 });
  const metal = trimMaterial(0xd9cfbd);
  const dialColour = effectColour(effects, 'face');
  const dial = new MeshPhysicalMaterial({ color: dialColour, emissive: dialColour, emissiveIntensity: 0.3 * effectNumber(effects, 'glow'), roughness: 0.3, clearcoat: 1 });
  const hand = new MeshPhysicalMaterial({ color: 0x151c33, roughness: 0.4 });

  const band = new Mesh(new TorusGeometry(r, STRAP_TUBE, 10, 40), strap);
  band.rotation.x = Math.PI / 2; // round the arm (the arm runs along y)
  band.scale.z = 1.6; // a flat strap: wider along the arm
  group.add(band);
  const caseRadius = wrist * 0.95;
  const face = new Group();
  face.position.z = r + STRAP_TUBE * 0.5;
  face.rotation.x = Math.PI / 2;
  group.add(face);
  const body = new Mesh(new CylinderGeometry(caseRadius, caseRadius, 0.035, 36), metal);
  face.add(body);
  const disc = new Mesh(new CylinderGeometry(caseRadius * 0.82, caseRadius * 0.82, 0.04, 36), dial);
  disc.position.y = 0.003;
  face.add(disc);
  const bezel = new Mesh(new TorusGeometry(caseRadius * 0.88, 0.009, 8, 36), metal);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.y = 0.021;
  face.add(bezel);
  const hours = new Mesh(new BoxGeometry(0.008, 0.004, caseRadius * 0.45), hand);
  const minutes = new Mesh(new BoxGeometry(0.006, 0.004, caseRadius * 0.7), hand);
  for (const [h, length] of [
    [hours, 0.45],
    [minutes, 0.7],
  ] as const) {
    h.geometry.translate(0, 0, (-caseRadius * length) / 2);
    const pivot = new Group();
    pivot.position.y = 0.024;
    pivot.add(h);
    face.add(pivot);
  }
  const glow = effectNumber(effects, 'glow');
  return {
    group,
    pivotY: 0,
    update(frame: PartFrame) {
      const now = new Date();
      const minute = now.getMinutes() + now.getSeconds() / 60;
      (hours.parent as Group).rotation.y = -((now.getHours() % 12) + minute / 60) * (Math.PI / 6);
      (minutes.parent as Group).rotation.y = -minute * (Math.PI / 30);
      dial.emissiveIntensity = glow * (0.3 + 0.15 * Math.sin(frame.time * 1.3)) * (1 + frame.work * 0.6);
    },
    dispose: () => disposeTree(group),
  };
}
