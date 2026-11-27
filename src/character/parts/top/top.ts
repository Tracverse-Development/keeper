/**
 * The Top kit (slot `torso`, any species with a torso): one factory, eleven garments, picked by the
 * `style` effect:
 *
 *   0 crew tee        short sleeves, a ribbed crew neck
 *   1 shirt           a stand collar, a button placket, sleeves rolled to the elbow
 *   2 zip hoodie      long sleeves with rib cuffs, the hood down at the back, a zip, a front pocket
 *   3 knit sweater    chunky knit ridges, a rolled neck, rib bands at the hem and cuffs
 *   4 tailored blazer open front with lapels, two buttons, a pocket square in the trim colour
 *   5 hi-vis vest     sleeveless, a zip, reflective bands over the shoulders and round the body
 *   6 waistcoat       sleeveless, a deep V, a row of buttons, piped edges
 *   7 sequin costume  sleeveless, covered in sequins that glint in turn
 *   8 robot plating   metal plates with glowing engraved lines and a star-chart emblem
 *   9 blouse          puffed short sleeves, a ruffled neckline, a flared peplum hem
 *  10 robe            falls to the feet, wide bell sleeves, a sash and a gold hem
 *
 * Pattern: Adapter (like the Ark Jacket): it reads the torso's published shape (`fit.ts`), never
 * the species. The shell follows the body's rings with a little ease from the neckline to the
 * shape's reach (the robe falls on below it, flaring: `garment.ts` `longRings`); sleeves wrap only
 * the limbs the shape lists, so the robot gets none. Every detail is laid on the surface and
 * pushed clear of it. Effects: `color` (cloth or plate), `trim` (piping, buttons, stripes, sequins,
 * engraving), `glow` (how much the trim lights up and the sequins glint), `style`.
 */
import { BoxGeometry, Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, TorusGeometry, Vector3, type BufferAttribute, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import { crossSection, garmentRings, radiusAt, type BodyShape, type GarmentRing, type PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, glowTrim, hemOf, longRings, outward, patch, pushOut, scatterQuads, waistOf } from '../garment.ts';
import { necklineOf } from '../jacket/jacket.ts';
import { followLimbs } from '../limb-follow.ts';
import type { PartFrame, PartInstance } from '../part';
import { closed, frontEdges, onSurface, sleeveGeometry, straight, taperedShell, vee, type Opening, type SleeveSpec } from './top-shell.ts';

const EASE = 0.045;
const RINGS = 24;
const SEGMENTS = 64;
const PIPING = 0.011;
const SWAY = 0.012;
const STYLE_COUNT = 11;
/** The least any detail stands off the body. */
const DETAIL_CLEAR = 0.004;
const HOOD_TUBE = 0.09;
const SEQUIN = 0.026;

interface TopStyle {
  readonly opening: Opening;
  readonly sleeve: SleeveSpec;
  /** Extra hem flare (the peplum), and whether it falls to the feet (the robe). */
  readonly flare: number;
  readonly long?: boolean;
  /** Plate metal instead of cloth (the robot plating). */
  readonly metal?: boolean;
}

const NONE: SleeveSpec = { share: 0, flare: 0, cuff: 0 };
const STYLES: readonly TopStyle[] = [
  { opening: closed, sleeve: { share: 0.32, flare: 0.04, cuff: 1.3 }, flare: 0.015 },
  { opening: closed, sleeve: { share: 0.55, flare: 0.05, cuff: 2.6 }, flare: 0.02 },
  { opening: closed, sleeve: { share: 0.88, flare: 0, cuff: 2.2 }, flare: 0.01 },
  { opening: closed, sleeve: { share: 0.88, flare: 0.02, cuff: 2.8 }, flare: 0.01 },
  { opening: straight(0.55), sleeve: { share: 0.88, flare: 0.02, cuff: 1.2 }, flare: 0.03 },
  { opening: closed, sleeve: NONE, flare: 0.02 },
  { opening: vee(1.3, 0.06, 0.5), sleeve: NONE, flare: 0.01 },
  { opening: closed, sleeve: NONE, flare: 0.02 },
  { opening: closed, sleeve: NONE, flare: 0.005, metal: true },
  { opening: closed, sleeve: { share: 0.34, flare: 0, cuff: 1, puff: true }, flare: 0.09 },
  { opening: closed, sleeve: { share: 0.92, flare: 0.75, cuff: 1.6 }, flare: 0, long: true },
];

export function createTop(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'top';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const styleId = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLE_COUNT - 1);
  const style = STYLES[styleId];
  const colour = effectColour(effects, 'color');
  const trimColour = effectColour(effects, 'trim');
  const glow = effectNumber(effects, 'glow');
  const cloth = style.metal ? plateMaterial(colour) : clothMaterial(colour, styleId === 3 ? 0.9 : 0.78);
  if (style.long) Object.assign(cloth, { emissive: new Color(colour), emissiveIntensity: 0.03 * glow });
  const trim = glow > 0 && (styleId === 5 || styleId >= 7) ? glowTrim(trimColour, glow) : trimMaterial(trimColour);

  const top = necklineOf(shape);
  const rings = bodyRings(shape, top, style);
  const geometry = taperedShell(rings, style.opening, SEGMENTS, shape.squareness);
  if (styleId === 3) knitRidges(geometry);
  const shell = new Mesh(geometry, cloth);
  shell.name = 'top-shell';
  group.add(shell);
  // Every detail is finally pushed clear of the body (a thick rolled neck below the neckline, where
  // the chest widens, would otherwise sink into it).
  const add = (g: BufferGeometry, material: Material, name: string) => group.add(Object.assign(new Mesh(pushOut(g, shape, DETAIL_CLEAR), material), { name }));

  for (const limb of shape.limbs ?? []) {
    if (style.sleeve.share <= 0) break;
    const { tube, cuff } = sleeveGeometry(limb, style.sleeve, shape, PIPING);
    add(tube, cloth, 'top-sleeve');
    if (cuff) add(cuff, styleId === 1 || styleId === 3 ? cloth : trim, 'top-cuff');
  }

  const ctx: Detail = { shape, rings, top, style, cloth, trim, add };
  DETAILS[styleId](ctx);
  const sparkle = styleId === 7 ? sequins(ctx, glow) : null;

  const sway = garmentSway(geometry, top, rings[rings.length - 1].y, SWAY * (style.long ? 2 : 1));
  const followSleeves = followLimbs(group, shape, fit);
  function update(frame: PartFrame): void {
    sway(frame);
    followSleeves();
    if (sparkle) sparkle.emissiveIntensity = glow * (0.1 + 0.08 * Math.sin(frame.time * 3.1) * Math.sin(frame.time * 1.7));
  }
  return { group, update, dispose: () => disposeTree(group) };
}

