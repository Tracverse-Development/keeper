/**
 * The shoe last: the shape every shoe in the Shoes kit is built on, as plain geometry in the foot's
 * own space (its centre at the origin, the toe toward +z, the sole toward -y).
 *
 * Pattern: Builder. A last is lofted from cross-sections taken from the heel (t = 0) to the toe
 * (t = 1). Each section is a rounded box (a superellipse) whose width follows a PLAN (narrow heel,
 * widest at the ball, a rounded or pointed toe) and whose top follows a PROFILE (a tall heel counter,
 * the instep falling to a low toe), never smaller than the foot's own ellipsoid there plus `ease`, so
 * nothing sinks into the foot. The bottom is flat with a little toe spring. A THROAT can be left open
 * at the top toward the back (where the foot goes in): the section's arc is cut by an angle that
 * shrinks to nothing toward the toe, so the opening has the soft U of a real shoe. The sole is lofted
 * the same way as a slab under the last, a touch wider all round.
 *
 * Pure geometry (three.js buffers only): measured by the wearables-fit test against the foot.
 */
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { Foot } from '../fit.ts';

/** The shape of one style's last (shares of the foot's own radii unless said). */
export interface LastSpec {
  /** How far the toe reaches past the foot, and the heel behind it (shares of the foot's length). */
  readonly toe: number;
  readonly heel: number;
  /** The plan: width at the ball over the foot's width, and how pointed the toe is (1 round .. 3 pointed). */
  readonly width: number;
  readonly point: number;
  /** The top: height at the heel counter and at the toe, over the foot's height (the instep is the foot's own top). */
  readonly counter: number;
  readonly toeHeight: number;
  /** The throat: where it ends toward the toe (t), and how wide it is open at the back (radians from the top). */
  readonly throatEnd: number;
  readonly throat: number;
  /** Cross-section exponent: 2 an ellipse, higher boxier. */
  readonly box: number;
  /** How far the toe lifts off the ground (over the foot's height). */
  readonly spring: number;
}

/** Stations from heel to toe, and points round each section. */
export const STATIONS = 30;
export const AROUND = 40;

/** Where a last is evaluated: the foot, the ease it stands off it, its spec. */
export interface Last {
  readonly foot: Foot;
  readonly ease: number;
  readonly spec: LastSpec;
}

