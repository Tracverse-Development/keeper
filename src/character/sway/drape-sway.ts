/**
 * Drape sway: the swing of cloth that hangs round the body (a cloak, a gown's skirt, a shawl) as
 * the body under it moves, turns, bobs, waves or emotes. Cloth like this has no bones: its shell is
 * moved vertex by vertex, so this measures the motion and hands back a per-vertex offset the part's
 * own vertex loop applies (`displace`), on top of whatever breath or billow the part already plays.
 *
 * Pattern: two sway springs (`sway-spring.ts`) on the hem, one at the front and one at the back,
 * measured in view space (`sway-probe.ts`). Their mean lag is the hem's sideways swing; their
 * difference is a twist round the body's axis (a turn leaves a skirt behind, then it catches up).
 * Both grow from nothing at `top` (where the cloth is held) to full at `bottom` (`hang`, squared,
 * as cloth falls). Collision is the cheap, sure kind: a vertex may ride round the body or out from
 * it, but never in nearer the axis than its place before the swing (`displace` clamps the radius), so it
 * cannot go through a body it was built clear of.
 *
 * Usage (in a part):
 *   const drape = createDrapeSway(group, { top, bottom, radius: hemRadius });
 *   update(frame) { drape.step(frame.dt, frame.motion.amplitude); ...for each vertex: drape.displace(x, y, z, rx, rz, out) }
 * With the body still the offsets are 0 and `displace` hands back the position it was given.
 */
import { Vector3, type Object3D } from 'three';
import { SwayProbe } from './sway-probe.ts';
import { SwaySpring } from './sway-spring.ts';

/** Where the cloth hangs from and to (heights in the part's frame) and how it moves. */
export interface DrapeOptions {
  /** Where the cloth is held (no swing) and where it ends (full swing). */
  readonly top: number;
  readonly bottom: number;
  /** The hem's half-depth (front to back, part units): where the two probes sit. */
  readonly radius: number;
  /** Natural frequency (Hz; default 1.4) and damping ratio (default 0.32). */
  readonly frequency?: number;
  readonly damping?: number;
  /** The widest sideways swing of the hem (part units; default 0.12) and twist (radians; default 0.25). */
  readonly maxLag?: number;
  readonly maxTwist?: number;
  /** Multiplies the swing (default 1). */
  readonly gain?: number;
}

export interface DrapeSway {
  /** Measures the body as posed now and advances the swing (`amplitude`: the reduced-motion dial). */
  step(dt: number, amplitude?: number): void;
  /**
   * The swung place of a vertex at (x, y, z), into `out` (y unchanged). `floorX`, `floorZ` is the
   * nearest to the axis it may come (its place before the swing, billow included, so a swing never
   * eats the billow and bares the trim under it). Cheap: call it inside the part's own vertex loop.
   */
  displace(x: number, y: number, z: number, floorX: number, floorZ: number, out: Vector3): Vector3;
  /** True while there is any swing to show (a part may skip its vertex loop otherwise). */
  readonly moving: boolean;
  /** Drops the swing at once. */
  reset(): void;
}

/** Below this offset (part units) and twist (radians) the drape counts as still. */
const STILL = 1e-4;

export function createDrapeSway(anchor: Object3D, options: DrapeOptions): DrapeSway {
  const probe = new SwayProbe(anchor);
  const maxLag = options.maxLag ?? 0.12;
  const maxTwist = options.maxTwist ?? 0.25;
  const gain = options.gain ?? 1;
  const span = Math.max(options.top - options.bottom, 1e-3);
  const radius = Math.max(options.radius, 1e-3);
  const points = [new Vector3(0, options.bottom, radius), new Vector3(0, options.bottom, -radius)];
  let springs: SwaySpring[] | null = null;
  const at = new Vector3();
  const local = new Vector3();
  const lag: [number, number, number] = [0, 0, 0];
  const swing = [new Vector3(), new Vector3()];
  let lagX = 0, lagZ = 0, cos = 1, sin = 0;
  let moving = false;

  function reset(): void {
    springs?.forEach((s) => s.reset());
    lagX = lagZ = sin = 0;
    cos = 1;
    moving = false;
  }

  function step(dt: number, amplitude = 1): void {
    if (probe.begin()) springs?.forEach((s) => s.reset());
    const scale = probe.scale();
    springs ??= points.map(() => new SwaySpring({ frequency: options.frequency ?? 1.4, damping: options.damping ?? 0.32, drag: 0.5, maxLag: maxLag * 1.5 * scale }));
    points.forEach((point, i) => {
      probe.toView(point.x, point.y, point.z, at);
      springs![i].step(dt, at.x, at.y, at.z);
      springs![i].lag(lag);
      probe.toLocal(at.set(at.x + lag[0], at.y + lag[1], at.z + lag[2]), local);
      swing[i].subVectors(local, point);
    });
    const k = gain * Math.min(Math.max(amplitude, 0), 1);
    // Eased into the limits (tanh): small swings as they are, big ones held short of the limit.
    const x = (swing[0].x + swing[1].x) / 2;
    const z = (swing[0].z + swing[1].z) / 2;
    const reach = Math.hypot(x, z);
    const shown = reach > 0 ? (maxLag * Math.tanh((reach * k) / maxLag)) / reach : 0;
    lagX = x * shown;
    lagZ = z * shown;
    const twist = maxTwist * Math.tanh((((swing[0].x - swing[1].x) / (2 * radius)) * k) / maxTwist);
    cos = Math.cos(twist);
    sin = Math.sin(twist);
    moving = Math.hypot(lagX, lagZ) > STILL || Math.abs(twist) > STILL;
  }

  function displace(x: number, y: number, z: number, floorX: number, floorZ: number, out: Vector3): Vector3 {
    if (!moving) return out.set(x, y, z);
    const hang = Math.min(Math.max((options.top - y) / span, 0), 1) ** 2;
    if (hang === 0) return out.set(x, y, z);
    // Twist round the axis by the hang's share, then swing sideways.
    const c = 1 + (cos - 1) * hang;
    const s = sin * hang;
    let nx = x * c + z * s + lagX * hang;
    let nz = z * c - x * s + lagZ * hang;
    // Never nearer the axis than its rest place: round the body or out from it, never into it.
    const floor = Math.hypot(floorX, floorZ);
    const r = Math.hypot(nx, nz);
    if (r < floor && r > 1e-6) {
      nx *= floor / r;
      nz *= floor / r;
    }
    return out.set(nx, y, nz);
  }

  return {
    step,
    displace,
    reset,
    get moving() {
      return moving;
    },
  };
}