/** The shell's rings: the body's own from the neckline to the reach (or to the feet for the robe). */
function bodyRings(shape: BodyShape, top: number, style: TopStyle): GarmentRing[] {
  if (style.long) {
    const waistY = waistOf(shape);
    return longRings(shape, top, hemOf(shape, 0.85), EASE, 34, radiusAt(shape, waistY) + EASE, 0.4);
  }
  return garmentRings(shape, top, shape.reach, EASE, RINGS).map((ring, i) => {
    const flare = style.flare * (i / (RINGS - 1)) ** 3;
    return { y: ring.y, rx: ring.rx + flare, rz: ring.rz + flare };
  });
}

/** What a style draws besides the shell and sleeves. */
interface Detail {
  readonly shape: BodyShape;
  readonly rings: readonly GarmentRing[];
  readonly top: number;
  readonly style: TopStyle;
  readonly cloth: Material;
  readonly trim: Material;
  add(geometry: BufferGeometry, material: Material, name: string): void;
}

const lift = (ring: GarmentRing, by: number): GarmentRing => ({ y: ring.y, rx: ring.rx + by, rz: ring.rz + by });
/** The ring at a share `u` (0 neckline .. 1 hem) of the shell. */
const ringAt = (d: Detail, u: number): GarmentRing => d.rings[Math.round(u * (d.rings.length - 1))];
const neckRing = (d: Detail, thick: number) => piping(ringPoints(lift(d.rings[0], thick * 0.6), d.shape.squareness, 0, Math.PI * 2, 64), thick, true);
const hemRing = (d: Detail, thick: number) => piping(ringPoints(lift(d.rings[d.rings.length - 1], thick * 0.6), d.shape.squareness, 0, Math.PI * 2, 64), thick, true);

/** A small part laid on the shell at angle `angle` and share `u` of the way down. */
function onShell(d: Detail, geometry: BufferGeometry, angle: number, u: number, ease: number): BufferGeometry {
  const ring = ringAt(d, u);
  const [x, z] = crossSection(angle, ring.rx, ring.rz, d.shape.squareness);
  const n = outward(d.shape, x, z);
  geometry.lookAt(n);
  geometry.translate(x, ring.y, z);
  return onSurface(geometry, d.shape, EASE + ease);
}