/** One section of the last at `t`: its centre height, half-height, half-width and the opening angle. */
export interface Section {
  readonly z: number;
  readonly yc: number;
  readonly hh: number;
  readonly w: number;
  readonly open: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The heel-to-toe length the last spans, as [back z, front z]. */
export function span(last: Last): [number, number] {
  const rz = last.foot.radii[2];
  return [-rz * (1 + last.spec.heel) - last.ease, rz * (1 + last.spec.toe) + last.ease];
}

/** The last's section at `t` (0 heel .. 1 toe). */
export function section(last: Last, t: number): Section {
  const { foot, ease, spec } = last;
  const [rx, ry, rz] = foot.radii;
  const [back, front] = span(last);
  const z = back + (front - back) * t;
  // The foot's own slice here (an ellipse), which the section must enclose with ease.
  const s = 1 - (z / rz) ** 2;
  const wf = s > 0 ? rx * Math.sqrt(s) : 0;
  const hf = s > 0 ? ry * Math.sqrt(s) : 0;
  // Plan: a rounded heel, widest at the ball (t ~ 0.68), a rounded or pointed toe.
  const heelRound = Math.sqrt(Math.max(0, 1 - ((0.16 - Math.min(t, 0.16)) / 0.16) ** 2));
  const toeRound = Math.max(0, 1 - ((Math.max(t, 0.68) - 0.68) / 0.32) ** (2 / spec.point)) ** (1 / 2);
  const plan = Math.max(0.03, heelRound * toeRound * (0.84 + 0.16 * Math.sin(Math.min(t / 0.68, 1) * Math.PI * 0.5)));
  const w = Math.max(rx * spec.width * plan + ease * plan, wf + ease);
  // Profile: a heel counter at the back, the instep, the toe box falling low.
  const counter = ry * spec.counter * (1 - smooth(0.0, 0.45, t)) + ry * (1 - smooth(0.45, 1, t)) * smooth(0.0, 0.45, t);
  const toeTop = ry * spec.toeHeight * smooth(0.6, 1, t);
  const bottom = -(ry + ease * 0.4) + ry * spec.spring * smooth(0.78, 1, t) ** 2;
  let top = Math.max(Math.max(counter, toeTop) * 0.6 + ry * 0.4 * (1 - smooth(0.7, 1.02, t)), hf + ease);
  // Past the foot (the toe box and the heel's back), the section closes down toward the sole as the
  // plan narrows, so the last ends in a rounded point instead of a pinched edge.
  if (s <= 0) top = bottom + (top - bottom) * Math.sqrt(plan);
  const open = spec.throat * (1 - smooth(spec.throatEnd * 0.55, spec.throatEnd, t));
  return { z, yc: (top + bottom) / 2, hh: (top - bottom) / 2, w, open };
}

/** A point on a section at angle `phi` (0 = the top centre, growing toward +x), pushed out by `lift`. */
export function point(sec: Section, phi: number, box: number, lift = 0, out = new Vector3()): Vector3 {
  const e = 2 / box;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return out.set((sec.w + lift) * Math.sign(s) * Math.abs(s) ** e, sec.yc + (sec.hh + lift) * Math.sign(c) * Math.abs(c) ** e, sec.z);
}

/** The angle of point `j` of `AROUND` on a section with its throat open by `open` (a full ring when 0). */
export function around(j: number, open: number): number {
  return open + ((Math.PI * 2 - 2 * open) * j) / AROUND;
}

/** The upper: the last's surface, open at the throat, lifted `lift` off the last (a toe cap, a counter). */
export function upperGeometry(last: Last, from = 0, to = 1, lift = 0): BufferGeometry {
  const rows = Array.from({ length: STATIONS + 1 }, (_, i) => from + ((to - from) * i) / STATIONS);
  return loft(rows.map((t) => {
    const sec = section(last, t);
    return Array.from({ length: AROUND + 1 }, (_, j) => point(sec, around(j, sec.open), last.spec.box, lift));
  }));
}

/**
 * The tongue: the last's closed top across the throat (from `from` to `to`), lifted `lift`: what the
 * laces cross over, so the opening never shows the foot under them.
 */
export function tongueGeometry(last: Last, from: number, to: number, lift: number): BufferGeometry {
  const closed: Last = { ...last, spec: { ...last.spec, throat: 0 } };
  const half = 0.9;
  const rows = Array.from({ length: STATIONS + 1 }, (_, i) => from + ((to - from) * i) / STATIONS);
  return loft(rows.map((t) => {
    const sec = section(closed, t);
    return Array.from({ length: AROUND + 1 }, (_, j) => point(sec, -half + (2 * half * j) / AROUND, last.spec.box, lift));
  }));
}

/** The sole: a slab under the last, `thickness` deep, a little wider than the last all round. */
export function soleGeometry(last: Last, thickness: number, flare = 1.06): BufferGeometry {
  const rows = Array.from({ length: STATIONS + 1 }, (_, i) => i / STATIONS);
  // Its top meets the last's bottom from just below the foot (never above it: the last's bottom is
  // only a share of `ease` under the foot).
  const overlap = Math.min(thickness * 0.15, last.ease * 0.3);
  return loft(rows.map((t) => {
    const sec = section(last, t);
    const bottom = sec.yc - sec.hh;
    const slab: Section = { z: sec.z, yc: bottom - thickness / 2 + overlap, hh: thickness / 2, w: sec.w * flare, open: 0 };
    return Array.from({ length: AROUND + 1 }, (_, j) => point(slab, around(j, 0), 6));
  }));
}

/** The throat's rim, from the toe-most edge of the opening on one side round the heel to the other. */
export function throatRim(last: Last, lift: number): Vector3[] {
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const sec = section(last, t);
    if (sec.open < 0.02) break;
    right.push(point(sec, sec.open, last.spec.box, lift));
    left.push(point(sec, Math.PI * 2 - sec.open, last.spec.box, lift));
  }
  return [...right.reverse(), ...left];
}

/** A grid of points (rows of equal length) as an indexed, smooth-shaded surface. */
function loft(rows: Vector3[][]): BufferGeometry {
  const cols = rows[0].length;
  const positions = new Float32Array(rows.length * cols * 3);
  const uvs = new Float32Array(rows.length * cols * 2);
  rows.forEach((row, i) =>
    row.forEach((p, j) => {
      positions.set([p.x, p.y, p.z], (i * cols + j) * 3);
      uvs.set([j / (cols - 1), i / (rows.length - 1)], (i * cols + j) * 2);
    }),
  );
  const index: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + cols;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
