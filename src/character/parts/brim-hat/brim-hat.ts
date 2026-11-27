/**
 * The Brimmed Hat (slot `head`, any species with a head): a hat with a brim, shaped to the head.
 *
 * Pattern: Adapter (with the style as a small Strategy table). Every style reads the head's
 * published dome (`head-wear.ts`, `fit.ts`): the crown rises from the head's own rim with a little
 * ease, so it sits ON the robot's pearl dome, the dog's skull, a person's hair and the owl's round
 * head alike, and the brim grows out of that rim. It rides the head bone.
 *
 * Styles (`style`, a whole number; anything else is clamped):
 *  0 fedora     a pinched crown with a dark band, the brim snapped down at the front and up behind
 *  1 wide brim  a low canvas crown and a broad, gently drooping brim all round
 *  2 boater     a flat-topped straw crown with woven rings and a flat, level brim
 *  3 sun visor  no crown at all: a band round the head and a long curved bill at the front
 *
 * Effects: `color` (the crown, or the visor's bill) and `trim` (the band). Hats keep still: a hat
 * that wobbles looks loose.
 */
import { Group, Mesh, type BufferGeometry, type MeshPhysicalMaterial } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial, trimMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { GarmentRing, PartFit } from '../fit.ts';
import { fittedShell, piping, ringPoints } from '../fitted-shell.ts';
import type { PartInstance } from '../part';
import { brimGeometry, hatCrown, headOf, headRing, type Head } from './head-wear.ts';

const STYLES = 4;
const EASE = 0.03;
const SEGMENTS = 72;
/** The band round the crown: its height above the rim and its piping. */
const BAND_HEIGHT = 0.16;
const BAND_PIPING = 0.012;

interface Style {
  /** The crown's rise above the head (share of the head's width), its taper and the pinch on top. */
  readonly lift: number;
  readonly taper: number;
  readonly dent: number;
  /** The brim's length (share of the head's width) at the front and at the back. */
  readonly front: number;
  readonly back: number;
  /** How the brim's edge rises (+) or droops (-) at the front and at the back, per unit of length. */
  readonly frontLift: number;
  readonly backLift: number;
  /** How rough the cloth reads (canvas and straw are matte). */
  readonly roughness: number;
}

const HATS: readonly Style[] = [
  { lift: 0.16, taper: 0.22, dent: 0.07, front: 0.55, back: 0.45, frontLift: -0.36, backLift: 0.3, roughness: 0.82 },
  { lift: 0.1, taper: 0.12, dent: 0.02, front: 0.85, back: 0.78, frontLift: -0.3, backLift: -0.22, roughness: 0.92 },
  { lift: 0.12, taper: 0, dent: 0, front: 0.5, back: 0.5, frontLift: -0.05, backLift: -0.05, roughness: 0.95 },
];
/** The sun visor's band height and its bill (length as a share of the head's width, the arc it spans, its droop). */
const VISOR_BAND = 0.14;
const VISOR_BILL = 0.6;
const VISOR_SPAN = 1.15;
const VISOR_DROOP = -0.32;
/** The boater's woven rings: how many, and how far the straw stands out of the crown. */
const WEAVE_RINGS = 5;
const WEAVE_PIPING = 0.006;

export function createBrimHat(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'brim-hat';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const style = Math.min(Math.max(Math.round(effectNumber(effects, 'style')), 0), STYLES - 1);
  const head = headOf(shape);
  const trim = trimMaterial(effectColour(effects, 'trim'));
  if (style === 3) {
    buildVisor(group, head, clothMaterial(effectColour(effects, 'color'), 0.7), trim);
  } else {
    const spec = HATS[style];
    const cloth = clothMaterial(effectColour(effects, 'color'), spec.roughness);
    buildHat(group, head, spec, cloth, trim, style === 2);
  }
  return { group, pivotY: head.rim, update: () => undefined, dispose: () => disposeTree(group) };
}