function buttons(d: Detail, angle: number, from: number, to: number, count: number, size: number): void {
  for (let i = 0; i < count; i++) {
    const u = from + ((to - from) * i) / Math.max(count - 1, 1);
    d.add(onShell(d, new SphereGeometry(size, 12, 8).scale(1, 1, 0.5), angle, u, 0.006), d.trim, 'top-button');
  }
}

/** A panel over `[from, to]` radians between shares `u0` and `u1`, `ease` above the shell. */
function panel(d: Detail, from: number, to: number, u0: number, u1: number, ease: number): BufferGeometry {
  const a = Math.round(u0 * (d.rings.length - 1));
  const b = Math.round(u1 * (d.rings.length - 1));
  return patch(d.rings.slice(a, b + 1).map((r) => lift(r, ease)), d.shape.squareness, from, to, 16);
}

/** A band round the whole shell at share `u`, `width` tall. */
function band(d: Detail, u: number, width: number, ease: number): BufferGeometry {
  const ring = ringAt(d, u);
  const rings = [-0.5, 0.5].map((k) => {
    const y = ring.y + k * width;
    const r = Math.max(radiusAt(d.shape, y), 0.01);
    return { y, rx: Math.max(ring.rx, r + EASE) + ease, rz: Math.max(ring.rz, r * d.shape.depth + EASE) + ease };
  });
  return patch(rings, d.shape.squareness, 0, Math.PI * 2, 64);
}

const DETAILS: readonly ((d: Detail) => void)[] = [
  // 0 tee: a ribbed crew neck.
  (d) => d.add(neckRing(d, PIPING * 1.6), d.trim, 'top-neck'),
  // 1 shirt: a stand collar, the placket and its buttons.
  (d) => {
    const collar = [0, 1, 2].map((i) => ({ y: d.top + 0.03 * i, rx: d.rings[0].rx + 0.006 * i, rz: d.rings[0].rz + 0.006 * i }));
    d.add(patch(collar, d.shape.squareness, 0.16, Math.PI * 2 - 0.16, 48), d.cloth, 'top-collar');
    d.add(panel(d, -0.07, 0.07, 0, 1, 0.004), d.cloth, 'top-placket');
    buttons(d, 0, 0.1, 0.9, 5, 0.016);
  },
  // 2 hoodie: the hood down at the back, a zip, a pocket.
  (d) => {
    const ring = d.rings[0];
    // A half ring lying round the back of the neck (the arc turned to -z), its back edge raised.
    const hood = new TorusGeometry(ring.rx * 0.8, HOOD_TUBE, 12, 40, Math.PI);
    hood.rotateX(-Math.PI / 2 + 0.3);
    hood.scale(1, 1, ring.rz / ring.rx);
    hood.translate(0, d.top + 0.04, 0);
    d.add(pushOut(hood, d.shape, EASE + 0.02), d.cloth, 'top-hood');
    d.add(piping(frontEdges(d.rings, closed, d.shape.squareness)[0].map((p) => p.multiplyScalar(1.004)), PIPING * 0.9), d.trim, 'top-zip');
    d.add(panel(d, -0.75, 0.75, 0.62, 0.92, 0.006), d.cloth, 'top-pocket');
    d.add(hemRing(d, PIPING * 1.8), d.cloth, 'top-rib');
  },
  // 3 sweater: a rolled neck and a rib band at the hem.
  (d) => {
    d.add(neckRing(d, 0.034), d.cloth, 'top-roll');
    d.add(band(d, 0.97, 0.05, 0.008), d.cloth, 'top-rib');
  },
  // 4 blazer: lapels, two buttons, a pocket square.
  (d) => {
    const gap = 0.55;
    for (const side of [1, -1]) {
      const from = side === 1 ? gap / 2 : Math.PI * 2 - gap / 2 - 0.42;
      d.add(panel(d, from, from + 0.42, 0, 0.42, 0.008), d.cloth, 'top-lapel');
      const edge = d.rings.slice(0, Math.round(0.42 * (d.rings.length - 1)) + 1).map((r) => {
        const [x, z] = crossSection(side === 1 ? from + 0.42 : from, r.rx + 0.009, r.rz + 0.009, d.shape.squareness);
        return new Vector3(x, r.y, z);
      });
      d.add(piping(edge, PIPING * 0.7), d.trim, 'top-lapel-edge');
    }
    buttons(d, gap / 2 + 0.08, 0.58, 0.74, 2, 0.02);
    d.add(onShell(d, new BoxGeometry(0.07, 0.045, 0.012), -0.75, 0.22, 0.004), d.trim, 'top-pocket-square');
  },
  // 5 hi-vis vest: a zip, two bands round the body, two over the shoulders.
  (d) => {
    d.add(piping(frontEdges(d.rings, closed, d.shape.squareness)[0].map((p) => p.multiplyScalar(1.004)), PIPING), d.trim, 'top-zip');
    for (const u of [0.55, 0.8]) d.add(band(d, u, 0.05, 0.006), d.trim, 'top-band');
    for (const a of [0.45, -0.45]) d.add(panel(d, a - 0.1, a + 0.1, 0, 0.55, 0.005), d.trim, 'top-strap');
  },
  // 6 waistcoat: piped V and hem, a row of buttons.
  (d) => {
    for (const edge of frontEdges(d.rings, d.style.opening, d.shape.squareness)) d.add(piping(edge.map((p) => p.multiplyScalar(1.006)), PIPING), d.trim, 'top-edge');
    d.add(hemRing(d, PIPING), d.trim, 'top-hem');
    buttons(d, 0.08, 0.55, 0.92, 4, 0.016);
  },
  // 7 sequins: drawn by `sequins` (they glint each frame); a piped neck.
  (d) => d.add(neckRing(d, PIPING), d.trim, 'top-neck'),
  // 8 plating: engraved glowing lines and an emblem.
  (d) => {
    for (const u of [0.3, 0.62, 0.95]) d.add(piping(ringPoints(lift(ringAt(d, u), 0.006), d.shape.squareness, 0, Math.PI * 2, 64), PIPING * 0.6, true), d.trim, 'top-engraving');
    d.add(piping(frontEdges(d.rings, closed, d.shape.squareness)[0].map((p) => p.multiplyScalar(1.01)), PIPING * 0.6), d.trim, 'top-engraving');
    d.add(onShell(d, new TorusGeometry(0.08, PIPING * 0.9, 8, 40), 0, 0.42, 0.004), d.trim, 'top-emblem');
    d.add(neckRing(d, PIPING * 1.4), d.cloth, 'top-neck');
  },
  // 9 blouse: a ruffled neckline.
  (d) => {
    const points = ringPoints(lift(d.rings[0], 0.012), d.shape.squareness, 0, Math.PI * 2, 96).map((p, i) => p.setY(p.y + 0.012 * Math.sin(i * 1.3)));
    d.add(piping(points, PIPING * 2, true), d.trim, 'top-ruffle');
  },
  // 10 robe: a gold neckline, sash and hem.
  (d) => {
    d.add(neckRing(d, PIPING * 1.8), d.trim, 'top-neck');
    d.add(band(d, (d.rings.findIndex((r) => r.y <= waistOf(d.shape)) || 1) / (d.rings.length - 1), 0.06, 0.006), d.trim, 'top-sash');
    d.add(hemRing(d, PIPING * 2.4), d.trim, 'top-hem');
  },
];

