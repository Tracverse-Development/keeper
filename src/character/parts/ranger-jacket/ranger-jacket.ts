/**
 * The Ranger Jacket (slot `torso`, any species with a torso): a heavy worn-leather jacket, built
 * for close looks. Open at the front with rolled leather edges and a stand collar; a hood laid
 * back behind the neck (its roll round the collar, its pouch on the upper back); long sleeves with
 * dark cuffs and two steel arm bands wherever the body has limbs; saddle stitching down both front
 * edges and round the hem; rivets beside the stitching; a stitched patch on the shoulder with a
 * glowing mark; two dark belts buckled over it, each with a steel frame buckle, a prong and brass
 * keepers.
 *
 * Pattern: Adapter (like the Ark Jacket): it reads the torso's published shape (`fit.ts`), never
 * the species, and every detail is laid on the jacket's own surface and kept clear of the body.
 * The leather is drawn by `leather.ts` (grain, fading, scuffs). Effects: `color` (the leather),
 * `trim` (steel hardware), `light` (the mark's glow) with `glow` (its strength), `wear` (how
 * travelled the leather looks).
 */
import { BoxGeometry, Color, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, radiusAt, type BodyShape, type GarmentRing, type PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, outward, pushOut } from '../garment.ts';
import { lightMaterial, metalMaterial } from '../glow-kit.ts';
import { necklineOf } from '../jacket/jacket.ts';
import { leatherMaterial } from '../leather.ts';
import { followLimbs } from '../limb-follow.ts';
import type { PartFrame, PartInstance } from '../part';
import { frontEdges, onSurface, sleeveGeometry, straight, taperedShell } from '../top/top-shell.ts';

/** Thick leather stands well off the body (and clears a furred coat); the hem flares a little. */
const EASE = 0.088;
const HEM_FLARE = 0.03;
const RINGS = 26;
const SEGMENTS = 72;
/** The front gap (radians, total) and the rolled edge's radius. */
const OPENING = 0.95;
const EDGE = 0.02;
const COLLAR_HEIGHT = 0.1;
const HOOD_ROLL = 0.075;
/** Stitches sit this far in from an edge (radians round the body) and stand this far off the leather. */
const STITCH_INSET = 0.1;
const STITCH_LIFT = 0.006;
const STITCH: readonly [number, number] = [0.008, 0.004];
const RIVET = 0.013;
const SWAY = 0.008;
/** The two belts, as shares of the way from the neckline to the hem, and the strap's half-height. */
const BELTS: readonly number[] = [0.6, 0.83];
const STRAP = 0.032;
const THREAD = 0xe8dcc0;
const BRASS = 0xc9953c;

