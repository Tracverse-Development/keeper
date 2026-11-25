/**
 * The Crew Cap (slot `head`, any species with a head): a six-panel cap shaped to the head.
 *
 * Pattern: Adapter. The crown follows the head's published dome (`fit.ts`) from the top down to
 * the shape's reach with a little EASE (so it fits the robot's wide pearl head and the puppy's
 * rounder skull alike), six seams in the trim colour meet at a button on top, a piped band runs
 * round the rim, and the brim grows out of the rim's own front curve, longest at the centre and
 * tipped slightly down. It rides the head bone, so it turns and nods with the head.
 *
 * Effects: `color` (the crown) and `trim` (brim, seams, band and button). It has no motion of its
 * own: a cap that wobbles looks loose.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, SphereGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, type BodyShape, type GarmentRing, type PartFit } from '../fit.ts';
import { edgePoints, fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartInstance } from '../part';

const EASE = 0.03;
const RINGS = 18;
const SEGMENTS = 72;
const SEAMS = 6;
const PIPING = 0.012;
/** The brim's length as a share of the head's half-width, how far round it reaches, and its droop. */
const BRIM_SHARE = 0.42;
const BRIM_SPAN = 1.25;
const BRIM_DROOP = 0.16;

export function createCrewCap(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'crew-cap';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const crownMaterial = clothMaterial(effectColour(effects, 'color'), 0.9);
  const trim = trimMaterial(effectColour(effects, 'trim'));
  const crownTop = shape.profile[0][1] * 0.999;
  const rings = garmentRings(shape, crownTop, shape.reach, EASE, RINGS);
  const crown = new Mesh(fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: shape.squareness }), crownMaterial);
  crown.name = 'cap-crown';
  group.add(crown);

  const rim = rings[rings.length - 1];
  const band = new Mesh(piping(ringPoints(rim, shape.squareness, 0, Math.PI * 2, 64), PIPING * 1.3, true), trim);
  band.name = 'cap-band';
  group.add(band);
  for (let i = 0; i < SEAMS; i++) {
    // Seams run from just under the button to the rim, standing a hair off the crown.
    const lifted = rings.slice(1).map((r) => ({ y: r.y, rx: r.rx + PIPING * 0.4, rz: r.rz + PIPING * 0.4 }));
    const seam = new Mesh(piping(edgePoints(lifted, shape.squareness, (i / SEAMS) * Math.PI * 2 + Math.PI / SEAMS), PIPING * 0.45), trim);
    seam.name = 'cap-seam';
    group.add(seam);
  }
  const buttonRadius = 0.055 * rim.rx;
  const button = new Mesh(new SphereGeometry(buttonRadius, 20, 12), trim);
  button.name = 'cap-button';
  button.scale.y = 0.55;
  button.position.y = crownTop + EASE + buttonRadius * 0.4;
  group.add(button);

  const brim = new Mesh(brimGeometry(shape, rim), trim);
  brim.name = 'cap-brim';
  group.add(brim);

  return { group, pivotY: rim.y, update: () => undefined, dispose: () => disposeTree(group) };
}

/**
 * The brim: a band grown outward from the rim's front arc. Its inner edge IS the rim (so it fits
 * any head), its length peaks at the front, and it tips down as it reaches out.
 */
function brimGeometry(shape: BodyShape, rim: GarmentRing): BufferGeometry {
  const columns = 41;
  const rows = 6;
  const length = BRIM_SHARE * rim.rx;
  const positions = new Float32Array(columns * rows * 3);
  for (let j = 0; j < columns; j++) {
    const angle = -BRIM_SPAN + (2 * BRIM_SPAN * j) / (columns - 1);
    const [x, z] = crossSection(angle, rim.rx, rim.rz, shape.squareness);
    const out = Math.hypot(x, z) || 1;
    const reach = length * Math.cos((angle / BRIM_SPAN) * (Math.PI / 2)) ** 0.7;
    for (let i = 0; i < rows; i++) {
      const u = i / (rows - 1);
      const along = reach * u;
      const k = (j * rows + i) * 3;
      positions.set([x + (x / out) * along, rim.y - BRIM_DROOP * along * (0.5 + u), z + (z / out) * along], k);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < columns - 1; j++) {
    for (let i = 0; i < rows - 1; i++) {
      const a = j * rows + i;
      const b = a + rows;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
