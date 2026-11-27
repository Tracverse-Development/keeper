/**
 * Trousers (slot `legs`, any body that offers it: the man, the woman, the God Keeper): worn over the
 * hips and both legs, cut to the shape the body publishes.
 *
 * Pattern: Adapter. The part reads the legs shape (`fit.ts`): its rings are the hips (body space,
 * waist down) and its limbs are the legs. It never asks which species it is on. The SEAT follows the
 * hip rings with a little ease, but never narrower than the two legs side by side, so a narrow hip
 * and a flared skirt both get a seat that clears them (over the woman's skirt it reads as a flared,
 * belted culotte). Below the hips each leg gets a tube down to the shape's `reach` (the top of the
 * shoes). A body whose hips reach lower than the shoes (the God Keeper's robe) gets the seat alone.
 *
 * Styles (`style`, a whole number):
 *  0 straight jeans: belt line with a buckle, a front fly seam and outside-seam stitching in `trim`.
 *  1 chinos: slightly tapered, cut above the ankle with a rolled cuff in the cloth.
 *  2 cargo trousers: belt, and a flapped pocket on the side of each thigh (flaps piped in `trim`).
 *  3 wrap skirt: a flared skirt from the waist to the knee, its wrap edge running down the front
 *    and a tie bow at the side in `trim`.
 *
 * Effects: `color` (the cloth), `trim` (stitching, belt, flaps, the tie), `style`.
 */
import { BoxGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { profilePoint, radiusAt, type BodyShape, type GarmentRing, type Limb, type PartFit } from '../fit.ts';
import { edgePoints, fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartInstance } from '../part';

const STYLE = { jeans: 0, chinos: 1, cargo: 2, skirt: 3 } as const;
/** Cloth stands this far off the hips and the legs. */
const EASE = 0.03;
const LEG_EASE = 0.035;
const SEAT_RINGS = 18;
const SEGMENTS = 48;
const STITCH = 0.006;
const BELT = 0.018;
/** Chinos stop this far above the shoes and taper to this share of the thigh at the hem. */
const CHINO_SHORT = 0.05;
const CHINO_TAPER = 0.86;
const CUFF = 0.022;
/** The skirt ends this far down the leg (share of the leg) and flares this much at the hem. */
const SKIRT_KNEE = 0.45;
const SKIRT_FLARE = 0.05;
/** The skirt always reaches at least this far below the hips. */
const SKIRT_BELOW_HIPS = 0.14;

export function createTrousers(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'trousers';
  const shape = fit.shape;
  const done = (): PartInstance => ({ group, update: () => undefined, dispose: () => disposeTree(group) });
  if (!shape || shape.profile.length < 2) return done();
  const style = Math.round(Math.min(Math.max(effectNumber(effects, 'style'), 0), 3));
  const cloth = clothMaterial(effectColour(effects, 'color'), style === STYLE.jeans ? 0.85 : 0.75);
  const trim = trimMaterial(effectColour(effects, 'trim'));
  const legs = shape.limbs ?? [];

  const top = shape.profile[0][1];
  // The curve through the hip rings can dip a little below its last ring: the true lowest point.
  const bottom = Math.min(...Array.from({ length: 81 }, (_, i) => profilePoint(shape.profile, i / 80)[1]));
  const seat = style === STYLE.skirt ? skirtRings(shape, legs, top) : seatRings(shape, legs, top, bottom);
  group.add(new Mesh(fittedShell(seat, { segments: SEGMENTS, opening: 0, squareness: shape.squareness }), cloth));
  const hem = seat[seat.length - 1];
  const cap = new Mesh(new CircleGeometry(1, SEGMENTS), cloth);
  cap.scale.set(hem.rx, hem.rz, 1);
  cap.rotation.x = Math.PI / 2;
  cap.position.y = hem.y - 0.002;
  if (style !== STYLE.skirt) group.add(cap);

  const sq = shape.squareness;
  if (style !== STYLE.skirt) {
    group.add(new Mesh(piping(ringPoints(seat[0], sq, 0, Math.PI * 2, 64), BELT, true), trim));
    const buckle = new Mesh(new BoxGeometry(0.07, 0.05, 0.015), trimMaterial(0xd9cfbd));
    buckle.position.set(0, seat[0].y, seat[0].rz + BELT + 0.006);
    group.add(buckle);
    group.add(new Mesh(piping(edgePoints(seat.slice(1, Math.ceil(seat.length * 0.6)), sq, 0), STITCH), trim)); // the fly
  } else {
    // The wrap's edge runs down the front, off-centre, and a bow ties at the side.
    group.add(new Mesh(piping(edgePoints(seat, sq, 0.35), STITCH * 1.4), trim));
    group.add(new Mesh(piping(ringPoints(seat[0], sq, 0, Math.PI * 2, 64), STITCH * 2, true), trim));
    group.add(bow(seat, sq, trim));
  }

  // The legs below the hips (none when the hips reach the shoes).
  const legTop = bottom - 0.003;
  const hemY = style === STYLE.chinos ? shape.reach + CHINO_SHORT : shape.reach;
  if (style !== STYLE.skirt && legTop - hemY > 0.05) {
    for (const leg of legs) {
      const r = leg.radius + LEG_EASE;
      const rBottom = style === STYLE.chinos ? r * CHINO_TAPER : r * 0.96;
      const height = legTop - hemY;
      const tube = new Mesh(new CylinderGeometry(r, Math.max(rBottom, leg.radius + 0.012), height, 32, 6, true), cloth);
      tube.position.set(leg.position[0], legTop - height / 2, leg.position[2]);
      group.add(tube);
      if (style === STYLE.chinos) {
        const cuff = new Mesh(new TorusGeometry(Math.max(rBottom, leg.radius + 0.012) + CUFF * 0.4, CUFF, 10, 36), cloth);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.set(leg.position[0], hemY + CUFF * 0.6, leg.position[2]);
        group.add(cuff);
      }
      if (style === STYLE.jeans || style === STYLE.cargo) {
        // Outside-seam stitching down the leg.
        const seam = new Mesh(new CylinderGeometry(STITCH, STITCH, height, 6), trim);
        const side = Math.sign(leg.position[0]) || 1;
        seam.position.set(leg.position[0] + side * (r + STITCH * 0.5), legTop - height / 2, leg.position[2]);
        group.add(seam);
      }
      if (style === STYLE.cargo) group.add(pocket(leg, r, legTop, cloth, trim));
    }
  }
  return done();
}

/** The seat: the hips eased, never narrower than the two legs side by side (or deeper than a leg). */
function seatRings(shape: BodyShape, legs: readonly Limb[], top: number, bottom: number): GarmentRing[] {
  const span = Math.max(0, ...legs.map((l) => Math.abs(l.position[0]) + l.radius + LEG_EASE));
  const deep = Math.max(0, ...legs.map((l) => l.radius + LEG_EASE));
  return Array.from({ length: SEAT_RINGS }, (_, i) => {
    const y = top + ((bottom - top) * i) / (SEAT_RINGS - 1);
    const r = radiusAt(shape, y);
    return { y, rx: Math.max(r + EASE, span), rz: Math.max(r * shape.depth + EASE, deep) };
  });
}

/**
 * The skirt: one smooth flare from the waist to the knee. Each ring is the hips eased (or the legs
 * side by side), never narrower than the ring above it, plus a flare that grows toward the hem, so
 * there is no step where the hips end.
 */
function skirtRings(shape: BodyShape, legs: readonly Limb[], top: number): GarmentRing[] {
  const leg = legs[0];
  const hips = seatRings(shape, legs, top, shape.profile[shape.profile.length - 2][1]);
  const lastHip = hips[hips.length - 1].y;
  const knee = Math.min(leg ? leg.position[1] - leg.length * SKIRT_KNEE : shape.reach, lastHip - SKIRT_BELOW_HIPS);
  const span = Math.max(0, ...legs.map((l) => Math.abs(l.position[0]) + l.radius + LEG_EASE));
  const deep = Math.max(0, ...legs.map((l) => l.radius + LEG_EASE));
  const rings: GarmentRing[] = [];
  let rx = 0;
  let rz = 0;
  for (let i = 0; i < SEAT_RINGS; i++) {
    const t = i / (SEAT_RINGS - 1);
    const y = top + (knee - top) * t;
    const r = radiusAt(shape, y);
    rx = Math.max(rx, r + EASE, span);
    rz = Math.max(rz, r * shape.depth + EASE, deep);
    const flare = SKIRT_FLARE * t * t;
    rings.push({ y, rx: rx + flare, rz: rz + flare * 0.8 });
  }
  return rings;
}

/** A flapped pocket on the outside of the thigh. */
function pocket(leg: Limb, r: number, legTop: number, cloth: Mesh['material'], trim: Mesh['material']): Group {
  const side = Math.sign(leg.position[0]) || 1;
  const holder = new Group();
  holder.position.set(leg.position[0] + side * (r + 0.02), legTop - leg.length * 0.35, leg.position[2]);
  const bag = new Mesh(new BoxGeometry(0.035, 0.12, 0.13), cloth);
  const flap = new Mesh(new BoxGeometry(0.04, 0.03, 0.14), trim);
  flap.position.y = 0.055;
  holder.add(bag, flap);
  return holder;
}

/** A tie bow at the front-right of the waist, on the cloth, its two short tails flaring out with the skirt. */
function bow(rings: readonly GarmentRing[], squareness: number, trim: Mesh['material']): Group {
  const holder = new Group();
  const angle = 1.0;
  const [at] = ringPoints(rings[1], squareness, angle, angle, 2);
  const outward = Math.atan2(at.x, at.z);
  holder.position.set(at.x + Math.sin(outward) * 0.03, at.y, at.z + Math.cos(outward) * 0.03);
  holder.rotation.y = outward;
  const loop = new SphereGeometry(1, 14, 10);
  for (const side of [-1, 1]) {
    const l = new Mesh(loop, trim);
    l.scale.set(0.05, 0.032, 0.016);
    l.position.x = side * 0.045;
    l.rotation.z = side * 0.4;
    const tail = new Mesh(new BoxGeometry(0.026, 0.09, 0.01), trim);
    tail.geometry.translate(0, -0.045, 0);
    tail.position.set(side * 0.012, -0.01, 0.006);
    tail.rotation.set(-0.5, 0, side * 0.25);
    holder.add(l, tail);
  }
  const knot = new Mesh(loop, trim);
  knot.scale.set(0.022, 0.022, 0.018);
  holder.add(knot);
  return holder;
}