export function createRangerJacket(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'ranger-jacket';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const colour = effectColour(effects, 'color');
  const wear = effectNumber(effects, 'wear');
  const glow = effectNumber(effects, 'glow');
  const leather = leatherMaterial(colour, wear);
  const dark = leatherMaterial(new Color(colour).multiplyScalar(0.42).getHex(), wear);
  const steel = metalMaterial(effectColour(effects, 'trim'), 0.3, 0.02);
  const brass = metalMaterial(BRASS, 0.3, 0.02);
  const thread = new MeshStandardMaterial({ color: THREAD, roughness: 0.8 });
  const light = lightMaterial(effectColour(effects, 'light'), 1.6 * glow);
  const add = (geometry: BufferGeometry, material: Material, name: string): Mesh => {
    const mesh = Object.assign(new Mesh(geometry, material), { name });
    group.add(mesh);
    return mesh;
  };

  const top = necklineOf(shape);
  const rings = garmentRings(shape, top, shape.reach, EASE, RINGS).map((ring, i) => {
    const flare = HEM_FLARE * (i / (RINGS - 1)) ** 3;
    return { y: ring.y, rx: ring.rx + flare, rz: ring.rz + flare };
  });
  const sq = shape.squareness;
  const shell = taperedShell(rings, straight(OPENING), SEGMENTS, sq);
  add(shell, leather, 'ranger-shell');

  // Rolled edges: down both fronts and round the hem.
  const [left, right] = frontEdges(rings, straight(OPENING), sq);
  const hem = rings[rings.length - 1];
  for (const edge of [left, right]) add(piping(edge, EDGE), leather, 'ranger-edge');
  add(piping(ringPoints(hem, sq, OPENING / 2, Math.PI * 2 - OPENING / 2, 72), EDGE * 0.8), leather, 'ranger-edge');

  // A stand collar, then the hood: its roll round the back of the collar and its pouch on the back.
  const collar: GarmentRing[] = [0, 1, 2, 3].map((i) => ({ y: top + (COLLAR_HEIGHT * i) / 3, rx: rings[0].rx + 0.012 * i, rz: rings[0].rz + 0.012 * i }));
  add(taperedShell(collar, straight(OPENING * 1.25), SEGMENTS, sq), leather, 'ranger-collar');
  const roll: GarmentRing = { y: top + COLLAR_HEIGHT * 0.55, rx: rings[0].rx + HOOD_ROLL * 0.9, rz: rings[0].rz + HOOD_ROLL * 0.9 };
  add(piping(ringPoints(roll, sq, 1.15, Math.PI * 2 - 1.15, 56), HOOD_ROLL), leather, 'ranger-hood');
  const pouch = new SphereGeometry(1, 36, 24);
  const back = rings[Math.round(RINGS * 0.22)];
  pouch.scale(back.rx * 0.82, (top - back.y) * 1.25, 0.12);
  pouch.translate(0, back.y + (top - back.y) * 0.3, -(back.rz + 0.07));
  add(pushOut(pouch, shape, EASE * 0.6), leather, 'ranger-hood');

  // Sleeves with dark cuffs and two steel arm bands, wherever the body has limbs.
  for (const limb of shape.limbs ?? []) {
    const { tube, cuff } = sleeveGeometry(limb, { share: 0.78, flare: 0.05, cuff: 2.6 }, shape, 0.011);
    add(tube, leather, 'ranger-sleeve');
    if (cuff) add(cuff, dark, 'ranger-cuff');
    for (const share of [0.46, 0.58]) {
      const band = sleeveGeometry(limb, { share, flare: 0.07, cuff: 1.7 }, shape, 0.011);
      band.tube.dispose();
      if (band.cuff) add(band.cuff, steel, 'ranger-arm-band');
    }
  }

  add(stitching(rings, hem, sq), thread, 'ranger-stitching');
  add(rivets(rings, sq), brass, 'ranger-rivets');
  shoulderPatch(shape, rings, top, add, dark, thread, light);
  for (const share of BELTS) belt(shape, top + (shape.reach - top) * share, sq, add, dark, steel, brass);

  const sway = garmentSway(shell, top, hem.y, SWAY);
  const followSleeves = followLimbs(group, shape, fit);
  function update(frame: PartFrame): void {
    sway(frame);
    followSleeves();
    light.opacity = 0.7 + 0.3 * Math.sin(frame.time * 2.3) * (0.5 + 0.5 * (frame.mood.presence ?? 1));
  }
  return { group, update, dispose: () => disposeTree(group) };
}

/** A point on a ring at `angle`, `lift` off the leather. */
function at(ring: GarmentRing, sq: number, angle: number, lift: number): Vector3 {
  const [x, z] = crossSection(angle, ring.rx + lift, ring.rz + lift, sq);
  return new Vector3(x, ring.y, z);
}

/** A box lying from `a` to `b` (a stitch, a bar), `share` of the gap long. */
function dash(a: Vector3, b: Vector3, share: number, [width, depth]: readonly [number, number]): BufferGeometry {
  const span = b.clone().sub(a);
  const box = new BoxGeometry(width, span.length() * share, depth);
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), span.clone().normalize());
  return box.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), turn, new Vector3(1, 1, 1)));
}

/** Saddle stitching: a dashed line just inside each front edge, and one round the hem. */
function stitching(rings: readonly GarmentRing[], hem: GarmentRing, sq: number): BufferGeometry {
  const dashes: BufferGeometry[] = [];
  for (const angle of [OPENING / 2 + STITCH_INSET, Math.PI * 2 - OPENING / 2 - STITCH_INSET]) {
    for (let i = 0; i < rings.length - 1; i++) {
      const a = at(rings[i], sq, angle, STITCH_LIFT);
      const b = at(rings[i + 1], sq, angle, STITCH_LIFT);
      const mid = a.clone().lerp(b, 0.5);
      dashes.push(dash(a, mid, 0.62, STITCH), dash(mid, b, 0.62, STITCH));
    }
  }
  const above: GarmentRing = { y: hem.y + 0.035, rx: hem.rx - 0.004, rz: hem.rz - 0.004 };
  const COUNT = 84;
  const span = Math.PI * 2 - OPENING - 2 * STITCH_INSET;
  for (let k = 0; k < COUNT; k++) {
    const a0 = OPENING / 2 + STITCH_INSET + (span * k) / COUNT;
    dashes.push(dash(at(above, sq, a0, STITCH_LIFT + 0.004), at(above, sq, a0 + span / COUNT, STITCH_LIFT + 0.004), 0.6, STITCH));
  }
  return merged(dashes);
}

