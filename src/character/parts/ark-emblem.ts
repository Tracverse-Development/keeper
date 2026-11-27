/**
 * The Ark Sentinel's shared marks: a shield outline (the chest crest's frame, the kite shield's
 * edge) and the ark-and-waves mark (Umoja Ark's logo, the brand) drawn as thin tubes. Both are
 * flat, in the XY plane, centred on the origin; a part lays them on its own surface.
 *
 * Pure geometry on three.js (no GPU): used by `sentinel-plate` and `kite-shield`.
 */
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { merged } from './detail-kit.ts';

/**
 * A shield's outline, clockwise from the top-left corner: a top edge of `width` arched up by
 * `arch`, then sides that bulge (`belly` below 1 bulges more) and meet in a point `height` below
 * the top. `width` 0.8 x `height` 1 reads as a heater shield; 0.6 x 1 as a kite.
 */
export function shieldOutline(width: number, height: number, arch: number, belly: number, count = 64): Vector3[] {
  const half = width / 2;
  const top = height / 2;
  const across = Math.round(count * 0.3);
  const down = Math.round((count - across) / 2);
  const out: Vector3[] = [];
  for (let i = 0; i < across; i++) {
    const u = -1 + (2 * i) / across;
    out.push(new Vector3(u * half, top + arch * (1 - u * u), 0));
  }
  for (let i = 0; i < down; i++) {
    const v = i / down;
    out.push(new Vector3(half * Math.cos((v * Math.PI) / 2) ** belly, top - v * height, 0));
  }
  out.push(new Vector3(0, top - height, 0));
  for (let i = down - 1; i > 0; i--) {
    const v = i / down;
    out.push(new Vector3(-half * Math.cos((v * Math.PI) / 2) ** belly, top - v * height, 0));
  }
  return out;
}

/** The ark and its waves as thin tubes in the XY plane, about `size` wide: hull, deck, cabin, two waves. */
export function arkMark(size: number): BufferGeometry {
  const hull = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    return new Vector3((t - 0.5) * size * 1.1, size * 0.1 - (1 - (2 * t - 1) ** 2) * size * 0.32, 0);
  });
  const deck = [new Vector3(-size * 0.58, size * 0.14, 0), new Vector3(0, size * 0.1, 0), new Vector3(size * 0.58, size * 0.14, 0)];
  const cabin = [new Vector3(-size * 0.2, size * 0.11, 0), new Vector3(-size * 0.2, size * 0.32, 0), new Vector3(0, size * 0.42, 0), new Vector3(size * 0.2, size * 0.32, 0), new Vector3(size * 0.2, size * 0.11, 0)];
  const waves = [0, 1].map((k) =>
    Array.from({ length: 28 }, (_, i) => {
      const t = i / 27;
      return new Vector3((t - 0.5) * size * (1.3 - k * 0.32), -size * (0.4 + k * 0.17) + Math.sin(t * Math.PI * 4 + k) * size * 0.05, 0);
    }),
  );
  const tube = (points: Vector3[], r: number) => new TubeGeometry(new CatmullRomCurve3(points, false, 'catmullrom', 0.2), points.length * 4, r, 6);
  return merged([tube(hull, size * 0.06), tube(deck, size * 0.05), tube(cabin, size * 0.045), ...waves.map((w) => tube(w, size * 0.045))]);
}
