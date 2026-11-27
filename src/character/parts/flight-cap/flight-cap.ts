/**
 * The Flight Cap (slot `head`, any species with a head; the woman's Sky Pilot set): an aviator's
 * leather helmet. It hugs the head from the crown down to the brow at the front and lower round the
 * sides and back; stitched seams run over the top from front to back and down each side; a thick
 * fleece edge frames the face; an ear flap hangs over each side with a brass snap, and a chin strap
 * hangs loose from each flap, one end carrying its buckle.
 *
 * Pattern: Adapter. The shell is cut column by column from the head's published dome (`fit.ts`,
 * `head-wear.ts`): each point stands `EASE` outside the head at its own height, and the front of the
 * cut rises to the brow, so it fits the robot's dome, the dog's skull, a person's hair and the owl's
 * round head. Below the dome's equator the head is read as its mirror (heads are round), so the
 * flaps follow the jaw. It rides the head bone and keeps still.
 *
 * Effects: `color` (the leather, drawn by `leather.ts`), `trim` (the fleece) and `wear`.
 */
import { BufferAttribute, BufferGeometry, BoxGeometry, CatmullRomCurve3, Color, Group, MeshPhysicalMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, radiusAt, type BodyShape, type PartFit } from '../fit.ts';
import { metalMaterial } from '../glow-kit.ts';
import { headOf, type Head } from '../brim-hat/head-wear.ts';
import { leatherMaterial } from '../leather.ts';
import { dash, keepColour, meshAdder, merged } from '../detail-kit.ts';
import type { PartInstance } from '../part';

const EASE = 0.035;
const COLUMNS = 96;
const ROWS = 22;
/** Where the cut ends: at the front just above the brow, round the sides and back lower down (shares of the head's top). */
const FRONT_EDGE = 0.4;
const SIDE_EDGE = 0.14;
/** The front opening's half-width (radians round the head) and how softly it turns into the sides. */
const FRONT_HALF = 0.95;
const TURN = 0.45;
/** The ear flaps: their centre angle, half-width (radians), and how far below the equator they hang. */
const FLAP_HALF = 0.32;
const FLAP_DROP = 0.42;
const FLEECE = 0.042;
const STITCH = 0.006;

export function createFlightCap(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'flight-cap';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const head = headOf(shape);
  const wear = effectNumber(effects, 'wear');
  const leather = keepColour(leatherMaterial(effectColour(effects, 'color'), wear));
  const darkLeather = keepColour(leatherMaterial(new Color(effectColour(effects, 'color')).multiplyScalar(0.55).getHex(), wear));
  const fleece = clothMaterial(effectColour(effects, 'trim'), 0.98);
  Object.assign(fleece, { sheen: 1, sheenRoughness: 0.8 });
  const thread = new MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  const brass = metalMaterial(0xc9953c, 0.3, 0.03);
  const add = meshAdder(group);

  const edge = (a: number) => edgeAt(head, a);
  add(helmet(head, edge), leather, 'cap-shell');

  // The fleece edge: a thick rolled tube along the whole cut, a little lumpy like real fleece.
  const rim = Array.from({ length: 160 }, (_, i) => {
    const a = (i / 160) * Math.PI * 2;
    return headPoint(head, a, edge(a), EASE + FLEECE * 0.6);
  });
  add(lumpy(new TubeGeometry(new CatmullRomCurve3(rim, true), 320, FLEECE, 10, true), FLEECE * 0.18), fleece, 'cap-fleece');

  // Seams with saddle stitches: front to back over the crown, and down each side.
  const stitches: BufferGeometry[] = [];
  const seam = (a: number, from: number, to: number, lift: number) => {
    const points = Array.from({ length: 24 }, (_, i) => headPoint(head, a, from + ((to - from) * i) / 23, EASE + lift));
    for (let i = 0; i < points.length - 1; i++) stitches.push(dash(points[i], points[i + 1], 0.55, STITCH * 1.6, STITCH));
    return points;
  };
  const ridges: Vector3[][] = [];
  for (const a of [0, Math.PI]) ridges.push(seam(a, head.top * 0.98, edge(a) + 0.03, 0.012));
  for (const a of [-Math.PI / 2, Math.PI / 2]) ridges.push(seam(a, head.top * 0.92, edge(a) + 0.02, 0.012));
  add(merged(stitches), thread, 'cap-stitching');
  for (const ridge of ridges) add(new TubeGeometry(new CatmullRomCurve3(ridge), 48, STITCH * 1.4, 6), darkLeather, 'cap-seam');

  // The ear flaps, each with a brass snap and a loose chin strap; the wearer's left strap carries the buckle.
  for (const side of [-1, 1]) {
    const centre = side * (Math.PI / 2 + 0.12);
    add(flap(head, centre), leather, 'cap-flap');
    const snap = headPoint(head, centre, -FLAP_DROP * head.top * 0.35, EASE + 0.03);
    add(new SphereGeometry(0.022, 12, 8).translate(snap.x, snap.y, snap.z), brass, 'cap-snap');
    const start = headPoint(head, centre + side * 0.05, -FLAP_DROP * head.top * 0.85, EASE + 0.02);
    const out = new Vector3(start.x, 0, start.z).normalize();
    const strapPath = [start, start.clone().add(new Vector3(0, -0.12, 0.05)).addScaledVector(out, 0.03), start.clone().add(new Vector3(0, -0.26, 0.1)).addScaledVector(out, 0.02)];
    const strap = new TubeGeometry(new CatmullRomCurve3(strapPath), 20, 0.014, 6).scale(1, 1, 1);
    add(strap, darkLeather, 'cap-strap');
    if (side > 0) {
      const end = strapPath[2];
      add(merged([
        new BoxGeometry(0.05, 0.008, 0.01).translate(0, 0.022, 0),
        new BoxGeometry(0.05, 0.008, 0.01).translate(0, -0.022, 0),
        new BoxGeometry(0.008, 0.05, 0.01).translate(0.022, 0, 0),
        new BoxGeometry(0.008, 0.05, 0.01).translate(-0.022, 0, 0),
      ]).rotateY(Math.atan2(out.x, out.z)).translate(end.x, end.y, end.z), brass, 'cap-buckle');
    }
  }
  return { group, pivotY: head.rim, update: () => undefined, dispose: () => disposeTree(group) };
}

