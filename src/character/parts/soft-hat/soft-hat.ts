/**
 * The Soft Hat (slot `head`, any species with a head): a soft hat that hugs the head.
 *
 * Pattern: Adapter (styles as a small Strategy table). Each style follows the head's published dome
 * (`brim-hat/head-wear.ts`, `fit.ts`) with a little ease, so it sits on every head that offers the
 * slot. It rides the head bone.
 *
 * Styles (`style`, a whole number; anything else is clamped):
 *  0 pom beanie   a knit dome with a ribbed, folded cuff and a fluffy pom-pom that bobs
 *  1 acorn cap    a tiny scaled acorn cupule with a stem, worn over the crown
 *  2 mortarboard  a skull cap under a flat square board, its tassel swinging from the button
 *  3 headwrap     a tall wrapped cloth that rises above the head in folds, knotted at the front
 *
 * Effects: `color` (the cloth) and `trim` (cuff ribs, the pom, the acorn's scales, the tassel, the
 * wrap's folds).
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, Mesh, SphereGeometry, type MeshPhysicalMaterial } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { GarmentRing, PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartFrame, PartInstance } from '../part';
import { headOf, headRing, onRing, ringAround, type Head } from '../brim-hat/head-wear.ts';

const STYLES = 4;
const SEGMENTS = 72;
const RINGS = 16;
/** The beanie: its ease, the cuff's height (share of the head's height), its fold and ribs, the pom. */
const BEANIE_EASE = 0.035;
const CUFF_HEIGHT = 0.22;
const CUFF_FOLD = 0.03;
const RIBS = 28;
const RIB = 0.008;
const POM = 0.25;
const POM_TUFTS = 9;
const POM_BOB = 0.012;
/** The acorn cap: how far down the dome it reaches (share of the top's height), its ease, its rows of scales and its stem. */
const ACORN_DEPTH = 0.62;
const ACORN_EASE = 0.04;
const ACORN_ROWS = 4;
const ACORN_SCALES = 14;
/** How far each scale stands off the cap. */
const SCALE_STAND = 0.03;
const STEM = { radius: 0.04, height: 0.22 } as const;
/** The mortarboard: the cap's ease, the board's size (share of the head's width) and thickness, the tassel. */
const BOARD_EASE = 0.035;
const BOARD_SIZE = 1.6;
const BOARD_THICK = 0.035;
const TASSEL = { cord: 0.01, length: 0.38, radius: 0.05 } as const;
const TASSEL_SWING = 0.22;
/** The headwrap: how far it rises above the head (share of the head's height), how wide it puffs, its folds. */
const WRAP_EASE = 0.04;
const WRAP_RISE = 0.8;
const WRAP_PUFF = 1.22;
const WRAP_FOLDS = 5;
/** How steeply each wind slants (share of the head's height). */
const FOLD_SLANT = 0.22;
const FOLD = 0.03;

export function createSoftHat(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'soft-hat';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };
  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const head = headOf(shape);
  const cloth = clothMaterial(effectColour(effects, 'color'), style === 3 ? 0.7 : 0.85);
  const trim = style === 1 || style === 3 ? clothMaterial(effectColour(effects, 'trim'), 0.8) : trimMaterial(effectColour(effects, 'trim'));
  const update = [buildBeanie, buildAcorn, buildMortarboard, buildWrap][style](group, head, cloth, trim);
  return { group, pivotY: head.rim, update, dispose: () => disposeTree(group) };
}

type Builder = (group: Group, head: Head, cloth: MeshPhysicalMaterial, trim: MeshPhysicalMaterial) => (frame: PartFrame) => void;

/** Rings following the head from its crown down to `bottom`, eased. */
function domeRings(head: Head, bottom: number, ease: number): GarmentRing[] {
  return Array.from({ length: RINGS }, (_, i) => {
    const y = head.top * 0.999 + ((bottom - head.top * 0.999) * i) / (RINGS - 1);
    return headRing(head, y, ease);
  });
}

const shell = (rings: GarmentRing[], head: Head) => fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: head.shape.squareness });