function buildHat(group: Group, head: Head, spec: Style, cloth: MeshPhysicalMaterial, trim: MeshPhysicalMaterial, woven: boolean): void {
  const { shape, width } = head;
  const rings = hatCrown(head, EASE, spec.lift * width, spec.taper, spec.dent * width);
  group.add(named(new Mesh(fittedShell(rings, { segments: SEGMENTS, opening: 0, squareness: shape.squareness }), cloth), 'hat-crown'));

  const rim = rings[rings.length - 1];
  // The band: a short shell just outside the crown's lowest rings, piped top and bottom.
  const bandRings = [head.rim + BAND_HEIGHT * width, head.rim].map((y) => {
    const crown = crownAt(rings, y);
    return { y, rx: crown.rx + BAND_PIPING, rz: crown.rz + BAND_PIPING };
  });
  group.add(named(new Mesh(fittedShell(bandRings, { segments: SEGMENTS, opening: 0, squareness: shape.squareness }), trim), 'hat-band'));
  if (woven) {
    for (let i = 1; i <= WEAVE_RINGS; i++) {
      const y = bandRings[0].y + ((rings[3].y - bandRings[0].y) * i) / (WEAVE_RINGS + 1);
      const crown = crownAt(rings, y);
      const ring = { y, rx: crown.rx + WEAVE_PIPING * 0.5, rz: crown.rz + WEAVE_PIPING * 0.5 };
      group.add(named(new Mesh(piping(ringPoints(ring, shape.squareness, 0, Math.PI * 2, 64), WEAVE_PIPING, true), cloth), 'hat-weave'));
    }
  }

  const reach = (angle: number) => width * (spec.back + (spec.front - spec.back) * (0.5 + 0.5 * Math.cos(angle)));
  const lift = (angle: number, u: number) => {
    const front = 0.5 + 0.5 * Math.cos(angle);
    return (spec.backLift + (spec.frontLift - spec.backLift) * front) * u * u;
  };
  group.add(named(new Mesh(brimGeometry(rim, shape.squareness, Math.PI, reach, lift), cloth), 'hat-brim'));
  // A rolled edge round the brim (the straw's binding, the felt's edge).
  const edge = brimEdge(rim, shape.squareness, reach, lift);
  group.add(named(new Mesh(edge, woven ? trim : cloth), 'hat-brim-edge'));
}

function buildVisor(group: Group, head: Head, cloth: MeshPhysicalMaterial, trim: MeshPhysicalMaterial): void {
  const { shape, width } = head;
  const band = [head.rim + VISOR_BAND * width, head.rim].map((y) => headRing(head, y, EASE));
  group.add(named(new Mesh(fittedShell(band, { segments: SEGMENTS, opening: 0, squareness: shape.squareness }), trim), 'visor-band'));
  const rim = band[1];
  const reach = (angle: number) => width * VISOR_BILL * Math.cos((angle / VISOR_SPAN) * (Math.PI / 2)) ** 0.6;
  const lift = (_angle: number, u: number) => VISOR_DROOP * u * u;
  group.add(named(new Mesh(brimGeometry(rim, shape.squareness, VISOR_SPAN, reach, lift), cloth), 'visor-bill'));
  group.add(named(new Mesh(piping(ringPoints(band[0], shape.squareness, 0, Math.PI * 2, 64), BAND_PIPING, true), cloth), 'visor-piping'));
}

/** The crown ring at height `y` (between two of its rings). */
function crownAt(rings: readonly GarmentRing[], y: number): GarmentRing {
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    if ((y <= a.y && y >= b.y) || (y >= a.y && y <= b.y)) {
      const t = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y);
      return { y, rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t };
    }
  }
  return { ...rings[rings.length - 1], y };
}

/** A thin rolled edge along the brim's outer edge. */
function brimEdge(rim: GarmentRing, squareness: number, reach: (a: number) => number, lift: (a: number, u: number) => number): BufferGeometry {
  const points = ringPoints(rim, squareness, 0, Math.PI * 2, 96).map((p, i) => {
    const angle = (i / 95) * Math.PI * 2;
    const out = Math.hypot(p.x, p.z) || 1;
    const length = reach(angle);
    return p.set(p.x + (p.x / out) * length, rim.y + lift(angle, 1) * length, p.z + (p.z / out) * length);
  });
  return piping(points.slice(0, -1), BAND_PIPING * 0.9, true);
}

function named(mesh: Mesh, name: string): Mesh {
  mesh.name = name;
  return mesh;
}
