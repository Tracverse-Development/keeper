/**
 * Camera turn: walks the stage camera round the keeper so its back can be seen (packs, cloaks,
 * wings, a hood), for the Studio. It works on top of the zone focus (`camera-focus.ts`): whatever
 * that framed is orbited about the same target, on the vertical axis.
 *
 * Three ways to turn, each easing on its own:
 *  - `drag(delta, time)`: follows a drag one-for-one and remembers how fast it moved;
 *  - `release(time)`: let go, it coasts on that speed and slows down (inertia);
 *  - `to(yaw)`, `by(delta)` and `around()`: an eased glide to an angle, on by a step (the arrow
 *    keys), or to the back and front again.
 * Left alone for `IDLE_SECONDS`, it springs back to the front by itself, so the keeper never stays
 * turned away. Pure maths besides `apply` (no allocation per frame); tested by `camera-turn.test.ts`.
 */
import type { PerspectiveCamera, Vector3 } from 'three';

/** Seconds untouched before it glides back to the front. */
export const IDLE_SECONDS = 6;
/** How fast an eased turn closes on its angle (1/s), and how fast coasting slows (1/s). */
const EASE_RATE = 4;
const FRICTION = 2.6;
/** Coasting stops below this speed (rad/s); an angle this close counts as arrived (rad). */
const MIN_SPEED = 0.05;
const ARRIVED = 1e-3;
/** The fastest a flick may spin it (rad/s), so a wild flick does not whirl. */
const MAX_SPEED = 9;

/** `angle` wrapped into -π..π (the same direction, the short way round). */
export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return angle - turn * Math.floor((angle + Math.PI) / turn);
}

export class CameraTurn {
  /** The angle shown now (radians round the keeper; 0 = the front, positive = from screen right). */
  yaw = 0;
  private goal: number | null = null;
  private speed = 0;
  private dragging = false;
  private lastDragAt = 0;
  private idle = 0;

  /** True while it is turned away or still moving (the camera needs placing this frame). */
  get active(): boolean {
    return this.dragging || this.goal !== null || this.speed !== 0 || this.yaw !== 0;
  }

  /** A drag moved by `delta` radians at `time` (seconds): follow it, and learn its speed. */
  drag(delta: number, time: number): void {
    if (!Number.isFinite(delta)) return;
    const dt = this.dragging ? Math.max(time - this.lastDragAt, 1 / 240) : 1 / 60;
    const measured = delta / dt;
    // A soft average, so one jittery reading does not decide the flick.
    this.speed = this.dragging ? this.speed * 0.6 + measured * 0.4 : measured;
    this.dragging = true;
    this.lastDragAt = time;
    this.goal = null;
    this.idle = 0;
    this.yaw = wrapAngle(this.yaw + delta);
  }

  /** The drag ended: coast on its speed (a drag that stopped before letting go just stays). */
  release(time: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (time - this.lastDragAt > 0.12) this.speed = 0;
    this.speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.speed));
    this.idle = 0;
  }

  /** Glide to `yaw` (radians; 0 = the front). */
  to(yaw: number): void {
    if (!Number.isFinite(yaw)) return;
    this.goal = wrapAngle(yaw);
    this.speed = 0;
    this.dragging = false;
    this.idle = 0;
  }

  /** Glide `delta` radians on from where it is going (from the angle it is heading to, mid-glide). */
  by(delta: number): void {
    if (!Number.isFinite(delta)) return;
    this.to((this.goal ?? this.yaw) + delta);
  }

  /** Turn to show the back when it faces front-ish, else back to the front. */
  around(): void {
    this.to(Math.abs(this.yaw) < Math.PI / 2 ? Math.PI : 0);
  }

  /** Advance `dt` seconds: coasting, an eased glide, or the spring home after a while idle. */
  step(dt: number): void {
    if (this.dragging) return;
    if (this.speed !== 0) {
      this.yaw = wrapAngle(this.yaw + this.speed * dt);
      this.speed *= Math.exp(-FRICTION * dt);
      if (Math.abs(this.speed) < MIN_SPEED) this.speed = 0;
      return;
    }
    if (this.goal === null && this.yaw !== 0) {
      this.idle += dt;
      if (this.idle >= IDLE_SECONDS) this.goal = 0;
    }
    if (this.goal === null) return;
    const gap = wrapAngle(this.goal - this.yaw);
    this.yaw = wrapAngle(this.yaw + gap * (1 - Math.exp(-EASE_RATE * dt)));
    if (Math.abs(wrapAngle(this.goal - this.yaw)) < ARRIVED) {
      this.yaw = this.goal;
      // Arrived somewhere other than the front: that view holds until the idle spring.
      this.idle = 0;
      this.goal = null;
    }
  }

  /**
   * Places `camera`: `from` (the pose the focus or the home framing gave) walked round `target` by
   * the current angle, still looking at `target`.
   */
  apply(camera: PerspectiveCamera, from: Vector3, target: Vector3): void {
    const dx = from.x - target.x;
    const dz = from.z - target.z;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    camera.position.set(target.x + dx * c + dz * s, from.y, target.z - dx * s + dz * c);
    camera.lookAt(target);
  }
}
