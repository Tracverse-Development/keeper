/**
 * The Welder's Visor (slot `face`, robots only): a riveted brass band that wraps the head at eye
 * height with a long tinted glass across the eyes, lit softly from inside while the robot works.
 *
 * Pattern: Adapter. The band follows the head's published ring at the eyes' height (`fit.ts`), so it
 * wraps whatever head offers a face; its glass spans the eyes. It rides the head bone.
 *
 * Effects: `color` (the brass) and `lens` (the glass). Work brightens the glass.
 */
import { CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, SphereGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { trimMaterial } from '../cloth.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import { radiusAt, surfaceDepth, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

const BAND_HEIGHT = 0.16;
const EASE = 0.035;

export function createWelderVisor(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'welder-visor';
  const shape = fit.shape;
  const eyes = shape?.eyes;
  if (!shape || !eyes) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const brass = trimMaterial(effectColour(effects, 'color'));
  const tint = effectColour(effects, 'lens');
  const glass = new MeshPhysicalMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.6, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 });
  const r = radiusAt(shape, eyes.y) + EASE;
  const depth = surfaceDepth(shape, eyes.y) / Math.max(radiusAt(shape, eyes.y), 1e-3);
  // The band: an open cylinder squashed to the head's depth, at eye height.
  const band = new Mesh(new CylinderGeometry(r, r, BAND_HEIGHT * 1.4, 64, 1, true), brass);
  band.scale.z = depth;
  band.position.y = eyes.y;
  group.add(band);
  // The glass: the front arc of a slightly larger band, taller, over both eyes.
  const span = Math.min(Math.PI * 0.62, ((eyes.x + eyes.radius * 1.6) / r) * 2);
  const lens = new Mesh(new CylinderGeometry(r + 0.012, r + 0.012, BAND_HEIGHT * 1.9, 48, 1, true, Math.PI / 2 - span / 2 + Math.PI, span), glass);
  lens.rotation.y = Math.PI;
  lens.scale.z = depth;
  lens.position.y = eyes.y;
  group.add(lens);
  // Rivets either side of the glass.
  const rivet = new SphereGeometry(0.022, 12, 8);
  for (const side of [-1, 1]) {
    for (const dy of [-0.06, 0.06]) {
      const angle = side * (span / 2 + 0.12);
      const dot = new Mesh(rivet, brass);
      dot.position.set(Math.sin(angle) * (r + 0.01), eyes.y + dy, Math.cos(angle) * (r + 0.01) * depth);
      group.add(dot);
    }
  }
  return {
    group,
    pivotY: eyes.y,
    update(frame: PartFrame) {
      glass.emissiveIntensity = 0.45 + 1.1 * frame.work + 0.1 * Math.sin(frame.time * 2.1);
    },
    dispose: () => disposeTree(group),
  };
}
