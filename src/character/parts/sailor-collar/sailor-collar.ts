/**
 * The Sailor Collar (slot `neck`, any species with a neck; the dog's Harbour Watch set): the square
 * collar of a ship's crew. A deep square flap lies over the upper back; from its top corners two
 * lapels come round the shoulders and narrow to a V on the chest. Two stripes run round every free
 * edge (down the flap's sides and across its foot, along each lapel), a narrow band hugs the neck,
 * and at the V a neckerchief is tied in a knot with two pointed tails that swing a little.
 *
 * Pattern: Adapter. Everything is cut from the neck's published shape (`fit.ts`) with the draped
 * panels of `drape.ts`: the flap and lapels stand `EASE` off the body (far enough to lie over a
 * jacket or a furred coat), never narrower than the shoulders above them, so it sits the same on a
 * dog's chest, a person's shoulders, the owl's breast and the robot's spirit.
 *
 * Effects: `color` (the collar), `trim` (the stripes), `knot` (the neckerchief) and `sway`.
 */
import { Color, Group, Mesh, SphereGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { disposeTree } from '../../dispose-tree.ts';
import { clothMaterial } from '../cloth.ts';
import { effectColour, effectNumber, type EffectValues } from '../effects.ts';
import type { PartFit } from '../fit.ts';
import { piping, ringPoints } from '../fitted-shell.ts';
import { garmentSway, pushOut } from '../garment.ts';
import { bandPatch, drapeEdge, drapeRings } from '../drape.ts';
import { keepColour, loft, meshAdder, merged } from '../detail-kit.ts';
import type { PartFrame, PartInstance } from '../part';

const EASE = 0.09;
const RINGS = 20;
const COLUMNS = 28;
/** The flap's half-width round the back (radians) and how far down it reaches (share of the neck's span). */
const FLAP_HALF = 1.0;
const FLAP_DROP = 0.76;
/** Where the lapels meet in a V (share of the span), their width there (radians), the neck opening at the top. */
const V_DROP = 0.64;
const V_WIDTH = 0.24;
const OPEN_TOP = 0.62;
/** The stripes: their tube radius, and how far in from an edge each sits (radians round, or height). */
const STRIPE = 0.0075;
const STRIPE_IN: readonly number[] = [0.06, 0.12];
const SWAY = 0.012;

export function createSailorCollar(effects: EffectValues, fit: PartFit): PartInstance {
  const group = new Group();
  group.name = 'sailor-collar';
  const shape = fit.shape;
  if (!shape) return { group, update: () => undefined, dispose: () => disposeTree(group) };

  const cloth = keepColour(clothMaterial(effectColour(effects, 'color'), 0.72));
  const stripe = clothMaterial(effectColour(effects, 'trim'), 0.6);
  const knotColour = effectColour(effects, 'knot');
  const kerchief = clothMaterial(knotColour, 0.45);
  const kerchiefDark = clothMaterial(new Color(knotColour).multiplyScalar(0.7).getHex(), 0.5);
  const sway = effectNumber(effects, 'sway');
  const add = meshAdder(group);
  const sq = shape.squareness;

  const top = shape.profile[0][1] - 0.03;
  const span = top - shape.reach;
  const lowest = shape.profile[shape.profile.length - 1][1] + 0.02;
  const flapBottom = Math.max(top - span * FLAP_DROP, lowest);
  const vY = Math.max(top - span * V_DROP, lowest + 0.02);
  const rings = drapeRings(shape, top, flapBottom, EASE, RINGS, 0);
  const vRow = rings.findIndex((r) => r.y <= vY);
  const lapelRows = rings.slice(0, Math.max(vRow, 3));
  const last = lapelRows.length - 1;

  // The lapels: the inner (front) edge closes from the neck opening to the V; the outer edge runs
  // from the flap's corner round the shoulder down to the V, where the lapel is V_WIDTH wide.
  const inner = (i: number) => OPEN_TOP * (1 - i / last) ** 1.15 + 0.012;
  const outer = (i: number) => {
    const t = i / last;
    return inner(i) + V_WIDTH + (Math.PI - FLAP_HALF - OPEN_TOP - V_WIDTH) * (1 - t) ** 1.6;
  };
  const flapFrom = Math.PI - FLAP_HALF;
  const flapTo = Math.PI + FLAP_HALF;
  const panels: [BufferGeometry, string][] = [
    [bandPatch(lapelRows, sq, inner, outer, COLUMNS), 'collar-lapel'],
    [bandPatch(lapelRows, sq, (i) => Math.PI * 2 - outer(i), (i) => Math.PI * 2 - inner(i), COLUMNS), 'collar-lapel'],
    [bandPatch(rings, sq, () => flapFrom, () => flapTo, COLUMNS * 2), 'collar-flap'],
  ];
  const sways: ((frame: PartFrame) => void)[] = [];
  for (const [geometry, name] of panels) {
    add(pushOut(geometry, shape, EASE * 0.8), cloth, name);
    if (name === 'collar-flap') sways.push(garmentSway(geometry, top, flapBottom, SWAY * sway));
  }
  // A band round the neck where the collar is sewn on.
  const band = rings[0];
  add(piping(ringPoints({ y: band.y + 0.012, rx: band.rx - 0.01, rz: band.rz - 0.01 }, sq, 0, Math.PI * 2, 72), 0.022, true), cloth, 'collar-band');

  // Two stripes round every free edge: down each flap side and across its foot, along each lapel.
  const tubes: BufferGeometry[] = [];
  for (const inset of STRIPE_IN) {
    for (const s of [1, -1]) {
      const along = (f: (i: number) => number) => (i: number) => (s > 0 ? f(i) : Math.PI * 2 - f(i));
      tubes.push(piping(drapeEdge(lapelRows, sq, along((i) => outer(i) - inset), 0.006), STRIPE));
      tubes.push(piping(drapeEdge(rings.slice(1), sq, () => (s > 0 ? flapFrom + inset : flapTo - inset), 0.006), STRIPE));
    }
    const foot = rings[rings.length - 1 - Math.round(inset * 30)];
    tubes.push(piping(ringPoints({ y: foot.y, rx: foot.rx + 0.006, rz: foot.rz + 0.006 }, sq, flapFrom + inset, flapTo - inset, 40), STRIPE));
  }
  add(pushOut(merged(tubes), shape, EASE * 0.8), stripe, 'collar-stripes');

  // The neckerchief at the V: a knot and two pointed tails.
  const v = lapelRows[last];
  const knotZ = v.rz + 0.03;
  add(pushOut(new SphereGeometry(1, 18, 12).scale(0.06, 0.05, 0.04).translate(0, v.y + 0.01, knotZ), shape, EASE), kerchief, 'collar-knot');
  const tails = new Group();
  tails.name = 'collar-tails';
  const pivot = new Vector3(0, v.y - 0.02, knotZ);
  tails.position.copy(pivot);
  group.add(tails);
  const tailLength = Math.min(span * 0.42, Math.max(v.y - lowest, 0.08) + span * 0.1);
  // The tails lie over the chest: each section stands off the front of the body at its own height.
  const front = drapeRings(shape, pivot.y, pivot.y - tailLength, EASE + 0.02, 12, 0.15);
  for (const side of [-1, 1]) {
    const mesh = tail(side, front.map((r) => Math.max(r.rz, knotZ)), tailLength, side > 0 ? kerchief : kerchiefDark);
    mesh.position.set(0, 0, -pivot.z);
    tails.add(mesh);
  }

  return {
    group,
    update(frame: PartFrame) {
      for (const s of sways) s(frame);
      // The tails swing sideways from the knot and lift a little outward, never in.
      const a = frame.motion.amplitude * sway;
      tails.rotation.z = Math.sin(frame.time * 1.6) * 0.06 * a;
      tails.rotation.x = -Math.abs(Math.sin(frame.time * 1.1)) * 0.05 * a;
    },
    dispose: () => disposeTree(group),
  };
}

/** One neckerchief tail: a thin ribbon from the knot down and out, narrowing to a point; `front[k]` is how far forward section k must stand. */
function tail(side: number, front: readonly number[], length: number, material: Material): Mesh {
  const sections = front.map((z, k) => {
    const t = k / (front.length - 1);
    const centre = new Vector3(side * (0.014 + t * 0.06), -t * length, z + 0.008 + t * 0.012);
    const half = 0.034 * (1 - t) ** 0.8 + 0.002;
    const thick = 0.005;
    // Each section a thin rectangle across the ribbon, tilted so the tail fans out.
    const across = new Vector3(Math.cos(side * 0.35), Math.sin(side * 0.35), 0);
    return [
      centre.clone().addScaledVector(across, -half).add(new Vector3(0, 0, thick)),
      centre.clone().addScaledVector(across, half).add(new Vector3(0, 0, thick)),
      centre.clone().addScaledVector(across, half).add(new Vector3(0, 0, -thick)),
      centre.clone().addScaledVector(across, -half).add(new Vector3(0, 0, -thick)),
    ];
  });
  return Object.assign(new Mesh(loft(sections), material), { name: 'collar-tail' });
}
