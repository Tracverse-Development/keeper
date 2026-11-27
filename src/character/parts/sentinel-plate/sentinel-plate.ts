/**
 * The Sentinel Plate (slot `torso`, any species with a torso; the robot's Ark Sentinel set):
 * enamelled armour. A breastplate with a raised keel down the middle and gilt lines either side of
 * it; a two-lame gorget round the neck; below the breastplate three lames that each step out over
 * the next, gilt at the edge and riveted at the sides; a pauldron of three layered domes on each
 * shoulder, gilt-edged and riveted; and on the chest the ark and its waves in light inside a gilt
 * shield frame, breathing brighter as the keeper works.
 *
 * Pattern: Adapter: it reads the torso's published shape (`fit.ts`), never the species, so the
 * robot's tapering spirit, a person's chest and the dog's pear each get plate of their own shape;
 * every piece is laid on or pushed clear of the body (`onSurface`, `pushOut`).
 *
 * Effects: `color` (the enamel), `trim` (the gilt), `light` (the crest) and `glow` (its strength).
 */
import { CatmullRomCurve3, Color, Group, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, radiusAt, type GarmentRing, type PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import { outward, pushOut } from '../garment.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';
import { necklineOf } from '../jacket/jacket.ts';
import { closed, onSurface, taperedShell } from '../top/top-shell.ts';
import { drapeEdge } from '../drape.ts';
import { keepColour, meshAdder, merged } from '../detail-kit.ts';
import { arkMark, shieldOutline } from '../ark-emblem.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.07;
const RINGS = 22;
const SEGMENTS = 84;
/** The breastplate ends this far down (share of neckline to reach); the lames share the rest. */
const BREAST = 0.6;
const LAMES = 3;
const LAME_STEP = 0.013;
const GILT = 0.01;
const RIVET = 0.012;
/** The pauldrons: their height on the torso (share of the way down) and size (share of the body's half-width). */
const PAULDRON_AT = 0.1;
const PAULDRON_SIZE = 0.42;

export function createSentinelPlate(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'sentinel-plate';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const enamelColour = new Color(effectColour(effects, 'color'));
  const enamel = keepColour(new MeshPhysicalMaterial({ color: enamelColour, metalness: 0.3, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.6 }));
  const enamelDark = keepColour(new MeshPhysicalMaterial({ color: enamelColour.clone().multiplyScalar(0.7), metalness: 0.35, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.6 }));
  const gilt = metalMaterial(effectColour(effects, 'trim'), 0.22, 0.06);
  const glow = effectNumber(effects, 'glow');
  const light = lightMaterial(effectColour(effects, 'light'), 1.5 * glow);
  const add = meshAdder(group);
  const sq = shape.squareness;

  const top = necklineOf(shape);
  const breastEnd = top + (shape.reach - top) * BREAST;
  const rings = garmentRings(shape, top, breastEnd, EASE, RINGS);
  add(taperedShell(rings, closed, SEGMENTS, sq), enamel, 'plate-breast');
  // The keel down the middle, gilt lines either side, gilt round the neck and the lower edge.
  add(pushOut(piping(drapeEdge(rings, sq, () => 0, 0.004), 0.016), shape, EASE), enamel, 'plate-keel');
  const lines: BufferGeometry[] = [];
  for (const a of [0.16, -0.16]) lines.push(piping(drapeEdge(rings.slice(1, -1), sq, () => a, 0.004), GILT * 0.6));
  lines.push(piping(ringPoints(lift(rings[0], 0.004), sq, 0, Math.PI * 2, 96), GILT * 1.2, true));
  lines.push(piping(ringPoints(lift(rings[rings.length - 1], 0.004), sq, 0, Math.PI * 2, 96), GILT, true));

  // The gorget: two short lames rising round the neck.
  for (let k = 0; k < 2; k++) {
    const gorget: GarmentRing[] = [0, 1, 2].map((i) => ({ y: top + 0.03 * k + (0.05 * i) / 2, rx: rings[0].rx + 0.008 - 0.012 * k - 0.004 * i, rz: rings[0].rz + 0.008 - 0.012 * k - 0.004 * i }));
    add(taperedShell(gorget.reverse(), closed, SEGMENTS, sq), k ? enamel : enamelDark, 'plate-gorget');
    lines.push(piping(ringPoints(lift(gorget[0], 0.003), sq, 0, Math.PI * 2, 96), GILT * 0.7, true));
  }

  // The lames below the breastplate, each a little further out than the one above.
  const rivets: BufferGeometry[] = [];
  const lameHeight = (breastEnd - shape.reach) / LAMES;
  for (let k = 0; k < LAMES; k++) {
    const from = breastEnd - lameHeight * k + lameHeight * 0.18;
    const lame = garmentRings(shape, from, from - lameHeight * 1.12, EASE + LAME_STEP * (k + 1), 5);
    add(taperedShell(lame, closed, SEGMENTS, sq), k % 2 ? enamelDark : enamel, 'plate-lame');
    const edge = lame[lame.length - 1];
    lines.push(piping(ringPoints(lift(edge, 0.003), sq, 0, Math.PI * 2, 96), GILT, true));
    for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5]) {
      const p = onRing(lame[2], a, sq, 0.006);
      rivets.push(new SphereGeometry(RIVET, 10, 8).translate(p.x, p.y, p.z));
    }
  }
  add(pushOut(merged(lines), shape, EASE), gilt, 'plate-gilt');

  // A pauldron of three layered domes on each shoulder.
  const shoulderY = top + (shape.reach - top) * PAULDRON_AT;
  const width = radiusAt(shape, shoulderY);
  const size = Math.max(width * PAULDRON_SIZE, 0.12);
  for (const side of [-1, 1]) {
    const base = onRing(lift({ y: shoulderY, rx: width, rz: width * shape.depth }, EASE), side * (Math.PI / 2 - 0.05), sq, 0);
    const n = outward(shape, base.x, base.z);
    for (let k = 0; k < 3; k++) {
      const r = size * (1 - k * 0.16);
      const centre = base.clone().addScaledVector(n, -r * 0.35 + k * 0.012).add(new Vector3(0, -k * size * 0.34, 0));
      const dome = new SphereGeometry(r, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.42).rotateZ(-side * 0.75).translate(centre.x, centre.y, centre.z);
      add(onSurface(dome, shape, EASE + 0.01 + k * 0.012), k === 1 ? enamelDark : enamel, 'plate-pauldron');
      const rim = new TorusGeometry(r * Math.sin(Math.PI * 0.42), GILT * 0.9, 8, 48).rotateX(Math.PI / 2).translate(0, r * Math.cos(Math.PI * 0.42), 0).rotateZ(-side * 0.75).translate(centre.x, centre.y, centre.z);
      add(onSurface(rim, shape, EASE + 0.01 + k * 0.012), gilt, 'plate-pauldron-gilt');
    }
    const stud = base.clone().addScaledVector(n, size * 0.68).add(new Vector3(0, size * 0.25, 0));
    rivets.push(new SphereGeometry(RIVET * 1.3, 10, 8).translate(stud.x, stud.y, stud.z));
  }
  add(pushOut(merged(rivets), shape, EASE + 0.01), gilt, 'plate-rivets');

  // The crest: a gilt shield frame on the chest with the ark and its waves in light.
  const crestRing = rings[Math.round(RINGS * 0.42)];
  const crestSize = Math.min(crestRing.rx * 0.36, (top - breastEnd) * 0.32);
  const centre = onRing(crestRing, 0, sq, 0.018);
  const frame = shieldOutline(crestSize * 1.6, crestSize * 2, crestSize * 0.12, 0.7);
  add(onSurface(new TubeGeometry(new CatmullRomCurve3(frame, true), 96, GILT * 1.1, 8, true).translate(centre.x, centre.y, centre.z), shape, EASE + 0.012), gilt, 'plate-crest-frame');
  add(onSurface(arkMark(crestSize).translate(centre.x, centre.y - crestSize * 0.05, centre.z + 0.004), shape, EASE + 0.016), light, 'plate-crest');

  return {
    group,
    update(frame: PartFrame) {
      light.opacity = Math.min(0.62 + 0.25 * Math.sin(frame.time * 1.8) + 0.3 * frame.work + 0.4 * frame.gotIt, 1);
    },
    dispose: () => disposeTree(group),
  };
}

function lift(ring: GarmentRing, by: number): GarmentRing {
  return { y: ring.y, rx: ring.rx + by, rz: ring.rz + by };
}

/** The point on `ring` at `angle` (0 = front), `out` further off it. */
function onRing(ring: GarmentRing, angle: number, sq: number, out: number): Vector3 {
  const [x, z] = crossSection(angle, ring.rx + out, ring.rz + out, sq);
  return new Vector3(x, ring.y, z);
}
