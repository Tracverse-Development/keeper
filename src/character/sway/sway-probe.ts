/**
 * The sway probe: where a point of an object is in VIEW space this frame (`sway-view.ts`), and the
 * way back from view space into the object's own frame. Bones and drapes measure their rigid tip
 * through it and turn the spring's lag back into their own axes.
 *
 * Call `begin()` once per frame before `toView`/`toLocal`: it refreshes the object's world matrix
 * (the skin has just posed the rig; the renderer only refreshes matrices when it draws) and says
 * whether the frame of measurement changed (the first camera seen), so the caller resets its spring
 * instead of whipping across the jump.
 */
import { Matrix4, Vector3, type Object3D } from 'three';
import { sceneView } from './sway-view.ts';

export class SwayProbe {
  private readonly toViewMatrix = new Matrix4();
  private readonly toLocalMatrix = new Matrix4();
  private readonly scratch = new Vector3();
  private seen = 0;
  private readonly object: Object3D;

  constructor(object: Object3D) {
    this.object = object;
  }

  /** Refreshes the matrices; true when the measuring frame just changed (reset the spring). */
  begin(): boolean {
    this.object.updateWorldMatrix(true, false);
    const view = sceneView(this.object);
    const renders = view?.renders ?? 0;
    if (view && renders > 0) this.toViewMatrix.multiplyMatrices(view.matrix, this.object.matrixWorld);
    else this.toViewMatrix.copy(this.object.matrixWorld);
    this.toLocalMatrix.copy(this.toViewMatrix).invert();
    const changed = (this.seen === 0) !== (renders === 0);
    this.seen = renders;
    return changed;
  }

  /** `local` (a point in the object's frame) in view space, into `out`. */
  toView(x: number, y: number, z: number, out: Vector3): Vector3 {
    return out.set(x, y, z).applyMatrix4(this.toViewMatrix);
  }

  /** `view` (a point in view space) in the object's frame, into `out`. */
  toLocal(view: Vector3, out: Vector3): Vector3 {
    return out.copy(view).applyMatrix4(this.toLocalMatrix);
  }

  /** How many view units one unit of the object's frame is (its world scale; the view adds none). */
  scale(): number {
    return this.scratch.setFromMatrixColumn(this.toViewMatrix, 0).length();
  }
}
