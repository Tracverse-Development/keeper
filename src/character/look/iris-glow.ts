/**
 * Iris glow: what the `glow` material means on an iris. Painted like any other zone, glow made the
 * whole iris one flat emissive disc that bloomed the eye to white. An iris glows like the
 * references instead: a luminous ring around the pupil, fine radial fibres, a darker limbal rim at
 * the edge, the pupil still dark (it is its own material) and the catchlights kept (their own
 * meshes). The stage's bloom pass turns the bright ring into a soft halo.
 *
 * Pattern: a marker registry (`markIris`) plus a shared lookup texture. The eye builders
 * (`skins/soft-eyes.ts`, `skins/puppy/puppy-eyes.ts`) mark their iris material; `zone-paint.ts`
 * asks `isIris` when it applies the glow preset and, for an iris, uses `IRIS_GLOW` and the radial
 * map below (it multiplies the emissive colour). Every other zone, and every iris that is not set
 * to glow, paints exactly as before.
 *
 * The map is a `DataTexture` (no DOM, so it builds in Node tests too), made once and shared. Its
 * rows follow the iris cap's UV: the caps are partial spheres whose v runs from the pole (the
 * pupil, uv.y = 1) to the cap's rim (uv.y = 0); u runs round the eye (the fibres).
 */
import { DataTexture, LinearFilter, RGBAFormat, RepeatWrapping, UnsignedByteType, type Material } from 'three';

/** Emissive intensity of a glowing iris at the brightest point of its map (above 1 blooms). */
export const IRIS_GLOW = 1.9;
/** The lit (diffuse) colour of a glowing iris, as a share of its colour: dim, so the light it gives
 * stays saturated instead of being washed toward white by the key light. */
export const IRIS_GLOW_BASE = 0.35;

/** Map resolution: around the eye (fibres) and from rim to pupil. */
const MAP_WIDTH = 128;
const MAP_HEIGHT = 64;
/** Brightness at the limbal rim (uv.y 0), where the rim ends, the bright ring near the pupil. */
const RIM_LEVEL = 0.04;
const RIM_END = 0.16;
const BODY_LEVEL = 0.42;
const RING_CENTRE = 0.48;
const RING_WIDTH = 0.16;
/** How much the fibres darken the iris between them (0 none .. 1 black gaps). */
const FIBRE_DEPTH = 0.3;

const irises = new WeakSet<Material>();
let map: DataTexture | null = null;

/** Marks `material` as an iris, so the `glow` material paints it as a luminous iris. */
export function markIris(material: Material): void {
  irises.add(material);
}

export function isIris(material: Material): boolean {
  return irises.has(material);
}

/** The brightness (0..1) of the iris at `v` (0 rim .. 1 pupil) and `u` (0..1 round the eye). */
export function irisLevel(u: number, v: number): number {
  const rim = v < RIM_END ? RIM_LEVEL + (BODY_LEVEL - RIM_LEVEL) * (v / RIM_END) ** 2 : BODY_LEVEL;
  const ring = Math.exp(-(((v - RING_CENTRE) / RING_WIDTH) ** 2));
  const fibres = 0.5 + 0.25 * Math.sin(u * Math.PI * 2 * 37) + 0.25 * Math.sin(u * Math.PI * 2 * 23 + v * 9);
  const level = (rim + (1 - BODY_LEVEL) * ring) * (1 - FIBRE_DEPTH * fibres * (1 - ring * 0.6));
  return Math.min(Math.max(level, 0), 1);
}

/** The shared radial map of a glowing iris (built on first use). */
export function irisGlowMap(): DataTexture {
  if (map) return map;
  const data = new Uint8Array(MAP_WIDTH * MAP_HEIGHT * 4);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const value = Math.round(255 * irisLevel(x / MAP_WIDTH, y / (MAP_HEIGHT - 1)));
      data.set([value, value, value, 255], (y * MAP_WIDTH + x) * 4);
    }
  }
  map = new DataTexture(data, MAP_WIDTH, MAP_HEIGHT, RGBAFormat, UnsignedByteType);
  map.wrapS = RepeatWrapping;
  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;
  return map;
}
