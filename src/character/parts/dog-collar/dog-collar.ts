/**
 * The Collar (slot `neck`, dogs only): a soft leather band round the neck with a round metal
 * name tag hanging at the front.
 *
 * Pattern: Adapter. The band is sized from the neck's published shape (`fit.ts`): it clears the
 * widest the neck gets across the band's own height (on a boxy neck, its corners too), is as deep
 * as the neck, and leans with the neck opening, so it hugs the dog's own collar line (and covers
 * the navy collar it ships with). The tag hangs from the band's front and is pushed out far
 * enough to clear the chest below it, read from the same shape; it swings a little.
 *
 * Effects: `color` (the leather), `tag` (the tag's metal).
 */
import { CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import { surfaceDepth, widestBetween, type PartFit } from '../fit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The band's half-height and thickness, the room it leaves round the neck, and the tag's size. */
const BAND_HALF = 0.07;
const BAND_TUBE = 0.045;
const ROOM = 0.012;
const TAG_RADIUS = 0.115;
const TAG_THICK = 0.026;
const TAG_DROP = 0.15;
const TAG_CLEAR = 0.03;

/** The band's centre-line radius round a neck of half-width `neck`. */
function radiusFor(neck: number): number {
  return neck + ROOM + BAND_TUBE;
}

export function createDogCollar(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'dog-collar';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const leather = new MeshPhysicalMaterial({ color: effectColour(effects, 'color'), roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35, sheen: 0.4, sheenRoughness: 0.5 });
  const metal = new MeshPhysicalMaterial({ color: effectColour(effects, 'tag'), roughness: 0.22, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.1 });

  const lean = shape.lean ?? 0;
  // A leaning band reaches lower at the front (and higher at the back) than its own height:
  // clear the widest the neck gets over that whole span (twice, as the span grows with the band).
  const corner = 2 ** (0.5 - 1 / shape.squareness);
  let radius = radiusFor(widestBetween(shape, BAND_HALF, -BAND_HALF) * corner);
  for (let i = 0; i < 2; i++) {
    const reach = BAND_HALF + BAND_TUBE + Math.sin(lean) * radius;
    radius = radiusFor(widestBetween(shape, reach, -reach) * corner);
  }
  const neck = radius - ROOM - BAND_TUBE;
  const band = new Mesh(new TorusGeometry(radius, BAND_TUBE, 16, 96), leather);
  band.name = 'collar-band';
  band.rotation.x = Math.PI / 2;
  // Flattened into a band: taller than its tube, still round where it meets the neck.
  band.scale.set(1, 1, BAND_HALF / BAND_TUBE);
  const tilt = new Group();
  tilt.rotation.x = lean;
  tilt.scale.z = (neck * shape.depth + ROOM + BAND_TUBE) / radius;
  tilt.add(band);
  group.add(tilt);

  // The tag hangs from the front of the band, clear of the chest beneath it.
  const front = radius * tilt.scale.z + BAND_TUBE;
  const hangY = -Math.sin(lean) * front - BAND_HALF * 0.6;
  const hangZ = Math.cos(lean) * front;
  const swing = new Group();
  swing.position.set(0, hangY, hangZ);
  group.add(swing);
  const ring = new Mesh(new TorusGeometry(0.03, 0.009, 10, 28), metal);
  ring.position.y = -0.02;
  swing.add(ring);
  const tagY = -TAG_DROP;
  let chest = 0;
  for (let i = 0; i <= 8; i++) chest = Math.max(chest, surfaceDepth(shape, hangY + tagY + TAG_RADIUS * (1 - i / 4)));
  // The tag rests on the chest just below the band (its cord may angle back toward the body).
  const tagZ = chest + TAG_CLEAR + TAG_THICK / 2 - hangZ;
  const tag = new Mesh(new CylinderGeometry(TAG_RADIUS, TAG_RADIUS, TAG_THICK, 40), metal);
  tag.name = 'collar-tag';
  tag.rotation.x = Math.PI / 2;
  tag.position.set(0, tagY, tagZ);
  swing.add(tag);

  function update(frame: PartFrame): void {
    const t = frame.time * frame.motion.speed;
    const a = frame.motion.amplitude;
    // Swinging only outward (never into the chest), and a touch sideways.
    swing.rotation.x = -0.06 * (0.5 + 0.5 * Math.sin(t * 1.1 + 0.4)) * a;
    swing.rotation.z = 0.07 * Math.sin(t * 0.9) * a;
  }

  return { group, update, dispose: () => disposeTree(group) };
}
