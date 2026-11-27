/**
 * The sway spring: one point that trails a moving target like the tip of something soft (a cloak's
 * hem, a scarf end, a dog's ear). Pure maths, no three.js, so it is node-tested on its own
 * (`sway-spring.test.ts`).
 *
 * Pattern: a damped spring (secondary motion). Each frame the caller says where the target is now
 * (the rigid tip: where the part would be if it were stiff); the point is pulled toward it by a
 * spring of natural `frequency` (Hz) with damping ratio `damping` measured against the target's own
 * velocity, so steady motion leaves no lag and only a change of motion (a start, a stop, a turn,
 * a bob) swings it; `drag` adds a little air resistance (a steady trail while it keeps moving).
 * `lag()` is the point minus the target: the swing, which the caller turns into a rotation or a
 * vertex offset in its own frame.
 *
 * Guarantees (all tested):
 *  - frame-rate independent: a frame is cut into fixed sub-steps of at most `SUB_STEP` seconds,
 *    the target interpolated across them, and `dt` is capped at `MAX_DT` (a stalled tab does not
 *    fling it);
 *  - bounded: the lag never exceeds `maxLag` (the state is clamped, not just the output);
 *  - settles: with the target still, the lag decays to rest;
 *  - a jump of the target farther than `snap` (a skin swap, a new camera) resets instead of whipping.
 *
 * Usage:
 *   const spring = new SwaySpring({ frequency: 1.6, damping: 0.35, maxLag: 0.12 });
 *   spring.step(dt, tipX, tipY, tipZ);   // every frame, the rigid tip's position
 *   const [lx, ly, lz] = spring.lag();    // how far the soft tip trails it
 */

/** How the soft thing moves: its stiffness, how quickly it settles, and how far it may go. */
export interface SwayTuning {
  /** Natural frequency (Hz): low for a long cloak, higher for a short ear or a feather. */
  readonly frequency: number;
  /** Damping ratio 0..1: 0.3 swings a few times before it settles, 1 never overshoots. */
  readonly damping: number;
  /** The farthest the soft tip may trail the rigid one (same units as the positions). */
  readonly maxLag: number;
  /** Air resistance (1/s): a steady trail behind steady motion. Default 0. */
  readonly drag?: number;
  /** A target jump farther than this resets the spring (default 8 × `maxLag`). */
  readonly snap?: number;
}

/** The longest sub-step the integrator takes (s); every frame is cut into steps this short or less. */
export const SUB_STEP = 1 / 240;
/** The longest frame it will integrate (s): a longer gap (a hidden tab) counts as this long. */
export const MAX_DT = 1 / 15;

export class SwaySpring {
  private readonly omega: number;
  private readonly zeta: number;
  private readonly drag: number;
  private readonly maxLag: number;
  private readonly snap: number;
  /** The soft point and its velocity. */
  private readonly p = [0, 0, 0];
  private readonly v = [0, 0, 0];
  /** The target last frame (the start of this frame's interpolation). */
  private readonly t = [0, 0, 0];
  /** Scratch: this frame's target and its velocity (no allocation per frame). */
  private readonly to = [0, 0, 0];
  private readonly tv = [0, 0, 0];
  private started = false;

  constructor(tuning: SwayTuning) {
    this.omega = Math.PI * 2 * Math.max(tuning.frequency, 0.05);
    this.zeta = Math.min(Math.max(tuning.damping, 0), 2);
    this.drag = Math.max(tuning.drag ?? 0, 0);
    this.maxLag = Math.max(tuning.maxLag, 0);
    this.snap = tuning.snap ?? this.maxLag * 8;
  }

  /** Forgets the motion: the next `step` starts at rest on its target. */
  reset(): void {
    this.started = false;
  }

  /**
   * Advances `dt` seconds with the rigid tip now at (x, y, z). The first call (and any jump past
   * `snap`, or a non-finite input) places the soft tip on the target at rest.
   */
  step(dt: number, x: number, y: number, z: number): void {
    const { p, v, t } = this;
    if (!Number.isFinite(x + y + z)) return;
    const jump = Math.hypot(x - t[0], y - t[1], z - t[2]);
    if (!this.started || jump > this.snap) {
      p[0] = t[0] = x;
      p[1] = t[1] = y;
      p[2] = t[2] = z;
      v[0] = v[1] = v[2] = 0;
      this.started = true;
      return;
    }
    const span = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_DT) : 0;
    if (span <= 0) return;
    const steps = Math.ceil(span / SUB_STEP);
    const h = span / steps;
    const k = this.omega * this.omega;
    const c = 2 * this.zeta * this.omega;
    // The target's velocity across this frame (constant within it).
    const { to, tv } = this;
    to[0] = x;
    to[1] = y;
    to[2] = z;
    for (let a = 0; a < 3; a++) tv[a] = (to[a] - t[a]) / span;
    for (let s = 1; s <= steps; s++) {
      // Semi-implicit Euler, the spring pulling toward where the target was at the START of the
      // sub-step: velocity first, then position with the new velocity. Stable for k·h² ≪ 1, and
      // steady motion settles exactly on the target (no one-step lead).
      const from = (s - 1) / steps;
      for (let a = 0; a < 3; a++) {
        const goal = t[a] + (to[a] - t[a]) * from;
        v[a] += h * (k * (goal - p[a]) - c * (v[a] - tv[a]) - this.drag * v[a]);
        p[a] += h * v[a];
      }
      const u = s / steps;
      this.bound(t[0] + (x - t[0]) * u, t[1] + (y - t[1]) * u, t[2] + (z - t[2]) * u, tv[0], tv[1], tv[2]);
    }
    t[0] = x;
    t[1] = y;
    t[2] = z;
  }

  /** The soft tip minus the rigid one now: the swing, at most `maxLag` long. */
  lag(out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    out[0] = this.p[0] - this.t[0];
    out[1] = this.p[1] - this.t[1];
    out[2] = this.p[2] - this.t[2];
    return out;
  }

  /** Keeps the soft tip within `maxLag` of the target, losing the velocity that pushed it out. */
  private bound(g0: number, g1: number, g2: number, tv0: number, tv1: number, tv2: number): void {
    const { p, v } = this;
    const d0 = p[0] - g0, d1 = p[1] - g1, d2 = p[2] - g2;
    const length = Math.hypot(d0, d1, d2);
    if (length <= this.maxLag || length === 0) return;
    const n0 = d0 / length, n1 = d1 / length, n2 = d2 / length;
    p[0] = g0 + n0 * this.maxLag;
    p[1] = g1 + n1 * this.maxLag;
    p[2] = g2 + n2 * this.maxLag;
    // Relative to the target, keep only the velocity along the rim (or heading back in).
    const out = (v[0] - tv0) * n0 + (v[1] - tv1) * n1 + (v[2] - tv2) * n2;
    if (out > 0) {
      v[0] -= out * n0;
      v[1] -= out * n1;
      v[2] -= out * n2;
    }
  }
}
