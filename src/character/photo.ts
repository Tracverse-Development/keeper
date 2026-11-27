/**
 * Photo mode's measurements, pure and node-tested: how big a still of the keeper is drawn.
 * `create-character.ts` `Character.photo` draws it (offscreen size, then the stage is restored).
 *
 * A photo is asked for in CSS pixels (`width` × `height`, its shape) and drawn `scale` times
 * finer (2 = twice the screen's usual density). The result never exceeds what the GPU can draw
 * (`maxSide`, its largest texture side) nor `PHOTO_MAX_SIDE`: the density gives way first, then
 * the size, and the shape is kept.
 *
 * Usage:
 *   const size = photoSize({ width: 1080, height: 1350, scale: 2 }, renderer.capabilities.maxTextureSize);
 *   stage.resize(size.width, size.height, size.ratio, 'portrait');
 */

/** What `Character.photo` is asked for. */
export interface PhotoRequest {
  /** The photo's width and height in CSS pixels (its shape). */
  readonly width: number;
  readonly height: number;
  /** Pixels per CSS pixel (default 2). */
  readonly scale?: number;
}

/** The size a photo is drawn at: CSS pixels and the pixel ratio (pixels = css × ratio). */
export interface PhotoSize {
  readonly width: number;
  readonly height: number;
  readonly ratio: number;
}

/** The largest photo side drawn, in pixels, whatever the GPU allows (a 4:5 photo at 2× is 2160 × 2700). */
export const PHOTO_MAX_SIDE = 4096;
/** The smallest photo side asked for, CSS pixels. */
export const PHOTO_MIN_SIDE = 64;
export const PHOTO_DEFAULT_SCALE = 2;
/** The stage's own pixel-ratio cap (`scene.ts`): the density never goes past it. */
const MAX_RATIO = 2;

/** The size `request` is drawn at on a GPU whose largest texture side is `maxSide`. */
export function photoSize(request: PhotoRequest, maxSide: number): PhotoSize {
  const side = (n: number) => (Number.isFinite(n) ? Math.round(Math.min(Math.max(n, PHOTO_MIN_SIDE), PHOTO_MAX_SIDE)) : PHOTO_MIN_SIDE);
  let width = side(request.width);
  let height = side(request.height);
  const wanted = request.scale ?? PHOTO_DEFAULT_SCALE;
  let ratio = Number.isFinite(wanted) ? Math.min(Math.max(wanted, 1), MAX_RATIO) : PHOTO_DEFAULT_SCALE;
  const limit = Math.min(PHOTO_MAX_SIDE, Number.isFinite(maxSide) && maxSide > 0 ? maxSide : PHOTO_MAX_SIDE);
  const longest = Math.max(width, height);
  if (longest * ratio > limit) ratio = Math.max(1, limit / longest);
  if (longest * ratio > limit) {
    // Even at 1× it is too big: shrink the photo, keeping its shape.
    const shrink = limit / longest;
    width = Math.max(1, Math.floor(width * shrink));
    height = Math.max(1, Math.floor(height * shrink));
  }
  return { width, height, ratio };
}
