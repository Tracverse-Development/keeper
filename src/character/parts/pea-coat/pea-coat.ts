/**
 * The Pea Coat (slot `torso`, any species with a torso; the dog's Harbour Watch set): a heavy wool
 * sailor's coat. Closed and double-breasted: the right front laps over the left with a stitched
 * edge; broad lapels fold back below a stand collar with a notch between them; two rows of three
 * domed anchor buttons; slanted welt pockets with flaps at the hips; long sleeves with turned cuffs
 * and two small buttons wherever the body has limbs; at the back a half-belt with a button at each
 * end over a centre vent. The hem breathes out a little as the keeper moves.
 *
 * Pattern: Adapter (like the Ark Jacket and the Ranger Jacket): it reads the torso's published shape
 * (`fit.ts`), never the species; every detail is laid on the coat's own surface (`onSurface`,
 * `pushOut`) so nothing sinks into the body, and sleeves ride the arms (`limb-follow.ts`).
 *
 * Effects: `color` (the wool), `trim` (the buttons' metal) and `sway` (how much the hem moves).
 */
import { BoxGeometry, Color, CylinderGeometry, Group, Matrix4, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, type BodyShape, type GarmentRing, type PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, outward, pushOut } from '../garment.ts';
import { metalMaterial } from '../glow-kit.ts';
import { necklineOf } from '../jacket/jacket.ts';
import { followLimbs } from '../limb-follow.ts';
import { closed, onSurface, sleeveGeometry, straight, taperedShell } from '../top/top-shell.ts';
import { bandPatch, drapeEdge } from '../drape.ts';
import { dash, keepColour, meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

/** Thick wool stands well off the body; the hem flares a little. */
const EASE = 0.064;
const HEM_FLARE = 0.035;
const RINGS = 26;
const SEGMENTS = 80;
/** Where the overlapping front's edge runs (radians toward the wearer's left), and its lift. */
const LAP_EDGE = 0.34;
const LAP_FROM = -0.5;
const LAP_LIFT = 0.012;
/** The lapels: how far down they reach (share of neckline to hem) and their lift off the coat. */
const LAPEL_DROP = 0.36;
const LAPEL_LIFT = 0.02;
const COLLAR_HEIGHT = 0.09;
/** Buttons: the two rows' angles round the overlap's centre, three rows down, their size. */
const BUTTON_ROWS: readonly number[] = [0.4, 0.56, 0.72];
const BUTTON_SPREAD = 0.36;
const BUTTON = 0.036;
const SWAY = 0.012;

export function createPeaCoat(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'pea-coat';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const colour = new Color(effectColour(effects, 'color'));
  const wool = keepColour(clothMaterial(colour.getHex(), 0.93));
  const felt = keepColour(clothMaterial(colour.clone().multiplyScalar(0.72).getHex(), 0.95));
  const thread = clothMaterial(colour.clone().lerp(new Color(0xffffff), 0.18).getHex(), 0.9);
  const metal = metalMaterial(effectColour(effects, 'trim'), 0.26, 0.05);
  const add = meshAdder(group);
  const sq = shape.squareness;

  const top = necklineOf(shape);
  const rings = garmentRings(shape, top, shape.reach, EASE, RINGS).map((ring, i) => {
    const flare = HEM_FLARE * (i / (RINGS - 1)) ** 3;
    return { y: ring.y, rx: ring.rx + flare, rz: ring.rz + flare };
  });
  const hem = rings[rings.length - 1];
  const at = (share: number) => Math.min(Math.round(share * (RINGS - 1)), RINGS - 1);
  const shell = taperedShell(rings, closed, SEGMENTS, sq);
  add(shell, wool, 'pea-shell');

  // The right front lapping over the left, from below the lapels to the hem, its edge stitched.
  const lapelEnd = at(LAPEL_DROP);
  const lapRings = rings.slice(lapelEnd).map((r) => lifted(r, LAP_LIFT));
  add(pushOut(bandPatch(lapRings, sq, () => LAP_FROM, () => LAP_EDGE, 24), shape, EASE), wool, 'pea-lap');
  add(pushOut(piping(drapeEdge(lapRings, sq, () => LAP_EDGE, 0.002), 0.011), shape, EASE), felt, 'pea-edge');
  const stitches: BufferGeometry[] = [];
  const seam = drapeEdge(lapRings, sq, () => LAP_EDGE - 0.07, 0.004);
  for (let i = 0; i < seam.length - 1; i++) stitches.push(dash(seam[i], seam[i + 1], 0.55, 0.006, 0.004));

  // The stand collar, and broad lapels folded back below it (a notch between the two).
  const collar: GarmentRing[] = [0, 1, 2, 3].map((i) => ({ y: top + (COLLAR_HEIGHT * i) / 3, rx: rings[0].rx + 0.01 + 0.008 * i, rz: rings[0].rz + 0.01 + 0.008 * i }));
  add(taperedShell(collar, straight(0.75), SEGMENTS, sq), wool, 'pea-collar');
  add(piping(ringPoints(collar[3], sq, 0.375, Math.PI * 2 - 0.375, 64), 0.012), felt, 'pea-collar-edge');
  const lapelRings = rings.slice(0, lapelEnd + 1).map((r) => lifted(r, LAPEL_LIFT));
  const last = lapelRings.length - 1;
  const inner = (i: number) => 0.42 * (1 - i / last) + LAP_EDGE * 0.55 * (i / last);
  const outer = (i: number) => inner(i) + 0.72 * (1 - i / last) ** 0.9 + 0.04;
  for (const side of [1, -1]) {
    const from = (i: number) => (side > 0 ? inner(i) : Math.PI * 2 - outer(i));
    const to = (i: number) => (side > 0 ? outer(i) : Math.PI * 2 - inner(i));
    add(pushOut(bandPatch(lapelRings, sq, from, to, 16), shape, EASE + 0.008), wool, 'pea-lapel');
    const edge = (i: number) => (side > 0 ? outer(i) : Math.PI * 2 - outer(i));
    add(pushOut(piping(drapeEdge(lapelRings, sq, edge, 0.003), 0.01), shape, EASE + 0.008), felt, 'pea-lapel-edge');
    const row = drapeEdge(lapelRings, sq, (i) => (side > 0 ? outer(i) - 0.06 : Math.PI * 2 - outer(i) + 0.06), 0.005);
    for (let i = 0; i < row.length - 1; i++) stitches.push(dash(row[i], row[i + 1], 0.55, 0.006, 0.004));
  }

  // Two rows of three anchor buttons over the lapped front.
  const middle = (LAP_FROM + LAP_EDGE) / 2;
  for (const share of BUTTON_ROWS) {
    const ring = rings[at(share)];
    for (const spread of [-BUTTON_SPREAD / 2, BUTTON_SPREAD / 2]) add(button(shape, ring, middle + spread, sq, BUTTON), metal, 'pea-button');
  }

  // Slanted welt pockets with flaps at the hips.
  const pocketRing = rings[at(0.78)];
  for (const side of [1, -1]) {
    const angle = side * 0.95;
    const [x, z] = crossSection(angle, pocketRing.rx + 0.01, pocketRing.rz + 0.01, sq);
    const n = outward(shape, x, z);
    const turn = Math.atan2(n.x, n.z);
    const flap = new BoxGeometry(0.17, 0.05, 0.016).rotateZ(side * 0.32).rotateY(turn).translate(x, pocketRing.y, z);
    add(onSurface(flap, shape, EASE + 0.008), wool, 'pea-pocket');
    const welt = new BoxGeometry(0.17, 0.012, 0.018).rotateZ(side * 0.32).rotateY(turn).translate(x, pocketRing.y + 0.026, z);
    add(onSurface(welt, shape, EASE + 0.012), felt, 'pea-pocket');
  }

  // The half-belt across the back, a button at each end, over a centre vent.
  const beltRing = rings[at(0.7)];
  const beltRings = [beltRing.y + 0.035, beltRing.y - 0.035].map((y) => lifted({ ...beltRing, y }, 0.012));
  add(pushOut(bandPatch(beltRings, sq, () => Math.PI - 0.7, () => Math.PI + 0.7, 24), shape, EASE + 0.006), wool, 'pea-belt');
  for (const a of [Math.PI - 0.62, Math.PI + 0.62]) add(button(shape, lifted(beltRing, 0.016), a, sq, BUTTON * 0.75), metal, 'pea-button');
  const vent = drapeEdge(rings.slice(at(0.74)), sq, () => Math.PI, 0.004);
  add(pushOut(piping(vent, 0.008), shape, EASE), felt, 'pea-vent');
  add(piping(ringPoints(lifted(hem, 0.002), sq, 0, Math.PI * 2, 96), 0.012, true), felt, 'pea-hem');
  add(pushOut(merged(stitches), shape, EASE), thread, 'pea-stitching');

  // Sleeves with turned cuffs and two cuff buttons, wherever the body has limbs.
  for (const limb of shape.limbs ?? []) {
    const { tube, cuff } = sleeveGeometry(limb, { share: 0.5, flare: 0.06, cuff: 3.2 }, shape, 0.011);
    add(tube, wool, 'pea-sleeve');
    if (cuff) {
      add(cuff, felt, 'pea-cuff');
      cuff.computeBoundingBox();
      const box = cuff.boundingBox!;
      const centre = box.getCenter(new Vector3());
      const side = Math.sign(limb.position[0]) || 1;
      for (const k of [0, 1]) {
        const b = new SphereGeometry(0.014, 10, 8).scale(1, 1, 0.5).translate(centre.x + side * (box.max.x - box.min.x) * 0.5, centre.y + 0.03 + k * 0.035, centre.z + 0.02);
        add(b, metal, 'pea-cuff-button');
      }
    }
  }

  const sway = garmentSway(shell, top, hem.y, SWAY * effectNumber(effects, 'sway'));
  const followSleeves = followLimbs(group, shape, fit);
  return {
    group,
    update(frame: PartFrame) {
      sway(frame);
      followSleeves();
    },
    dispose: () => disposeTree(group),
  };
}

/** A ring pushed `by` further out. */
function lifted(ring: GarmentRing, by: number): GarmentRing {
  return { y: ring.y, rx: ring.rx + by, rz: ring.rz + by };
}

/** A domed button with a raised rim and an anchor on it, facing out of the cloth at `angle` on `ring`. */
function button(shape: BodyShape, ring: GarmentRing, angle: number, sq: number, size: number): BufferGeometry {
  const [x, z] = crossSection(angle, ring.rx, ring.rz, sq);
  const n = outward(shape, x, z);
  const pieces = [
    new CylinderGeometry(size, size, size * 0.3, 24).rotateX(Math.PI / 2),
    new TorusGeometry(size * 0.92, size * 0.12, 8, 28).translate(0, 0, size * 0.16),
    // The anchor: shank, stock and the curved arms.
    new BoxGeometry(size * 0.12, size * 1.1, size * 0.1).translate(0, size * 0.02, size * 0.2),
    new BoxGeometry(size * 0.6, size * 0.1, size * 0.1).translate(0, size * 0.38, size * 0.2),
    new TorusGeometry(size * 0.42, size * 0.06, 6, 16, Math.PI).rotateZ(Math.PI).translate(0, -size * 0.1, size * 0.2),
  ];
  const turn = new Matrix4().makeRotationY(Math.atan2(n.x, n.z));
  return onSurface(merged(pieces).applyMatrix4(turn).translate(x, ring.y, z), shape, EASE + 0.012);
}