/** Sequins over the whole shell, each tilted a little so they catch the light in turn. */
function sequins(d: Detail, glow: number): MeshPhysicalMaterial {
  const pieces: { at: Vector3; normal: Vector3; spin: number }[] = [];
  for (let i = 1; i < d.rings.length - 1; i++) {
    const ring = lift(d.rings[i], 0.006);
    const count = Math.round((ring.rx * 2 * Math.PI) / 0.05);
    for (let j = 0; j < count; j++) {
      const angle = ((j + (i % 2) * 0.5) / count) * Math.PI * 2;
      const [x, z] = crossSection(angle, ring.rx, ring.rz, d.shape.squareness);
      const normal = outward(d.shape, x, z).add(new Vector3(0, Math.sin(i * 7.1 + j * 3.3) * 0.35, 0)).normalize();
      pieces.push({ at: new Vector3(x, ring.y, z), normal, spin: (i * 13 + j * 7) % 6 });
    }
  }
  const material = glowTrim(effectColourOf(d.trim), glow);
  material.metalness = 0.9;
  material.roughness = 0.15;
  d.add(pushOut(scatterQuads(pieces, SEQUIN), d.shape, EASE + 0.003), material, 'top-sequins');
  return material;
}

const effectColourOf = (m: Material): number => ((m as MeshPhysicalMaterial).color?.getHex() ?? 0xffffff);

/** Brushed plate metal for the robot plating. */
function plateMaterial(colour: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: colour, metalness: 0.75, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, side: DoubleSide });
}

/** Chunky knit: ridges running down the shell, only ever outward. */
function knitRidges(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const k = 1 + 0.008 * (0.5 + 0.5 * Math.cos(Math.atan2(x, z) * 44));
    position.setX(i, x * k);
    position.setZ(i, z * k);
  }
  geometry.computeVertexNormals();
}