/** Dome rivets beside the stitching, every few rings. */
function rivets(rings: readonly GarmentRing[], sq: number): BufferGeometry {
  const domes: BufferGeometry[] = [];
  for (const angle of [OPENING / 2 + STITCH_INSET * 2.1, Math.PI * 2 - OPENING / 2 - STITCH_INSET * 2.1]) {
    for (let i = 2; i < rings.length - 1; i += 4) {
      const p = at(rings[i], sq, angle, RIVET * 0.3);
      domes.push(new SphereGeometry(RIVET, 14, 10).translate(p.x, p.y, p.z));
    }
  }
  return merged(domes);
}

type Add = (geometry: BufferGeometry, material: Material, name: string) => Mesh;

/** A stitched patch high on the wearer's left shoulder, with a glowing ring-and-bar mark. */
function shoulderPatch(shape: BodyShape, rings: readonly GarmentRing[], top: number, add: Add, dark: Material, thread: Material, light: Material): void {
  const ring = rings[Math.round(RINGS * 0.4)];
  const angle = 1.02;
  const centre = at(ring, shape.squareness, angle, 0.012);
  const place = (g: BufferGeometry, lift: number): BufferGeometry => {
    const n = outward(shape, centre.x, centre.z);
    return onSurface(g.rotateY(angle).translate(centre.x + n.x * lift, centre.y, centre.z + n.z * lift), shape, EASE + lift);
  };
  const [w, h] = [0.17, Math.min(0.2, (top - shape.reach) * 0.32)];
  add(place(new BoxGeometry(w, h, 0.014), 0), dark, 'ranger-patch');
  const border: BufferGeometry[] = [];
  const corners = [new Vector3(-w / 2, -h / 2, 0), new Vector3(w / 2, -h / 2, 0), new Vector3(w / 2, h / 2, 0), new Vector3(-w / 2, h / 2, 0)].map((c) => c.multiplyScalar(0.84));
  corners.forEach((c, i) => {
    const next = corners[(i + 1) % 4];
    for (let k = 0; k < 6; k++) border.push(dash(c.clone().lerp(next, k / 6), c.clone().lerp(next, (k + 1) / 6), 0.6, [0.006, 0.004]));
  });
  add(place(merged(border), 0.01), thread, 'ranger-patch-stitching');
  const mark = merged([new TorusGeometry(Math.min(w, h) * 0.26, 0.006, 8, 40), new BoxGeometry(0.008, Math.min(w, h) * 0.34, 0.006), new BoxGeometry(Math.min(w, h) * 0.2, 0.008, 0.006).translate(0, -Math.min(w, h) * 0.06, 0)]);
  add(place(mark, 0.016), light, 'ranger-mark');
}

/** A belt buckled over the jacket at height `y`: the strap, a frame buckle with its prong, brass keepers. */
function belt(shape: BodyShape, y: number, sq: number, add: Add, dark: Material, steel: Material, brass: Material): void {
  const lift = EASE + HEM_FLARE + 0.014;
  const strap: GarmentRing[] = [-1, 0, 1].map((k) => {
    const r = Math.max(radiusAt(shape, y + k * STRAP), radiusAt(shape, y));
    return { y: y + k * STRAP, rx: r + lift + (k === 0 ? 0.006 : 0), rz: r * shape.depth + lift + (k === 0 ? 0.006 : 0) };
  });
  add(fittedShell(strap, { segments: 96, opening: 0, squareness: sq }), dark, 'ranger-belt');
  const front = at(strap[1], sq, 0, 0.012);
  const put = (g: BufferGeometry, x: number, lift2: number): BufferGeometry => onSurface(g.translate(front.x + x, y, front.z + lift2), shape, lift + 0.01);
  const frame = merged([
    new BoxGeometry(0.15, 0.016, 0.02).translate(0, STRAP * 1.35, 0),
    new BoxGeometry(0.15, 0.016, 0.02).translate(0, -STRAP * 1.35, 0),
    new BoxGeometry(0.016, STRAP * 2.7 + 0.016, 0.02).translate(-0.067, 0, 0),
    new BoxGeometry(0.016, STRAP * 2.7 + 0.016, 0.02).translate(0.067, 0, 0),
    new BoxGeometry(0.09, 0.01, 0.014).translate(-0.022, 0, 0.009),
  ]);
  add(put(frame, 0, 0.012), steel, 'ranger-buckle');
  for (const angle of [-0.42, 0.42, -0.2 + Math.PI, 0.2 + Math.PI]) {
    const p = at(strap[1], sq, angle, 0.006);
    add(onSurface(new BoxGeometry(0.02, STRAP * 2.5, 0.014).rotateY(angle).translate(p.x, y, p.z), shape, lift + 0.004), brass, 'ranger-keeper');
  }
}

/** Several pieces as one geometry (one draw). */
function merged(pieces: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  return out;
}
