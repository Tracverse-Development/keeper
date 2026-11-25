/**
 * The Ark Jacket (slot `torso`, any species with a torso): a soft open jacket cut to the body.
 *
 * Pattern: Adapter. It never asks which species it is on: it reads the torso's published shape
 * (`fit.ts`) and builds itself to it. The neckline sits where the body has opened out to
 * NECKLINE of its widest; the shell follows the body's own rings down to the shape's reach with
 * EASE all round (a little more at the hem, which flares); the front stays open (OPENING), so
 * the robot's heart-light and the puppy's bib and tag still show; a stand-up collar flares at the
 * top; gold piping runs round the collar, down both front edges and along the hem. Wherever the
 * shape lists limbs (the puppy's front legs) a sleeve with a piped cuff wraps each one; a body
 * with no arms (the robot's spirit) simply gets none.
 *
 * Effects: `color` (the cloth), `trim` (the piping and cuffs), `sway` (how much the hem moves).
 * The hem sways softly with the breath and a little more with work, the lower rings more than
 * the upper (the cloth hangs from the shoulders), always outward of the rest pose.
 */
import { CylinderGeometry, Group, Mesh, TorusGeometry, type BufferAttribute } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { garmentRings, radiusAt, widestBetween, type BodyShape, type GarmentRing, type Limb, type PartFit } from '../fit.ts';
import { edgePoints, fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartFrame, PartInstance } from '../part';

/** The neckline sits where the body has opened out to this share of its widest. */
const NECKLINE = 0.62;
/** Cloth stands this far off the body; the hem flares this much more. */
const EASE = 0.045;
const HEM_FLARE = 0.025;
/** The front gap (radians, total) and the collar's height and flare. */
const OPENING = 0.95;
const COLLAR_HEIGHT = 0.085;
const COLLAR_FLARE = 0.035;
const RINGS = 22;
const SEGMENTS = 56;
const PIPING = 0.011;
/** Sleeves cover this share of a limb, and stand this far off it. */
const SLEEVE_SHARE = 0.42;
const SLEEVE_EASE = 0.035;
/** Hem sway at full `sway` (world units) and how much more at full work. */
const SWAY = 0.014;
const WORK_SWAY = 0.8;

export function createArkJacket(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'ark-jacket';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const cloth = clothMaterial(effectColour(effects, 'color'));
  const trim = trimMaterial(effectColour(effects, 'trim'));
  const sway = effectNumber(effects, 'sway');

  const top = necklineOf(shape);
  const rings = jacketRings(shape, top);
  const shellGeometry = fittedShell(rings, { segments: SEGMENTS, opening: OPENING, squareness: shape.squareness });
  const shell = new Mesh(shellGeometry, cloth);
  shell.name = 'jacket-shell';
  const collarRings: GarmentRing[] = [0, 1, 2, 3].map((i) => ({
    y: top + (COLLAR_HEIGHT * i) / 3,
    rx: rings[0].rx + (COLLAR_FLARE * i) / 3,
    rz: rings[0].rz + (COLLAR_FLARE * i) / 3,
  }));
  const collar = new Mesh(fittedShell(collarRings, { segments: SEGMENTS, opening: OPENING, squareness: shape.squareness }), cloth);
  collar.name = 'jacket-collar';
  group.add(shell, collar);

  const right = OPENING / 2;
  const left = Math.PI * 2 - OPENING / 2;
  // Down each front edge: the collar's rings (top first) then the shell's (no repeated ring).
  const edge = [...collarRings].reverse().slice(0, -1).concat(rings);
  const edges = [
    piping(ringPoints(collarRings[3], shape.squareness, right, left, 48), PIPING),
    piping(ringPoints(rings[rings.length - 1], shape.squareness, right, left, 48), PIPING),
    piping(edgePoints(edge, shape.squareness, right), PIPING),
    piping(edgePoints(edge, shape.squareness, left), PIPING),
  ];
  for (const geometry of edges) group.add(Object.assign(new Mesh(geometry, trim), { name: 'jacket-piping' }));
  for (const limb of shape.limbs ?? []) group.add(buildSleeve(limb, cloth, trim));

  const positions = shellGeometry.getAttribute('position') as BufferAttribute;
  const rest = Float32Array.from(positions.array as Float32Array);
  const bottom = rings[rings.length - 1].y;

  function update(frame: PartFrame): void {
    const { amplitude, speed } = frame.motion;
    const t = frame.time * speed;
    const reach = SWAY * sway * amplitude * (1 + WORK_SWAY * frame.work);
    if (reach <= 0) return;
    const array = positions.array as Float32Array;
    for (let k = 0; k < array.length; k += 3) {
      const x = rest[k];
      const y = rest[k + 1];
      const z = rest[k + 2];
      const hang = ((top - y) / (top - bottom)) ** 2; // 0 at the shoulders, 1 at the hem
      // Outward only (a breath of air under the cloth), so it never sinks into the body.
      const push = 1 + (reach * hang * (0.6 + 0.4 * Math.sin(t * 1.4 + y * 4 + Math.atan2(x, z) * 2))) / Math.max(Math.hypot(x, z), 0.1);
      array[k] = x * push;
      array[k + 2] = z * push;
    }
    positions.needsUpdate = true;
  }

  return { group, update, dispose: () => disposeTree(group) };
}

/** The neckline height: the first height (from the top) where the body reaches NECKLINE of its widest. */
export function necklineOf(shape: BodyShape): number {
  const crown = shape.profile[0][1];
  const widest = widestBetween(shape, crown, shape.reach);
  for (let i = 0; i <= 80; i++) {
    const y = crown + ((shape.reach - crown) * i) / 80;
    if (radiusAt(shape, y) >= widest * NECKLINE) return y;
  }
  return crown;
}

/** The jacket's rings: the body's own, eased, with the hem flaring out. */
function jacketRings(shape: BodyShape, top: number): GarmentRing[] {
  return garmentRings(shape, top, shape.reach, EASE, RINGS).map((ring, i) => {
    const flare = HEM_FLARE * (i / (RINGS - 1)) ** 3;
    return { y: ring.y, rx: ring.rx + flare, rz: ring.rz + flare };
  });
}

/** A sleeve round the top of `limb`, ending in a piped cuff, tilted as the limb is. */
function buildSleeve(limb: Limb, cloth: ReturnType<typeof clothMaterial>, trim: ReturnType<typeof trimMaterial>): Group {
  const sleeve = new Group();
  sleeve.name = 'sleeve';
  sleeve.position.set(...limb.position);
  sleeve.rotation.x = limb.tilt;
  const radius = limb.radius + SLEEVE_EASE;
  const height = limb.length * SLEEVE_SHARE;
  // The limb's rounded top is half a radius tall; the sleeve starts just below it.
  const tube = new Mesh(new CylinderGeometry(radius * 0.98, radius * 1.04, height, 32, 4, true), cloth);
  tube.position.y = -limb.radius * 0.5 - height / 2;
  const cuff = new Mesh(new TorusGeometry(radius * 1.04, PIPING * 1.6, 8, 40), trim);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -limb.radius * 0.5 - height;
  sleeve.add(tube, cuff);
  return sleeve;
}