const buildBeanie: Builder = (group, head, cloth, trim) => {
  const sq = head.shape.squareness;
  group.add(new Mesh(shell(domeRings(head, head.rim, BEANIE_EASE), head), cloth));
  const height = head.top - head.rim;
  const cuffTop = head.rim + CUFF_HEIGHT * height;
  const cuff = [cuffTop, head.rim].map((y) => headRing(head, y, BEANIE_EASE + CUFF_FOLD));
  group.add(new Mesh(shell(cuff, head), cloth));
  for (let i = 0; i < RIBS; i++) {
    const angle = (i / RIBS) * Math.PI * 2;
    group.add(new Mesh(piping([onRing(cuff[0], sq, angle, RIB * 0.5), onRing(cuff[1], sq, angle, RIB * 0.5)], RIB), trim));
  }
  group.add(new Mesh(piping(ringPoints({ ...cuff[0], rx: cuff[0].rx + RIB * 0.5, rz: cuff[0].rz + RIB * 0.5 }, sq, 0, Math.PI * 2, 64), RIB * 1.2, true), trim));
  // The pom: a fluffy cluster of tufts on the crown.
  const pom = new Group();
  const size = POM * head.width;
  pom.add(new Mesh(new IcosahedronGeometry(size, 2), trim));
  for (let i = 0; i < POM_TUFTS; i++) {
    const tuft = new Mesh(new SphereGeometry(size * 0.45, 12, 8), trim);
    const a = (i / POM_TUFTS) * Math.PI * 2;
    const tilt = i % 2 ? 0.9 : 0.4;
    tuft.position.set(Math.cos(a) * Math.sin(tilt) * size * 0.8, Math.cos(tilt) * size * 0.7, Math.sin(a) * Math.sin(tilt) * size * 0.8);
    pom.add(tuft);
  }
  const rest = head.top + BEANIE_EASE + size * 0.85;
  pom.position.y = rest;
  group.add(pom);
  return (frame) => {
    pom.position.y = rest + POM_BOB * frame.motion.amplitude * Math.abs(Math.sin(frame.time * frame.motion.speed * 2.4));
  };
};

const buildAcorn: Builder = (group, head, cloth, trim) => {
  const sq = head.shape.squareness;
  const rings = domeRings(head, head.top - ACORN_DEPTH * (head.top - head.rim), ACORN_EASE);
  group.add(new Mesh(shell(rings, head), cloth));
  // Rows of overlapping scales, the lowest row widest, standing just off the cap.
  const scale = new SphereGeometry(1, 10, 6);
  for (let row = 0; row < ACORN_ROWS; row++) {
    const ring = rings[Math.round(((row + 1) / (ACORN_ROWS + 0.4)) * (rings.length - 1))];
    const count = Math.max(6, Math.round(ACORN_SCALES * (ring.rx / rings[rings.length - 1].rx)));
    for (let i = 0; i < count; i++) {
      const angle = ((i + (row % 2) * 0.5) / count) * Math.PI * 2;
      const at = onRing(ring, sq, angle, SCALE_STAND);
      const s = new Mesh(scale, row % 2 ? trim : cloth);
      s.scale.set(0.07 * head.width, 0.045 * head.width, 0.016);
      s.position.copy(at);
      // Facing out from the head's centre: the scale lies along the dome, not across it.
      s.lookAt(at.clone().multiplyScalar(2));
      group.add(s);
    }
  }
  const rim = rings[rings.length - 1];
  group.add(new Mesh(piping(ringPoints({ ...rim, rx: rim.rx + 0.01, rz: rim.rz + 0.01 }, sq, 0, Math.PI * 2, 64), 0.016, true), trim));
  const stem = new Mesh(new CylinderGeometry(STEM.radius * 0.7, STEM.radius, STEM.height, 10), trim);
  stem.position.y = head.top + ACORN_EASE + STEM.height * 0.45;
  stem.rotation.z = -0.35;
  group.add(stem);
  return () => undefined;
};

