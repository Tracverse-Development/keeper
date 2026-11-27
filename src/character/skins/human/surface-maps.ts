/**
 * Procedural surface maps for the people (and the God Keeper built on them): small textures made
 * from numbers, never image files, so detail costs no download and no DOM (a `DataTexture`).
 *
 *   strandBump    hair strands running along the texture's v (a sphere's crown-to-nape lines):
 *                 bundles of fine strands, each a little brighter or darker, gently wavy
 *   stippleAlpha  a dot field whose density falls from v = 1 to v = 0: a fade haircut, a beard edge
 *   coilBump      tight round coils (natural hair seen up close)
 *   engraving     scrollwork lines and rows of dots (the God Keeper's gold mask and plates)
 *   panelBump     panel seams and screw heads on a grid (the robot's shell)
 *
 * Each is made once per process and shared (textures are cheap to re-upload if a disposed skin
 * freed one). Pattern: Flyweight. Pure numbers; tested only by eye (screenshots).
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, type Texture } from 'three';

/** Texture size (square): enough for strand detail at stage size, small on the GPU. */
const SIZE = 256;

/** A small deterministic random (mulberry32), so every keeper's hair is the same each run. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(fill: (x: number, y: number) => [number, number]): Texture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [value, alpha] = fill(x, y);
      const k = (y * SIZE + x) * 4;
      const v = Math.round(Math.min(Math.max(value, 0), 1) * 255);
      data[k] = v;
      data[k + 1] = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
      data[k + 2] = v;
      data[k + 3] = 255;
    }
  }
  const t = new DataTexture(data, SIZE, SIZE, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, Texture>();
function cached(key: string, make: () => Texture): Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Hair strands along v: `strands` across the texture, in bundles that catch the light together. */
export function strandBump(strands = 140): Texture {
  return cached(`strand-${strands}`, () => {
    const rnd = random(11);
    const bundle = Array.from({ length: 24 }, () => 0.55 + 0.45 * rnd());
    const fine = Array.from({ length: strands }, () => rnd());
    return texture((x, y) => {
      const v = y / SIZE;
      // Gently wavy: each strand drifts sideways along its length.
      const u = x / SIZE + 0.012 * Math.sin(v * 9 + fine[Math.floor((x / SIZE) * strands) % strands] * 6);
      const s = ((u % 1) + 1) % 1;
      const i = Math.floor(s * strands);
      const across = s * strands - i;
      const groove = Math.sin(across * Math.PI) ** 0.6;
      return [groove * (0.6 + 0.4 * fine[i]) * bundle[Math.floor(s * bundle.length)], 1];
    });
  });
}

/**
 * A dot field whose density falls from v = 1 (solid) to v = 0 (bare) along `power`: with
 * `alphaTest` 0.5 the edge breaks up into single hairs (a fade, a beard line).
 */
export function stippleAlpha(power = 1.4): Texture {
  return cached(`stipple-${power}`, () => {
    const rnd = random(23);
    return texture((_, y) => {
      const keep = (y / SIZE) ** power;
      return [0.5, rnd() < keep ? 1 : 0];
    });
  });
}

/** Tight round coils: a field of small rings (natural hair up close). */
export function coilBump(): Texture {
  return cached('coil', () => {
    const rnd = random(37);
    const cell = 16;
    const offsets = Array.from({ length: (SIZE / cell) ** 2 }, () => [rnd() * 0.5 + 0.25, rnd() * 0.5 + 0.25, 0.25 + rnd() * 0.15] as const);
    return texture((x, y) => {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const [ox, oy, r] = offsets[cy * (SIZE / cell) + cx];
      const dx = x / cell - cx - ox;
      const dy = y / cell - cy - oy;
      const ring = Math.abs(Math.hypot(dx, dy) - r);
      return [Math.max(0, 1 - ring * 9), 1];
    });
  });
}

/** Scrollwork: rows of curling lines and dotted borders, for engraved gold. */
export function engraving(): Texture {
  return cached('engraving', () =>
    texture((x, y) => {
      const u = x / SIZE;
      const v = y / SIZE;
      // Curls: a wave of arcs, two rows per tile, offset.
      const row = Math.floor(v * 4);
      const local = v * 4 - row;
      const curl = Math.abs(Math.sin((u * 6 + row * 0.5) * Math.PI) * 0.35 + 0.5 - local);
      const line = Math.max(0, 1 - curl * 18);
      // Dotted borders between the rows.
      const border = local < 0.06 ? Math.max(0, 1 - Math.hypot(((u * 48) % 1) - 0.5, local / 0.06 - 0.5) * 3) : 0;
      return [1 - 0.8 * Math.max(line, border), 1];
    }),
  );
}

/** Panel seams on a grid with a screw head near each corner (the robot's shell). */
export function panelBump(): Texture {
  return cached('panel', () =>
    texture((x, y) => {
      const u = (x / SIZE) * 2;
      const v = (y / SIZE) * 2;
      const fu = u % 1;
      const fv = v % 1;
      const seam = Math.min(fu, 1 - fu, fv, 1 - fv);
      const groove = seam < 0.012 ? 0 : seam < 0.025 ? (seam - 0.012) / 0.013 : 1;
      let screw = 1;
      for (const [sx, sy] of [[0.07, 0.07], [0.93, 0.07], [0.07, 0.93], [0.93, 0.93]]) {
        const d = Math.hypot(fu - sx, fv - sy);
        if (d < 0.03) screw = Math.abs(fu - sx) < 0.005 || Math.abs(fv - sy) < 0.005 ? 0.4 : 1.15 - d * 5;
      }
      return [Math.min(groove, 1) * Math.min(screw, 1.15), 1];
    }),
  );
}
