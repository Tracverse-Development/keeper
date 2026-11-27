/**
 * The Neckwear kit (slot `neck`, any species with a neck): one factory, three pieces, picked by the
 * `style` effect:
 *
 *   0 bandana  a folded band round the neck and its triangle hanging over the chest, dotted
 *   1 tie      a narrow collar line, a knot at the throat and a blade down the chest to a point
 *   2 shawl    a sheer cape over the shoulders, open at the front, scattered with tiny sparkles
 *
 * Pattern: Adapter. It reads the neck's published shape (`fit.ts`: the neck ring, then the chest
 * below it), never the species. Hanging pieces are laid ON the chest as fitted panels that narrow
 * toward their point (`taperPanel`), `EASE` off the surface, and only as long as the shape has a
 * surface to lie on; the band and collar follow the neck ring. The hanging tip and the shawl's edge
 * sway softly, outward only; the shawl also swings and twists as the body moves (`sway/drape-sway.ts`).
 *
 * Effects: `color` (the cloth), `trim` (the dots, the tie's pattern, the shawl's sparkles),
 * `sway` (how much the hanging parts move), `style`.
 */
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, Vector3, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, radiusAt, type BodyShape, type PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, outward, pushOut, scatterQuads } from '../garment.ts';
import { createDrapeSway } from '../../sway/drape-sway.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.03;
const STYLE_COUNT = 3;
const SWAY = 0.018;
/** The widest the shawl's edge swings with the body's motion (world units). */
const SHAWL_DRAPE = 0.07;
/** The band round the neck (bandana) and the collar line (tie): tube radius. */
const BAND = 0.032;
const COLLAR = 0.014;
/** How much of the chest below the neck a hanging piece covers (share of neck to reach). */
const BANDANA_LENGTH = 0.8;
const TIE_LENGTH = 1.25;
const SHAWL_LENGTH = 1.1;

export function createNeckwear(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'neckwear';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLE_COUNT - 1);
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const sway = effectNumber(effects, 'sway');
  const add = (g: BufferGeometry, material: Material, name: string): BufferGeometry => {
    group.add(Object.assign(new Mesh(pushOut(g, shape, 0.004), material), { name }));
    return g;
  };
  const neckTop = shape.profile[0][1] - 0.04;
  const span = neckTop - shape.reach;
  // A hanging piece lies on the chest only as far down as the shape has a surface.
  const lowest = shape.profile[shape.profile.length - 1][1] + 0.03;
  const reachDown = (share: number) => Math.min(span * share, neckTop - lowest);
  const sways: ((frame: PartFrame) => void)[] = [];

  if (style === 0) {
    const cloth = clothMaterial(colour, 0.8);
    add(piping(neckRing(shape, neckTop, BAND), BAND, true), cloth, 'bandana-band');
    const length = reachDown(BANDANA_LENGTH);
    const point = add(taperPanel(shape, neckTop - BAND, length, (v) => 1.1 * (1 - v), 14), cloth, 'bandana-point');
    sways.push(garmentSway(point, neckTop, neckTop - length, SWAY * sway));
    add(dots(shape, neckTop - BAND, length, (v) => 0.8 * (1 - v)), trimMaterial(trimColour), 'bandana-dots');
  } else if (style === 1) {
    const silk = clothMaterial(colour, 0.35);
    add(piping(neckRing(shape, neckTop + 0.01, COLLAR), COLLAR, true), trimMaterial(0xf4eee2), 'tie-collar');
    const knotAt = surfacePoint(shape, 0, neckTop - 0.03, EASE + 0.02);
    const knot = new SphereGeometry(1, 16, 12).scale(0.045, 0.05, 0.035);
    knot.translate(knotAt.x, knotAt.y, knotAt.z);
    add(knot, silk, 'tie-knot');
    const length = reachDown(TIE_LENGTH) - 0.06;
    const width = (v: number) => (v < 0.88 ? 0.13 + 0.1 * v : 0.22 * (1 - (v - 0.88) / 0.12));
    const blade = add(taperPanel(shape, neckTop - 0.06, length, width, 22), silk, 'tie-blade');
    sways.push(garmentSway(blade, neckTop, neckTop - length, SWAY * 0.5 * sway));
    add(dots(shape, neckTop - 0.1, length * 0.85, (v) => 0.12 + 0.07 * v), trimMaterial(trimColour), 'tie-pattern');
  } else {
    const sheer = clothMaterial(colour, 0.55);
    Object.assign(sheer, { transparent: true, opacity: 0.72, depthWrite: false });
    const bottom = neckTop - reachDown(SHAWL_LENGTH);
    const rings = garmentRings(shape, neckTop, bottom, EASE + 0.015, 18).map((r, i) => ({ y: r.y, rx: r.rx + 0.03 * (i / 17) ** 2, rz: r.rz + 0.03 * (i / 17) ** 2 }));
    const geometry = add(fittedShell(rings, { segments: 64, opening: 0.9, squareness: shape.squareness }), sheer, 'shawl');
    // The shawl also swings and twists with the body (`sway/drape-sway.ts`), its sparkles with it.
    const drape = createDrapeSway(group, { top: neckTop, bottom, radius: rings[rings.length - 1].rz, maxLag: SHAWL_DRAPE, frequency: 1.6, gain: Math.min(sway, 1.5) });
    sways.push((frame) => drape.step(frame.dt, frame.motion.amplitude), garmentSway(geometry, neckTop, bottom, SWAY * 1.4 * sway, drape));
    const sparkle = new MeshPhysicalMaterial({ color: trimColour, emissive: new Color(trimColour), emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.2, side: DoubleSide });
    const pieces = Array.from({ length: 90 }, (_, i) => {
      const ring = rings[1 + Math.floor(((i * 0.618034) % 1) * (rings.length - 2))];
      const angle = 0.5 + ((i * 2.399963) % (Math.PI * 2 - 1));
      const [x, z] = crossSection(angle, ring.rx + 0.004, ring.rz + 0.004, shape.squareness);
      return { at: new Vector3(x, ring.y, z), normal: outward(shape, x, z), spin: i };
    });
    sways.push(garmentSway(add(scatterQuads(pieces, 0.018), sparkle, 'shawl-sparkles'), neckTop, bottom, 0, drape)); // swing only, as before no billow
    sways.push((frame) => (sparkle.emissiveIntensity = 0.8 + 0.6 * Math.sin(frame.time * 2.7)));
  }

  return { group, update: (frame) => sways.forEach((s) => s(frame)), dispose: () => disposeTree(group) };
}

