/**
 * Feathered wings for the Cape (`cape.ts` styles 1 and 2), built in the wing's own space: x out to
 * the side, y up, the root at the origin (the cape places it behind the shoulder blades).
 *
 *  - Carnival wings: one great pair, each a fan of feathers in three rows (long primaries outside,
 *    shorter coverts over them), coloured from `colour` to `trim` along the fan, with sequins.
 *  - Wings of light: three pairs (a great upper pair, a middle pair, a small lower pair), each feather
 *    made of light (additive, HDR so it blooms), with motes along the edges; they beat slowly in turn.
 *
 * Each wing hinges at its root: `update` spreads and sweeps it (a sway or a slow beat) by `motion`.
 */
import { Color, DoubleSide, Group, Mesh, MeshPhysicalMaterial, SphereGeometry, type Material } from 'three';
import { lightMaterial } from '../glow-kit.ts';

export interface WingOptions {
  readonly colour: number;
  readonly trim: number;
  readonly glow: number;
  /** Wings of light (three pairs, additive) instead of carnival feathers. */
  readonly light: boolean;
  /** Overall size against a body of width ~0.5 (1 = as designed). */
  readonly scale: number;
}

export interface Wings {
  readonly group: Group;
  /** `time` (s, motion-scaled), `motion` (sway × amplitude), `light` (the glow level now). */
  update(time: number, motion: number, light: number): void;
}

/** One wing: span (length of the longest feather), feathers per row, and its rest spread (radians up from horizontal). */
interface WingSpec {
  readonly span: number;
  readonly feathers: number;
  readonly lift: number;
  readonly y: number;
}

const CARNIVAL: readonly WingSpec[] = [{ span: 2.0, feathers: 15, lift: 0.7, y: 0.05 }];
const SERAPH: readonly WingSpec[] = [
  { span: 1.9, feathers: 12, lift: 0.95, y: 0.16 },
  { span: 1.35, feathers: 10, lift: 0.15, y: -0.02 },
  { span: 0.9, feathers: 8, lift: -0.55, y: -0.2 },
];
/** How far from the root the feathers begin (wing space). */
const ROOT_GAP = 0.1;
/** The rows of a wing: feather length share, spread share across the fan, depth offset. */
const ROWS = [
  { length: 1, spread: 1, z: -0.03, width: 0.085 },
  { length: 0.7, spread: 0.85, z: 0, width: 0.1 },
  { length: 0.42, spread: 0.7, z: 0.03, width: 0.11 },
] as const;

export function buildWings(o: WingOptions): Wings {
  const group = new Group();
  group.name = 'wings';
  const feather = new SphereGeometry(1, 16, 8);
  const sequin = new SphereGeometry(0.018, 8, 6);
  const palette = (k: number): Material =>
    o.light
      ? lightMaterial(new Color(o.colour).lerp(new Color(o.trim), k).getHex(), 0.45 + 0.35 * k, 0.12)
      : feathered(new Color(o.colour).lerp(new Color(o.trim), k), o.glow);
  const shades = [0, 0.33, 0.66, 1].map(palette);
  const spark = lightMaterial(o.light ? 0xffffff : o.trim, 2.5, 0.9);
  const hinges: { hinge: Group; spec: WingSpec; side: number; pair: number }[] = [];

  (o.light ? SERAPH : CARNIVAL).forEach((spec, pair) => {
    for (const side of [-1, 1]) {
      const hinge = new Group();
      hinge.position.set(side * 0.08, spec.y * o.scale, -pair * 0.04);
      group.add(hinge);
      const wing = new Group();
      wing.scale.set(side * o.scale, o.scale, o.scale);
      hinge.add(wing);
      // Light adds up where feathers overlap, so wings of light take only the two outer rows.
      (o.light ? ROWS.slice(0, 2) : ROWS).forEach((row, r) => {
        for (let i = 0; i < spec.feathers; i++) {
          const f = i / (spec.feathers - 1);
          // The fan: from straight out (f=0, longest) round to hanging down (f=1, shortest).
          const angle = spec.lift - f * 1.5 * row.spread;
          const length = spec.span * row.length * (1 - 0.45 * f) * (o.light ? 0.95 : 1);
          const m = new Mesh(feather, shades[Math.min(3, Math.round(f * 2 + r * 0.6))]);
          m.scale.set(length / 2, row.width * (o.light ? 1.3 : 1), 0.012);
          // Feathers start a little out from the root, so they never pile up into one blot of light.
          const start = ROOT_GAP * (1 + f);
          m.position.set(Math.cos(angle) * (start + length * 0.5), Math.sin(angle) * (start + length * 0.5), row.z);
          m.rotation.z = angle;
          wing.add(m);
          if (r === 0 && (o.light || i % 2 === 0)) {
            const s = new Mesh(sequin, spark);
            s.position.set(Math.cos(angle) * (start + length * 0.97), Math.sin(angle) * (start + length * 0.97), row.z + 0.01);
            wing.add(s);
          }
        }
      });
      hinges.push({ hinge, spec, side, pair });
    }
  });

  function update(time: number, motion: number, light: number): void {
    for (const { hinge, side, pair } of hinges) {
      // Carnival: a dancing sway. Light: a slow beat, each pair a little after the one above.
      const beat = o.light ? Math.sin(time * 1.1 - pair * 0.6) * 0.22 : Math.sin(time * 2.2) * 0.12;
      hinge.rotation.z = side * beat * motion;
      hinge.rotation.y = side * (0.18 + 0.1 * Math.sin(time * (o.light ? 1.1 : 1.6) - pair * 0.6) * motion);
    }
    spark.opacity = Math.min(1, 0.5 + 0.3 * light);
    for (const shade of shades) if (o.light) (shade as Material & { opacity: number }).opacity = Math.min(0.16, 0.05 + 0.03 * light);
  }

  return { group, update };
}

/** A vivid feather: the colour kept saturated (a sheen only of its own colour) with a faint glow. */
function feathered(colour: Color, glow: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: colour, roughness: 0.38, sheen: 0.35, sheenColor: colour.clone().multiplyScalar(1.3), sheenRoughness: 0.4, emissive: colour, emissiveIntensity: 0.08 * glow, side: DoubleSide });
}
