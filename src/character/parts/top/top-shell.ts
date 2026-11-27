/**
 * The Top kit's building blocks: a body shell whose front opening can change with height (a
 * waistcoat's V, a blazer's straight gap, a tee closed all round), its front edges for piping, and
 * the sleeves and cuffs fitted to the shape's limbs. Sleeves are built in the anchor's space and
 * pushed clear of the torso (`garment.ts` `pushOut`), so where an arm meets the side of the body
 * the sleeve lies on the shell instead of sinking in.
 */
import { BufferAttribute, BufferGeometry, CylinderGeometry, Matrix4, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { clearance, crossSection, radiusAt, type BodyShape, type GarmentRing, type Limb } from '../fit.ts';
import { outward, pushOut } from '../garment.ts';

/** The shell's front gap at ring `i` of `count` (radians, total; 0 = closed). */
export type Opening = (i: number, count: number) => number;

export const closed: Opening = () => 0;
export const straight =
  (gap: number): Opening =>
  () =>
    gap;
/** A V: `top` wide at the neckline, closing to `bottom` by `share` of the way down. */
export const vee =
  (top: number, bottom: number, share: number): Opening =>
  (i, count) => {
    const u = Math.min(i / Math.max(count - 1, 1) / share, 1);
    return top + (bottom - top) * u;
  };

/** A shell through `rings` with a front gap that may change ring by ring. */
export function taperedShell(rings: readonly GarmentRing[], opening: Opening, segments: number, squareness: number): BufferGeometry {
  const columns = segments + 1;
  const positions = new Float32Array(rings.length * columns * 3);
  rings.forEach((ring, i) => {
    const gap = opening(i, rings.length);
    for (let j = 0; j < columns; j++) {
      const angle = gap / 2 + ((Math.PI * 2 - gap) * j) / segments;
      const [x, z] = crossSection(angle, ring.rx, ring.rz, squareness);
      positions.set([x, ring.y, z], (i * columns + j) * 3);
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
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

/** The two front edges of a tapered shell (right then left), top to bottom. */
export function frontEdges(rings: readonly GarmentRing[], opening: Opening, squareness: number): [Vector3[], Vector3[]] {
  const edge = (side: 1 | -1) =>
    rings.map((ring, i) => {
      const gap = opening(i, rings.length);
      const [x, z] = crossSection(side === 1 ? gap / 2 : Math.PI * 2 - gap / 2, ring.rx, ring.rz, squareness);
      return new Vector3(x, ring.y, z);
    });
  return [edge(1), edge(-1)];
}

/**
 * Arms that hang straight down from the shoulder (tilt 0) are held a little away from the body
 * by every rig that has them, so a sleeve opens out by ARM_SPLAY to meet the arm instead of
 * hugging the side (a leg with a tilt, like the puppy's, is followed exactly).
 */
const ARM_SPLAY = 0.15;

/** The transform from a limb's own space (its top at the origin, hanging down -y) to the anchor's. */
function limbMatrix(limb: Limb): Matrix4 {
  const splay = Math.abs(limb.tilt) < 0.05 ? Math.sign(limb.position[0]) * ARM_SPLAY : 0;
  return new Matrix4().makeTranslation(...limb.position).multiply(new Matrix4().makeRotationZ(splay)).multiply(new Matrix4().makeRotationX(limb.tilt));
}

export interface SleeveSpec {
  /** Share of the limb it covers (0 = sleeveless). */
  readonly share: number;
  /** How much wider it is at the cuff (a bell sleeve flares, 0 = straight). */
  readonly flare: number;
  /** The cuff's thickness as a multiple of the piping (a rolled cuff is thick), 0 = no cuff. */
  readonly cuff: number;
  /** A puffed shoulder instead of a tube (the blouse). */
  readonly puff?: boolean;
}

/** Room a sleeve leaves round its limb, and round the torso where the two meet. */
export const SLEEVE_EASE = 0.035;
const TORSO_CLEAR = 0.02;

/** The sleeve tube for `limb` (anchor space), and its cuff ring, both clear of the torso. */
export function sleeveGeometry(limb: Limb, spec: SleeveSpec, shape: BodyShape, piping: number): { tube: BufferGeometry; cuff: BufferGeometry | null } {
  const radius = limb.radius + SLEEVE_EASE;
  const toAnchor = limbMatrix(limb);
  if (spec.puff) {
    const puff = new SphereGeometry(1, 24, 16);
    puff.scale(radius * 1.55, limb.length * spec.share * 0.75, radius * 1.55);
    puff.translate(0, -limb.radius * 0.5 - limb.length * spec.share * 0.45, 0);
    puff.applyMatrix4(toAnchor);
    const band = new TorusGeometry(radius * 1.05, piping * 1.4, 8, 40);
    band.rotateX(Math.PI / 2);
    band.translate(0, -limb.radius * 0.5 - limb.length * spec.share * 1.05, 0);
    band.applyMatrix4(toAnchor);
    return { tube: pushOut(puff, shape, TORSO_CLEAR), cuff: pushOut(band, shape, TORSO_CLEAR) };
  }
  const height = limb.length * spec.share;
  const tube = new CylinderGeometry(radius * 0.98, radius * (1.04 + spec.flare), height, 28, 6, true);
  tube.translate(0, -limb.radius * 0.5 - height / 2, 0);
  tube.applyMatrix4(toAnchor);
  let cuff: BufferGeometry | null = null;
  if (spec.cuff > 0) {
    cuff = new TorusGeometry(radius * (1.04 + spec.flare), piping * spec.cuff, 8, 40);
    cuff.rotateX(Math.PI / 2);
    cuff.translate(0, -limb.radius * 0.5 - height, 0);
    cuff.applyMatrix4(toAnchor);
    pushOut(cuff, shape, TORSO_CLEAR);
  }
  return { tube: pushOut(tube, shape, TORSO_CLEAR), cuff };
}

/**
 * Moves a whole piece (a button, a pocket square) straight out from the body until every vertex
 * stands `ease` off it, keeping its shape (heights with no surface do not hold it back).
 */
export function onSurface(geometry: BufferGeometry, shape: BodyShape, ease: number): BufferGeometry {
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox!.getCenter(new Vector3());
  const out = outward(shape, centre.x, centre.z);
  const position = geometry.getAttribute('position');
  for (let pass = 0; pass < 8; pass++) {
    let worst = Infinity;
    for (let i = 0; i < position.count; i++) {
      const r = radiusAt(shape, position.getY(i));
      if (r <= 1e-6) continue;
      worst = Math.min(worst, clearance(shape, position.getX(i), position.getY(i), position.getZ(i)) * r);
    }
    if (worst >= ease) break;
    geometry.translate(out.x * (ease - worst + 0.002), 0, out.z * (ease - worst + 0.002));
  }
  return geometry;
}