const buildMortarboard: Builder = (group, head, cloth, trim) => {
  const capBottom = head.rim + (head.top - head.rim) * 0.15;
  const cap = domeRings(head, capBottom, BOARD_EASE);
  group.add(new Mesh(shell(cap, head), cloth));
  const side = BOARD_SIZE * head.width;
  const boardY = head.top + BOARD_EASE + BOARD_THICK;
  const board = new Mesh(new BoxGeometry(side, BOARD_THICK, side), cloth);
  board.position.y = boardY;
  board.rotation.y = Math.PI / 4;
  group.add(board);
  const button = new Mesh(new SphereGeometry(0.035, 14, 10), trim);
  button.scale.y = 0.5;
  button.position.y = boardY + BOARD_THICK * 0.6;
  group.add(button);
  // The tassel: a cord from the button to the board's right corner, then hanging and swinging.
  const corner = side / Math.SQRT2;
  group.add(new Mesh(piping([button.position.clone(), button.position.clone().setX(corner * 0.5).setY(boardY + BOARD_THICK * 0.55), button.position.clone().setX(corner * 0.98).setY(boardY + BOARD_THICK * 0.55)], TASSEL.cord), trim));
  const tassel = new Group();
  tassel.position.set(corner * 0.98, boardY, 0);
  const cord = new Mesh(new CylinderGeometry(TASSEL.cord, TASSEL.cord, TASSEL.length * 0.5, 6), trim);
  cord.position.y = -TASSEL.length * 0.25;
  const brush = new Mesh(new ConeGeometry(TASSEL.radius, TASSEL.length * 0.5, 14, 1, true), trim);
  brush.position.y = -TASSEL.length * 0.75;
  tassel.add(cord, brush);
  group.add(tassel);
  return (frame) => {
    const a = frame.motion.amplitude;
    tassel.rotation.z = TASSEL_SWING * a * Math.sin(frame.time * frame.motion.speed * 1.7) * (0.6 + 0.4 * frame.work);
    tassel.rotation.x = 0.5 * TASSEL_SWING * a * Math.sin(frame.time * frame.motion.speed * 1.1 + 1);
  };
};

const buildWrap: Builder = (group, head, cloth, trim) => {
  const sq = head.shape.squareness;
  const height = head.top - head.rim;
  const peak = head.top + WRAP_RISE * height;
  const base = head.width + WRAP_EASE;
  // Up from the rim, swelling past the crown, then a rounded top: a tall, soft wrap.
  const rings: GarmentRing[] = Array.from({ length: RINGS + 6 }, (_, i) => {
    const t = i / (RINGS + 5); // 0 top .. 1 rim
    const y = peak - (peak - head.rim) * t;
    // A rounded crown that swells out above the head, then gathers in toward the brow.
    const swell = t < 0.45 ? Math.sin((t / 0.45) * (Math.PI / 2)) ** 0.55 * WRAP_PUFF : WRAP_PUFF - (WRAP_PUFF - 1) * ((t - 0.45) / 0.55);
    return ringAround(head, y, Math.max(base * swell, 0.02), WRAP_EASE);
  });
  group.add(new Mesh(shell(rings, head), cloth));
  // The folds: bands of cloth wound round it, each tilted (higher at the back), in the trim colour.
  for (let f = 0; f < WRAP_FOLDS; f++) {
    const t = 0.3 + (f / (WRAP_FOLDS - 1)) * 0.58;
    const points = Array.from({ length: 64 }, (_, k) => {
      const angle = (k / 64) * Math.PI * 2;
      // Each wind runs on a slant, alternate winds slanting the other way, so they cross at the front.
      const tilt = (f % 2 ? 1 : -1) * FOLD_SLANT * height * Math.cos(angle - (f % 2 ? 0.6 : -0.6));
      const y = peak - (peak - head.rim) * t - tilt;
      const ring = ringAround(head, y, wrapWidth(rings, y), WRAP_EASE);
      return onRing(ring, sq, angle, FOLD * 0.9);
    });
    group.add(new Mesh(piping(points, FOLD, true), f % 2 ? trim : cloth));
  }
  // The knot at the front.
  const front = rings[Math.round(rings.length * 0.45)];
  const knot = new Mesh(new SphereGeometry(0.13 * head.width, 16, 12), trim);
  knot.position.copy(onRing(front, sq, 0, 0.06 * head.width));
  knot.scale.set(1.3, 0.85, 0.7);
  group.add(knot);
  return () => undefined;
};

/** The wrap's half-width at height `y` (between its rings). */
function wrapWidth(rings: readonly GarmentRing[], y: number): number {
  for (let i = 0; i < rings.length - 1; i++) {
    if (y <= rings[i].y && y >= rings[i + 1].y) {
      const t = (y - rings[i].y) / (rings[i + 1].y - rings[i].y || 1);
      return rings[i].rx + (rings[i + 1].rx - rings[i].rx) * t;
    }
  }
  return rings[rings.length - 1].rx;
}
