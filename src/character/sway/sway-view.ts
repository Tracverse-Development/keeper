/**
 * The view sway is measured in: where the camera was at the last render of the scene a soft part
 * lives in. Sway is driven by motion AS SEEN, so the Studio's camera turn (`stage/camera-turn.ts`,
 * which walks the camera round a keeper that stands still) swings a cloak exactly as the keeper
 * turning on the spot would, and the stage never has to tell a part where its camera is.
 *
 * Pattern: Observer on the scene's own `onBeforeRender` hook, installed once per scene (a WeakMap,
 * so a disposed scene takes its tracker with it) and chained onto any hook already there. Before
 * the first render, or outside a scene (node tests build parts with no scene), there is no view and
 * callers measure in world space.
 *
 * Usage:
 *   const view = sceneView(object);        // per frame; cheap (walks up to the scene)
 *   if (view) matrix.multiplyMatrices(view.matrix, object.matrixWorld);
 *   view?.renders                           // counts renders; 0 = no camera seen yet
 */
import { Matrix4, type Camera, type Object3D, type Scene } from 'three';

/** The camera's view matrix at the scene's last render, and how many renders it has seen. */
export interface SceneView {
  readonly matrix: Matrix4;
  readonly renders: number;
}

interface Tracker {
  matrix: Matrix4;
  renders: number;
}

const trackers = new WeakMap<Object3D, Tracker>();

/** The view `object`'s scene was last drawn from, or null when it is in no scene. */
export function sceneView(object: Object3D): SceneView | null {
  let top = object;
  while (top.parent) top = top.parent;
  if (!(top as Scene).isScene) return null;
  let tracker = trackers.get(top);
  if (!tracker) {
    const made: Tracker = { matrix: new Matrix4(), renders: 0 };
    const previous = top.onBeforeRender;
    top.onBeforeRender = function (this: Object3D, ...args: Parameters<Object3D['onBeforeRender']>) {
      const camera = args[2] as Camera & { isPerspectiveCamera?: boolean; isOrthographicCamera?: boolean };
      if (camera.isPerspectiveCamera || camera.isOrthographicCamera) {
        made.matrix.copy(camera.matrixWorldInverse);
        made.renders++;
      }
      previous.apply(this, args);
    };
    trackers.set(top, made);
    tracker = made;
  }
  return tracker;
}
