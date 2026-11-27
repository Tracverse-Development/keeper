/**
 * Batting Whites (slot `legs`, humans; the man's Test Match set): cricket whites with a leg guard
 * strapped over each shin. The whites are the Trousers kit's straight cut (belt, fly, seams) in the
 * set's cloth; over each leg below the knee a guard of vertical cane bolsters wraps the front and
 * sides, a padded knee roll sits on top of it, its edge is bound, and three straps go round the back
 * of the leg, each buckled on the outside.
 *
 * Pattern: Adapter + Composite: it builds the Trousers part (`trousers.ts`) for the cloth, then fits
 * each guard to a leg the legs shape publishes (`fit.ts` limbs), standing clear of the trouser leg.
 * Wherever the body's own surface reaches down over the shins (the God Keeper's robe) the guard is
 * laid over that surface instead (`pushOut`), so nothing ever sinks into a body.
 *
 * Effects: `color` (the whites), `trim` (the straps and belt) and `pad` (the guards).
 */
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, MeshPhysicalMaterial, SphereGeometry, Vector3 } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { effectColour, type EffectValues } from '../effects.ts';
import { profilePoint, type Limb, type PartFit } from '../fit.ts';
import { piping } from '../fitted-shell.ts';
import { pushOut } from '../garment.ts';
import { metalMaterial } from '../glow-kit.ts';
import { leatherMaterial } from '../leather.ts';
import { createTrousers } from '../trousers/trousers.ts';
import { meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

/** The trouser leg's room round a leg (trousers.ts LEG_EASE) and the guard's room over it. */
const TROUSER_EASE = 0.035;
const GUARD_GAP = 0.014;
/** The guard covers this arc round the front of the leg (radians each side), in bolsters. */
const WRAP = 1.95;
const BOLSTERS = 7;
const BOLSTER_DEPTH = 0.022;
/** It runs from this share down the leg to just above the shoe; the knee roll sits on top. */
const FROM = 0.06;
const ABOVE_SHOE = 0.035;
const KNEE = 0.07;
const STRAPS: readonly number[] = [0.2, 0.5, 0.82];

export function createBattingWhites(effects: EffectValues, fit: PartFit): PartInstance {
  const whites = createTrousers({ color: effects.color, trim: effects.trim, style: 0 }, fit);
  const group = new Group();
  group.name = 'batting-whites';
  group.add(whites.group);
  const shape = fit.shape;
  const done = (): PartInstance => ({ group, update: (frame: PartFrame) => whites.update(frame), dispose: () => disposeTree(group) });
  if (!shape || shape.profile.length < 2) return done();

  const padColour = new Color(effectColour(effects, 'pad'));
  const pad = new MeshPhysicalMaterial({ color: padColour, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: padColour.clone().lerp(new Color(0xffffff), 0.3) });
  const binding = new MeshPhysicalMaterial({ color: padColour.clone().multiplyScalar(0.86), roughness: 0.6 });
  const straps = leatherMaterial(effectColour(effects, 'trim'), 0.3);
  const steel = metalMaterial(0xc9ccd4, 0.3, 0.02);
  const add = meshAdder(group);

  // Where the hips end: guards only go below it (as the trouser legs do).
  const hipsBottom = Math.min(...Array.from({ length: 81 }, (_, i) => profilePoint(shape.profile, i / 80)[1]));
  for (const leg of shape.limbs ?? []) {
    const top = Math.min(leg.position[1] - leg.length * FROM, hipsBottom - 0.02);
    const bottom = shape.reach + ABOVE_SHOE;
    if (top - bottom < 0.08) continue;
    const radius = leg.radius + TROUSER_EASE + GUARD_GAP;
    add(pushOut(guard(leg, radius, top, bottom), shape, 0.03), pad, 'pad-guard');
    // The bound edge round the guard, and the knee roll on top of it.
    add(pushOut(piping(outlinePoints(leg, radius + BOLSTER_DEPTH * 0.5, top, bottom), 0.009, true), shape, 0.03), binding, 'pad-binding');
    const knee = new SphereGeometry(1, 28, 14, Math.PI / 2 - WRAP, WRAP * 2, Math.PI * 0.25, Math.PI * 0.5);
    knee.scale(radius + BOLSTER_DEPTH * 1.6, KNEE, radius + BOLSTER_DEPTH * 1.6).translate(leg.position[0], top + KNEE * 0.35, leg.position[2]);
    add(pushOut(knee, shape, 0.03), pad, 'pad-knee');
    // Three straps round the back of the leg, each with a steel buckle on the outside.
    const side = Math.sign(leg.position[0]) || 1;
    for (const share of STRAPS) {
      const y = top - (top - bottom) * share;
      const round = Array.from({ length: 24 }, (_, k) => {
        const a = WRAP - 0.25 + ((Math.PI * 2 - 2 * WRAP + 0.5) * k) / 23;
        return new Vector3(leg.position[0] + Math.sin(a) * (radius + 0.008), y, leg.position[2] + Math.cos(a) * (radius + 0.008));
      });
      add(pushOut(piping(round, 0.012), shape, 0.03), straps, 'pad-strap');
      const at = new Vector3(leg.position[0] + side * (radius + BOLSTER_DEPTH + 0.01) * Math.sin(WRAP - 0.15), y, leg.position[2] + (radius + BOLSTER_DEPTH) * Math.cos(WRAP - 0.15));
      const buckle = merged([
        new BoxGeometry(0.008, 0.045, 0.008).translate(-0.016, 0, 0),
        new BoxGeometry(0.008, 0.045, 0.008).translate(0.016, 0, 0),
        new BoxGeometry(0.04, 0.008, 0.008).translate(0, 0.02, 0),
        new BoxGeometry(0.04, 0.008, 0.008).translate(0, -0.02, 0),
      ]).rotateY(side * (WRAP - 0.15)).translate(at.x, at.y, at.z);
      add(pushOut(buckle, shape, 0.03), steel, 'pad-buckle');
    }
  }
  return done();
}

/**
 * One guard: a curved shell round the front of the leg from `top` to `bottom`, its surface raised
 * into BOLSTERS vertical canes (rounded ridges with creases between them) and its top and foot rounded in.
 */
function guard(leg: Limb, radius: number, top: number, bottom: number): BufferGeometry {
  const columns = BOLSTERS * 8;
  const rows = 26;
  const positions = new Float32Array((rows + 1) * (columns + 1) * 3);
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = top - (top - bottom) * t;
    // The guard flares a touch over the instep at the foot.
    const flare = 1 + 0.12 * Math.max(t - 0.8, 0) / 0.2;
    for (let j = 0; j <= columns; j++) {
      const u = j / columns;
      const a = -WRAP + 2 * WRAP * u;
      const cane = Math.abs(Math.sin(u * BOLSTERS * Math.PI)) ** 0.6;
      const r = (radius + BOLSTER_DEPTH * cane) * flare;
      positions.set([leg.position[0] + Math.sin(a) * r, y, leg.position[2] + Math.cos(a) * r], (i * (columns + 1) + j) * 3);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j;
      const b = a + columns + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** The guard's border: down one side, across the foot, up the other side and across the top. */
function outlinePoints(leg: Limb, radius: number, top: number, bottom: number): Vector3[] {
  const at = (a: number, y: number) => new Vector3(leg.position[0] + Math.sin(a) * radius, y, leg.position[2] + Math.cos(a) * radius);
  const out: Vector3[] = [];
  for (let k = 0; k < 12; k++) out.push(at(-WRAP, top - ((top - bottom) * k) / 12));
  for (let k = 0; k < 16; k++) out.push(at(-WRAP + (2 * WRAP * k) / 16, bottom));
  for (let k = 0; k < 12; k++) out.push(at(WRAP, bottom + ((top - bottom) * k) / 12));
  for (let k = 0; k < 16; k++) out.push(at(WRAP - (2 * WRAP * k) / 16, top));
  return out;
}