/** The head's half-width at `y`, read as its mirror below the dome's equator. */
function headRadius(shape: BodyShape, y: number): number {
  const top = shape.profile[0][1];
  const r = radiusAt(shape, Math.min(Math.abs(y), top));
  return r > 1e-6 ? r : shape.profile[shape.profile.length - 1][0];
}

/** A point on the head at angle `a` (0 = front) and height `y`, `ease` off it. */
function headPoint(head: Head, a: number, y: number, ease: number): Vector3 {
  const r = headRadius(head.shape, y);
  const [x, z] = crossSection(a, r + ease, r * head.shape.depth + ease, head.shape.squareness);
  return new Vector3(x, y, z);
}

/** Where the cut ends at angle `a`: up at the brow across the front, lower round the sides and back. */
function edgeAt(head: Head, a: number): number {
  const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
  const t = Math.min(Math.max((d - FRONT_HALF) / TURN + 0.5, 0), 1);
  const s = t * t * (3 - 2 * t);
  return head.top * (FRONT_EDGE + (SIDE_EDGE - FRONT_EDGE) * s);
}

/** The helmet's shell: columns round the head, rows from the crown down to the cut. */
function helmet(head: Head, edge: (a: number) => number): BufferGeometry {
  const columns = COLUMNS + 1;
  const positions = new Float32Array((ROWS + 1) * columns * 3);
  for (let i = 0; i <= ROWS; i++) {
    for (let j = 0; j < columns; j++) {
      const a = (j / COLUMNS) * Math.PI * 2;
      const t = i / ROWS;
      const y = head.top + EASE * 0.5 - (head.top + EASE * 0.5 - edge(a)) * t;
      const p = headPoint(head, a, y, EASE * (0.6 + 0.4 * Math.min(t * 4, 1)));
      positions.set([p.x, p.y, p.z], (i * columns + j) * 3);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLUMNS; j++) {
      const a = i * columns + j;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** An ear flap round angle `centre`: from inside the shell's edge down below the equator, rounded at the bottom. */
function flap(head: Head, centre: number): BufferGeometry {
  const columns = 25;
  const rows = 14;
  const top = edgeAt(head, centre) + 0.06;
  const bottom = -FLAP_DROP * head.top;
  const positions = new Float32Array(rows * columns * 3);
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y = top - (top - bottom) * t;
    // The bottom rounds off: the flap narrows over its last third.
    const round = t > 0.62 ? Math.sqrt(Math.max(1 - ((t - 0.62) / 0.38) ** 2, 0.05)) : 1;
    for (let j = 0; j < columns; j++) {
      const u = -1 + (2 * j) / (columns - 1);
      const p = headPoint(head, centre + u * FLAP_HALF * round, y, EASE + 0.012);
      positions.set([p.x, p.y, p.z], (i * columns + j) * 3);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < columns - 1; j++) {
      const a = i * columns + j;
      index.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Roughens a tube so it reads as fleece: each vertex nudged along its normal by a fixed pattern. */
function lumpy(geometry: BufferGeometry, amount: number): BufferGeometry {
  const position = geometry.getAttribute('position') as BufferAttribute;
  const normal = geometry.getAttribute('normal') as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const k = Math.sin(i * 12.9898) * 43758.5453;
    const bump = (k - Math.floor(k) - 0.5) * 2 * amount;
    position.setXYZ(i, position.getX(i) + normal.getX(i) * bump, position.getY(i) + normal.getY(i) * bump, position.getZ(i) + normal.getZ(i) * bump);
  }
  geometry.computeVertexNormals();
  return geometry;
}
