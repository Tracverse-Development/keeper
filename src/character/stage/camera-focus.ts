/**
 * Camera focus: eases the stage camera from its home framing (the whole character) onto one paint
 * zone (`look/zone-focus.ts`: the dog's ears, the robot's chest core) and back, for the Studio's
 * zoom onto the part being changed.
 *
 * `want(focus)` sets where to go (null = home); `step(dt, camera, home)` moves the camera one
 * frame: one eased glide from where it was to the zone's pose (looking at the zone from its
 * side, `yaw`, from a little above), so a change of zone mid-way glides on from where it is.
 * At home and settled it touches nothing, so the stage's own framing (`scene.ts`) stands.
 * Nothing allocates per frame.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import type { ZoneFocus } from '../look/zone-focus';
import { damp, easeInOut } from '../moods';

/** How fast the camera glides (1/s), and the share of the distance it looks down from. */
const RATE = 3.2;
const ABOVE = 0.12;
const SETTLED = 1e-3;

export interface CameraHome {
  readonly position: Vector3;
  readonly target: Vector3;
}

export class CameraFocus {
  private wanted: ZoneFocus | null = null;
  /** Where the camera starts this glide from (so switching zones mid-way does not jump). */
  private readonly fromPosition = new Vector3();
  private readonly fromTarget = new Vector3();
  private readonly toPosition = new Vector3();
  private readonly toTarget = new Vector3();
  private readonly look = new Vector3();
  private progress = 1;
  private active = false;

  /** Frame `focus` (null = back to the whole character). */
  want(focus: ZoneFocus | null, camera: PerspectiveCamera, current: Vector3): void {
    if (focus === this.wanted) return;
    // Start the new glide from wherever the camera is now.
    this.fromPosition.copy(camera.position);
    this.fromTarget.copy(current);
    this.wanted = focus;
    this.progress = 0;
    this.active = true;
  }

  /** Where the camera is looking now (the last target it was aimed at). */
  get target(): Vector3 {
    return this.look;
  }

  /** True while the camera is away from home or gliding. */
  get busy(): boolean {
    return this.active || this.wanted !== null;
  }

  step(dt: number, camera: PerspectiveCamera, home: CameraHome): void {
    if (!this.active && this.wanted === null) {
      this.look.copy(home.target);
      return;
    }
    this.progress = 1 - damp(1 - this.progress, 0, RATE, dt);
    const k = easeInOut(this.progress);
    const focus = this.wanted;
    if (focus) {
      const d = focus.distance;
      this.toTarget.set(focus.target.x, focus.target.y, focus.target.z);
      this.toPosition.set(this.toTarget.x + Math.sin(focus.yaw) * d, this.toTarget.y + ABOVE * d, this.toTarget.z + Math.cos(focus.yaw) * d);
    } else {
      this.toTarget.copy(home.target);
      this.toPosition.copy(home.position);
    }
    camera.position.lerpVectors(this.fromPosition, this.toPosition, k);
    this.look.lerpVectors(this.fromTarget, this.toTarget, k);
    camera.lookAt(this.look);
    if (1 - this.progress < SETTLED) {
      camera.position.copy(this.toPosition);
      this.look.copy(this.toTarget);
      camera.lookAt(this.look);
      this.active = false;
    }
  }
}
