/**
 * A fixed pool of particles of ONE kind, stored as flat typed arrays (structure of arrays),
 * moved by closed-form motion: given a particle's birth state, its position at any age is a
 * formula, so a frame is one pass over the pool with no integration error and no allocation.
 *
 *   position(t) = origin + v0 * (1 - e^(-drag t)) / drag + (0, gravity t^2 / 2, 0) + sway
 *
 * The output arrays (`positions`, `sizes`, `brights`, `angles`, `colours`) are exactly what
 * the GPU attributes wrap, so drawing copies nothing. Spawning reuses slots round-robin: when
 * the pool is full the oldest particle is replaced (a burst never fails, it only recycles).
 *
 * Pattern: Object Pool. Pure (no three.js, no DOM; the random source is passed in): tested by
 * `particle-pool.test.ts`.
 */
import type { KindSpec, Range } from './particle-kinds.ts';

/** A point in world space (any object with x, y, z: a three.js Vector3 works). */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export class ParticlePool {
  readonly spec: KindSpec;
  readonly capacity: number;
  /** GPU-facing outputs: xyz per particle, size, brightness (0 = hidden), angle, rgb. */
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly brights: Float32Array;
  readonly angles: Float32Array;
  readonly colours: Float32Array;
  private readonly bornAt: Float64Array;
  private readonly lifetime: Float32Array;
  private readonly origin: Float32Array;
  private readonly velocity: Float32Array;
  private readonly spin: Float32Array;
  private readonly seed: Float32Array;
  private readonly startAngle: Float32Array;
  private readonly startSize: Float32Array;
  private next = 0;
  /** When the last living particle dies: until then `update` has work to do. */
  private busyUntil = -Infinity;

  constructor(spec: KindSpec) {
    this.spec = spec;
    const n = (this.capacity = spec.capacity);
    this.positions = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.brights = new Float32Array(n);
    this.angles = new Float32Array(n);
    this.colours = new Float32Array(n * 3);
    this.bornAt = new Float64Array(n).fill(-Infinity);
    this.lifetime = new Float32Array(n).fill(1);
    this.origin = new Float32Array(n * 3);
    this.velocity = new Float32Array(n * 3);
    this.spin = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.startAngle = new Float32Array(n);
    this.startSize = new Float32Array(n);
  }

  /** True while any particle is alive (or waiting to be born). */
  busy(time: number): boolean {
    return time < this.busyUntil;
  }

  /** Launches one particle from `at`, born `delay` seconds after `time`; returns its slot. */
  spawn(at: Point3, time: number, random: () => number, delay = 0): number {
    const s = this.spec;
    const i = this.next;
    this.next = (i + 1) % this.capacity;
    const life = pick(s.life, random());
    this.bornAt[i] = time + delay;
    this.lifetime[i] = life;
    this.busyUntil = Math.max(this.busyUntil, time + delay + life);
    const angle = random() * Math.PI * 2;
    const radius = s.scatter * Math.sqrt(random());
    this.origin[i * 3] = at.x + Math.cos(angle) * radius;
    this.origin[i * 3 + 1] = at.y + (random() - 0.5) * radius * 0.5;
    this.origin[i * 3 + 2] = at.z + Math.sin(angle) * radius * 0.5;
    coneDirection(s.direction, s.cone, random(), random(), this.velocity, i * 3);
    const speed = pick(s.speed, random());
    for (let k = 0; k < 3; k++) this.velocity[i * 3 + k] *= speed;
    this.spin[i] = pick(s.spin, random());
    this.seed[i] = random();
    this.startAngle[i] = pick(s.angle, random());
    this.startSize[i] = pick(s.size, random());
    const colour = s.colours[Math.min(s.colours.length - 1, Math.floor(random() * s.colours.length))];
    this.colours[i * 3] = ((colour >> 16) & 255) / 255;
    this.colours[i * 3 + 1] = ((colour >> 8) & 255) / 255;
    this.colours[i * 3 + 2] = (colour & 255) / 255;
    return i;
  }

  /** Writes every particle's state at `time` into the outputs; returns how many are visible. */
  update(time: number): number {
    const s = this.spec;
    let visible = 0;
    for (let i = 0; i < this.capacity; i++) {
      const age = time - this.bornAt[i];
      const u = age / this.lifetime[i];
      if (!(age >= 0) || u >= 1) {
        this.brights[i] = 0;
        continue;
      }
      visible++;
      const travelled = travel(s.drag, age);
      const sway = s.sway * Math.sin(s.swayRate * age + this.seed[i] * Math.PI * 2) * Math.min(age * 2, 1);
      const o = i * 3;
      this.positions[o] = this.origin[o] + this.velocity[o] * travelled + sway;
      this.positions[o + 1] = this.origin[o + 1] + this.velocity[o + 1] * travelled + 0.5 * s.gravity * age * age;
      this.positions[o + 2] = this.origin[o + 2] + this.velocity[o + 2] * travelled;
      this.sizes[i] = this.startSize[i] * (1 + (s.grow - 1) * u);
      this.brights[i] = s.bright * lifeFade(u);
      this.angles[i] = this.startAngle[i] + this.spin[i] * age;
    }
    return visible;
  }
}

/** Distance factor travelled under exponential drag after `t` seconds: (1 - e^(-k t)) / k. */
export function travel(drag: number, t: number): number {
  if (t <= 0) return 0;
  if (drag <= 1e-6) return t;
  return (1 - Math.exp(-drag * t)) / drag;
}

/** Brightness over a life 0..1: a quick fade in, then a soft fade out; 0 outside the life. */
export function lifeFade(u: number): number {
  if (!(u > 0) || u >= 1) return 0;
  return Math.min(u / 0.08, 1) * (1 - u) ** 1.4;
}

/**
 * A unit direction inside a cone of half-angle `cone` around `axis`, from two uniform numbers
 * 0..1, written into `out` at `offset` (no allocation).
 */
export function coneDirection(axis: readonly [number, number, number], cone: number, r1: number, r2: number, out: Float32Array, offset: number): void {
  const length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const dx = axis[0] / length;
  const dy = axis[1] / length;
  const dz = axis[2] / length;
  // Any vector not parallel to the axis, crossed with it, gives the cone's first side vector.
  const ax = Math.abs(dy) < 0.9 ? 0 : 1; // the y axis, or x when the axis is nearly vertical
  const ay = 1 - ax;
  let ux = ay * dz;
  let uy = -ax * dz;
  let uz = ax * dy - ay * dx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const wx = dy * uz - dz * uy;
  const wy = dz * ux - dx * uz;
  const wz = dx * uy - dy * ux;
  const theta = cone * Math.sqrt(r1);
  const phi = r2 * Math.PI * 2;
  const along = Math.cos(theta);
  const side = Math.sin(theta);
  out[offset] = dx * along + (ux * Math.cos(phi) + wx * Math.sin(phi)) * side;
  out[offset + 1] = dy * along + (uy * Math.cos(phi) + wy * Math.sin(phi)) * side;
  out[offset + 2] = dz * along + (uz * Math.cos(phi) + wz * Math.sin(phi)) * side;
}

function pick(range: Range, r: number): number {
  return range[0] + (range[1] - range[0]) * r;
}
