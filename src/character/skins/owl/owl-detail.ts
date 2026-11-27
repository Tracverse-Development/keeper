/**
 * The owl's feathers at each level of detail (`../detail-level.ts`): a small owl on screen draws
 * coarser feathers and fewer of them, and skips the finest layer (the facial disc's hair-fine
 * feathers, over a disc of the same cream); a large one draws everything.
 *
 *   featherSet(width, length, lift, cup)  one feather shape cut at each level's grid
 *   followDetail(mesh, watch, detail)     makes one instanced layer follow the watch: each render
 *                                         it draws `share` of its instances (the first ones: the
 *                                         layer stores them in scattered order, so the coat thins
 *                                         evenly) with that level's geometry
 *
 * Thinning is safe because every feather layer lies over a form of the same material (the egg, the
 * breast, the head, the wing), so a gap shows the same colour, only smoother. Pattern: Strategy
 * (the level picks what each layer draws), driven from `onBeforeRender`, where the camera is known.
 */
import type { BufferGeometry, InstancedMesh } from 'three';
import type { DetailLevel, DetailWatch } from '../detail-level.ts';
import { FEATHER_GRID, featherGeometry } from './owl-feathers.ts';

/** How finely a feather is cut at each level (points across and along): 60, 24 and 12 triangles. */
export const FEATHER_GRIDS: Readonly<Record<DetailLevel, { readonly across: number; readonly along: number }>> = {
  light: { across: 4, along: 3 },
  balanced: { across: 5, along: 4 },
  full: FEATHER_GRID,
};

/** Shares of a layer drawn at each level: the coats (body, breast, head, wings), the finest layer, and the few big feathers. */
export const COAT_SHARE: Readonly<Record<DetailLevel, number>> = { light: 0.55, balanced: 0.8, full: 1 };
export const FINE_SHARE: Readonly<Record<DetailLevel, number>> = { light: 0, balanced: 0.6, full: 1 };
export const EVERY_FEATHER: Readonly<Record<DetailLevel, number>> = { light: 1, balanced: 1, full: 1 };

/** One feather shape at every level. */
export type FeatherSet = Readonly<Record<DetailLevel, BufferGeometry>>;

/** What one layer draws at each level. */
export interface FeatherDetail {
  readonly geometries: FeatherSet;
  readonly share: Readonly<Record<DetailLevel, number>>;
}

/** The feather `featherGeometry(width, length, lift, cup)` cut at each level's grid. */
export function featherSet(width: number, length: number, lift: number, cup?: number): FeatherSet {
  return {
    light: featherGeometry(width, length, lift, cup, FEATHER_GRIDS.light),
    balanced: featherGeometry(width, length, lift, cup, FEATHER_GRIDS.balanced),
    full: featherGeometry(width, length, lift, cup, FEATHER_GRIDS.full),
  };
}

/**
 * Makes `mesh` (built with `detail.geometries.full` and all its instances) follow `watch`. The count
 * applies in the same render; a new geometry shows from the next frame (three.js has already listed
 * this frame's), which a level change, held by hysteresis, never makes visible.
 */
export function followDetail(mesh: InstancedMesh, watch: DetailWatch, detail: FeatherDetail): void {
  const total = mesh.count;
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    const level = watch.observe(renderer, camera);
    mesh.count = Math.round(total * detail.share[level]); // 0 draws nothing (three.js skips the call)
    mesh.geometry = detail.geometries[level];
  };
}