/** Points round the neck at height `y`, standing `tube` plus ease off it. */
function neckRing(shape: BodyShape, y: number, tube: number): Vector3[] {
  const r = Math.max(radiusAt(shape, y), radiusAt(shape, y - tube));
  return ringPoints({ y, rx: r + EASE + tube, rz: r * shape.depth + EASE + tube }, shape.squareness, 0, Math.PI * 2, 64);
}

/** The point on the surface at `angle` and height `y`, `ease` off it (front = angle 0). */
function surfacePoint(shape: BodyShape, angle: number, y: number, ease: number): Vector3 {
  const r = radiusAt(shape, y);
  const [x, z] = crossSection(angle, r + ease, r * shape.depth + ease, shape.squareness);
  return new Vector3(x, y, z);
}

/**
 * A panel laid on the front of the body from height `top` down `length`, `halfAngle(v)` radians
 * either side of the front at `v` (0 top .. 1 bottom): a bandana's triangle, a tie's blade.
 */
function taperPanel(shape: BodyShape, top: number, length: number, halfAngle: (v: number) => number, rows: number): BufferGeometry {
  const columns = 9;
  const positions = new Float32Array((rows + 1) * columns * 3);
  for (let i = 0; i <= rows; i++) {
    const v = i / rows;
    const y = top - length * v;
    const half = Math.max(halfAngle(v), 0.002);
    for (let j = 0; j < columns; j++) {
      const p = surfacePoint(shape, -half + (2 * half * j) / (columns - 1), y, EASE);
      positions.set([p.x, p.y, p.z], (i * columns + j) * 3);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < rows; i++) {
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

/** Small dots scattered over a tapering panel, just above it. */
function dots(shape: BodyShape, top: number, length: number, halfAngle: (v: number) => number): BufferGeometry {
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const v = 0.08 + 0.8 * ((i * 0.618034) % 1);
    const half = halfAngle(v);
    const angle = -half + 2 * half * ((i * 0.381966 * 3) % 1);
    const at = surfacePoint(shape, angle, top - length * v, EASE + 0.004);
    return { at, normal: outward(shape, at.x, at.z), spin: i * 0.7 };
  });
  return scatterQuads(pieces, 0.022);
}
