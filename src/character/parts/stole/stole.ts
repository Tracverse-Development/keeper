/**
 * The Stole (slot `neck`, the God Keeper's; its Good Shepherd set): a long band of cloth laid round
 * the back of the neck whose two ends hang straight down the front, past the chest. Gold borders
 * are embroidered down both edges of each end and round the neck; a gold cross is worked near the
 * foot of each end and a small one at the back of the neck; each end finishes in a gold fringe. The
 * ends swing softly, outward only.
 *
 * Pattern: Adapter. It is cut from the neck's published shape with the draped panels of `drape.ts`:
 * the neck band follows the neck ring, and each end lies `EASE` off the chest (far enough to clear a
 * robe), leaning out a little below the neck's surface so it hangs clear of the body under it.
 *
 * Effects: `color` (the cloth), `trim` (the embroidery and fringe) and `sway`.
 */
import { BoxGeometry, CylinderGeometry, Group, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, type GarmentRing, type PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, glowTrim, pushOut } from '../garment.ts';
import { bandPatch, drapeEdge, drapeRings } from '../drape.ts';
import { meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.07;
/** Where each end hangs (radians either side of the front) and its half-width (radians). */
const END_AT = 0.5;
const END_HALF = 0.19;
/** The neck band's height, and how far the ends fall (shares of the neck's span). */
const BAND = 0.11;
const FALL = 2.1;
/** How far an end leans out per unit of drop below the neck's surface. */
const LEAN = 0.13;
const RINGS = 26;
const BORDER = 0.007;
const FRINGE = 22;
const SWAY = 0.014;

export function createStole(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'stole';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const cloth = clothMaterial(effectColour(effects, 'color'), 0.7);
  const trimColour = effectColour(effects, 'trim');
  const gold = glowTrim(trimColour, 0.35);
  const sway = effectNumber(effects, 'sway');
  const add = meshAdder(group);
  const sq = shape.squareness;

  const top = shape.profile[0][1] - 0.02;
  const span = top - shape.reach;
  const end = top - span * FALL;
  const rings = drapeRings(shape, top, end, EASE, RINGS, LEAN);

  // Round the back of the neck: a band from one end round to the other.
  const band = drapeRings(shape, top, top - BAND, EASE, 4, 0);
  add(pushOut(bandPatch(band, sq, () => END_AT - END_HALF * 0.6, () => Math.PI * 2 - END_AT + END_HALF * 0.6, 64), shape, EASE * 0.8), cloth, 'stole-band');
  const trims: BufferGeometry[] = [];
  for (const ring of [band[0], band[band.length - 1]]) trims.push(piping(ringPoints(lift(ring, 0.005), sq, END_AT, Math.PI * 2 - END_AT, 64), BORDER));
  trims.push(cross(lift(band[1], 0.008), Math.PI, sq, BAND * 0.7));

  // The two ends, their borders, crosses and fringes.
  const sways: ((frame: PartFrame) => void)[] = [];
  const foot = rings[rings.length - 1];
  for (const centre of [END_AT, Math.PI * 2 - END_AT]) {
    const panel = bandPatch(rings, sq, () => centre - END_HALF, () => centre + END_HALF, 12);
    add(pushOut(panel, shape, EASE * 0.8), cloth, 'stole-end');
    sways.push(garmentSway(panel, top, end, SWAY * sway));
    for (const edge of [-1, 1]) trims.push(piping(drapeEdge(rings, sq, () => centre + edge * (END_HALF - 0.035), 0.005), BORDER));
    trims.push(piping(ringPoints(lift(rings[rings.length - 2], 0.005), sq, centre - END_HALF + 0.03, centre + END_HALF - 0.03, 16), BORDER));
    const crossRing = rings[Math.round(RINGS * 0.78)];
    trims.push(cross(lift(crossRing, 0.007), centre, sq, (END_HALF * crossRing.rx) * 1.0));
    trims.push(fringe(foot, centre, sq));
  }
  add(pushOut(merged(trims), shape, EASE * 0.8), gold, 'stole-embroidery');

  return {
    group,
    update(frame: PartFrame) {
      for (const s of sways) s(frame);
    },
    dispose: () => disposeTree(group),
  };
}

/** A ring pushed `by` further out. */
function lift(ring: GarmentRing, by: number): GarmentRing {
  return { y: ring.y, rx: ring.rx + by, rz: ring.rz + by };
}

/** A small embroidered cross on `ring` at `angle`, `size` tall, lying on the cloth. */
function cross(ring: GarmentRing, angle: number, sq: number, size: number): BufferGeometry {
  const [x, z] = crossSection(angle, ring.rx, ring.rz, sq);
  // Facing straight out of the cloth: the ellipse's own normal there.
  const turn = Math.atan2(x / ring.rx ** 2, z / ring.rz ** 2);
  const t = size * 0.13;
  return merged([new BoxGeometry(t, size, t * 0.6), new BoxGeometry(size * 0.62, t, t * 0.6).translate(0, size * 0.18, 0)]).rotateY(turn).translate(x, ring.y, z);
}

/** A gold fringe along the foot of an end: short threads hanging below it. */
function fringe(foot: GarmentRing, centre: number, sq: number): BufferGeometry {
  return merged(Array.from({ length: FRINGE }, (_, k) => {
    const a = centre - END_HALF + 0.015 + ((2 * END_HALF - 0.03) * k) / (FRINGE - 1);
    const [x, z] = crossSection(a, foot.rx + 0.004, foot.rz + 0.004, sq);
    const length = 0.06 + 0.012 * Math.sin(k * 1.7);
    return new CylinderGeometry(0.0035, 0.0025, length, 4).translate(x, foot.y - length / 2, z);
  }));
}
