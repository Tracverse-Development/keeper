/**
 * Level of detail for the costly coats (shell fur, the owl's feathers): a keeper that is small on
 * screen draws fewer shells and fewer, simpler feathers; a keeper that fills the Studio or a hero
 * shot draws everything. Saves battery where the detail could not be seen anyway.
 *
 *   chooseDetail(heightPx, previous)   pure: the level for a keeper `heightPx` device pixels tall.
 *                                      It steps UP at a band and only steps back DOWN well below
 *                                      it (hysteresis), so a keeper breathing or bobbing right at
 *                                      a band never flickers between two levels.
 *   projectedHeightPx(...)             pure: how tall an object of a given world height looks.
 *   createDetailWatch(subject)         the three.js side: call `observe(renderer, camera)` from a
 *                                      mesh's `onBeforeRender` (where the camera is known) and it
 *                                      answers the level for this frame, measured once per frame
 *                                      however many meshes ask.
 *
 * No skin contract change is needed: `onBeforeRender` hands every mesh the renderer and the camera.
 * A level chosen there that changes a mesh's GEOMETRY shows from the next frame (three.js has
 * already listed the geometry to draw); instance counts and uniforms apply at once.
 */
import { Box3, Matrix4, Vector2, Vector3, type Camera, type Object3D, type OrthographicCamera, type PerspectiveCamera, type WebGLRenderer } from 'three';

/** The levels, cheapest first. */
export const DETAIL_LEVELS = ['light', 'balanced', 'full'] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

/**
 * The keeper height (device pixels) at which each level begins when growing. A lineup cell on a
 * plain screen (~220 px) is `light`; the same on a Retina screen or the app's window is `balanced`;
 * the Studio and hero shots (650 px and up) are `full`.
 */
export const DETAIL_BANDS: Readonly<Record<Exclude<DetailLevel, 'light'>, number>> = { balanced: 320, full: 640 };
/** How far below a band a keeper must shrink before it steps back down (share of the band). */
export const DETAIL_HYSTERESIS = 0.15;

/**
 * The level for a keeper `heightPx` device pixels tall, given the level it had last frame (null on
 * the first frame: no hysteresis then). Growing past a band steps up at once; shrinking steps down
 * only below `band * (1 - DETAIL_HYSTERESIS)`.
 */
export function chooseDetail(heightPx: number, previous: DetailLevel | null): DetailLevel {
  const plain: DetailLevel = heightPx >= DETAIL_BANDS.full ? 'full' : heightPx >= DETAIL_BANDS.balanced ? 'balanced' : 'light';
  if (previous === null) return plain;
  const rank = (level: DetailLevel): number => DETAIL_LEVELS.indexOf(level);
  if (rank(plain) >= rank(previous)) return plain; // growing (or holding): step up at the band
  // Shrinking: keep the previous level while still within the hysteresis margin below its band.
  const keep = (level: DetailLevel): boolean => level !== 'light' && heightPx >= DETAIL_BANDS[level] * (1 - DETAIL_HYSTERESIS);
  if (keep(previous)) return previous;
  if (previous === 'full' && keep('balanced')) return 'balanced';
  return plain;
}

/**
 * Device pixels an object `worldHeight` tall covers at `depth` in front of a perspective camera with
 * vertical field of view `fovDegrees`, on a viewport `viewportPx` device pixels tall.
 */
export function projectedHeightPx(worldHeight: number, depth: number, fovDegrees: number, viewportPx: number): number {
  if (depth <= 1e-6) return Infinity; // at or behind the lens: as close as it gets
  return (worldHeight / (2 * depth * Math.tan((fovDegrees * Math.PI) / 360))) * viewportPx;
}

/** Answers the detail level of one keeper each frame (see the module doc). */
export interface DetailWatch {
  /** The level for this render; cheap to call from every mesh's `onBeforeRender`. */
  observe(renderer: WebGLRenderer, camera: Camera): DetailLevel;
  /** The level last answered (null before the first render). */
  readonly level: DetailLevel | null;
  /** The keeper's height on screen at the last measure, device pixels (for tests and reports). */
  readonly heightPx: number;
}

/**
 * Watches `subject` (a skin's root or body). Its height and centre are measured once, at the first
 * render (in its own space, so later scaling, squash and swap transitions are followed through its
 * world matrix). `override` pins a level (tests, a "best quality" setting); null follows the screen.
 */
export function createDetailWatch(subject: Object3D, override: DetailLevel | null = null): DetailWatch {
  let level: DetailLevel | null = null;
  let heightPx = 0;
  let localHeight = 0;
  let measured = false;
  let lastFrame = -1;
  let lastCamera = -1;
  const localCentre = new Vector3();
  const centre = new Vector3();
  const scale = new Vector3();
  const size = new Vector2();
  const inverse = new Matrix4();

  function measure(): void {
    subject.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(subject);
    measured = true;
    if (box.isEmpty()) return;
    subject.getWorldScale(scale);
    localHeight = (box.max.y - box.min.y) / Math.max(Math.abs(scale.y), 1e-6);
    localCentre.copy(box.getCenter(centre)).applyMatrix4(inverse.copy(subject.matrixWorld).invert());
  }

  return {
    observe(renderer, camera) {
      const frame = renderer.info.render.frame;
      if (frame === lastFrame && camera.id === lastCamera && level !== null) return level;
      lastFrame = frame;
      lastCamera = camera.id;
      if (!measured) measure();
      subject.getWorldScale(scale);
      centre.copy(localCentre).applyMatrix4(subject.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      const worldHeight = localHeight * Math.abs(scale.y);
      const viewport = renderer.getDrawingBufferSize(size).y;
      const ortho = camera as OrthographicCamera;
      heightPx = ortho.isOrthographicCamera
        ? (worldHeight * ortho.zoom * viewport) / Math.max(ortho.top - ortho.bottom, 1e-6)
        : projectedHeightPx(worldHeight, -centre.z, (camera as PerspectiveCamera).fov ?? 50, viewport);
      level = override ?? chooseDetail(heightPx, level);
      return level;
    },
    get level() {
      return level;
    },
    get heightPx() {
      return heightPx;
    },
  };
}
