/**
 * A sway bone: makes a rigid piece hanging off a pivot (a scarf end, a dog's ear or tail, an owl's
 * ear tuft) swing and settle as the body under it moves, turns, bobs, waves or emotes.
 *
 * Pattern: Decorator on the rig. `addSwayBone(pivot, ...)` slides a `sway` layer in between the
 * pivot and everything it held, so the skin or part keeps posing the pivot exactly as before (its
 * own wag, perk or droop is untouched) and the swing lives only on the layer: no compounding, and
 * with the motion still the layer is the identity, so the piece looks exactly as it was built.
 * Each frame the bone measures where its rigid tip is in view space (`sway-probe.ts`), lets a
 * `SwaySpring` trail it, and turns the lag into the rotation that points the tip at the trailing
 * point, limited to a cone of `maxAngle` and kept from swinging into the body (`keepOut`).
 *
 * Chains: add a bone to each pivot of a chain and update them root first; each child measures a
 * pivot its parent's layer has already swung, so the motion runs down the chain like a whip.
 *
 * Usage:
 *   const ear = addSwayBone(earPivot, { tip: [0, -1, 0], frequency: 2.2, damping: 0.3, maxAngle: 0.4 });
 *   ...every frame, AFTER the pivot is posed:  ear.update(frame.dt, frame.motion.amplitude);
 */
import { Group, Quaternion, Vector3, type Object3D } from 'three';
import { SwayProbe } from './sway-probe.ts';
import { SwaySpring } from './sway-spring.ts';

/** How one bone swings. Directions and the tip are in the PIVOT's frame. */
export interface SwayBoneOptions {
  /** The rigid tip of the piece (where it ends), from the pivot. */
  readonly tip: readonly [number, number, number];
  /** Natural frequency (Hz) and damping ratio of the swing (`SwaySpring`). */
  readonly frequency: number;
  readonly damping: number;
  /** The widest swing (radians) off its posed direction. */
  readonly maxAngle: number;
  /** Air resistance (1/s), a steady trail behind steady motion (default 0.6). */
  readonly drag?: number;
  /** Multiplies the swing (default 1); the reduced-motion amplitude multiplies it again. */
  readonly gain?: number;
  /**
   * Where the body is from the tip: the tip may move at most `room` (pivot units) that way, so the
   * piece swings out and round, never into the body.
   */
  readonly keepOut?: { readonly direction: readonly [number, number, number]; readonly room?: number };
}

export interface SwayBone {
  /** The layer between the pivot and its children; its rotation is the swing. */
  readonly layer: Group;
  /** Measures the pivot as posed now and swings the layer (`amplitude`: the reduced-motion dial). */
  update(dt: number, amplitude?: number): void;
  /** Drops the swing at once (a skin swap, a snapshot). */
  reset(): void;
}

const DEFAULT_DRAG = 0.6;
/** The trailing point may lag this far beyond the cone (as a share of the tip's length), then is held. */
const LAG_HEADROOM = 1.4;

/** Inserts a sway layer under `pivot` (moving its children onto it) and returns the bone. */
export function addSwayBone(pivot: Object3D, options: SwayBoneOptions): SwayBone {
  const layer = new Group();
  layer.name = 'sway';
  for (const child of [...pivot.children]) layer.add(child);
  pivot.add(layer);

  const tip = new Vector3(...options.tip);
  const length = Math.max(tip.length(), 1e-4);
  const unitTip = tip.clone().divideScalar(length);
  const keepOut = options.keepOut ? new Vector3(...options.keepOut.direction).normalize() : null;
  const room = options.keepOut?.room ?? 0;
  const gain = options.gain ?? 1;
  const probe = new SwayProbe(pivot);
  const at = new Vector3();
  const trail = new Vector3();
  const bent = new Vector3();
  const swing = new Quaternion();
  const identity = new Quaternion();
  const lag: [number, number, number] = [0, 0, 0];
  let spring: SwaySpring | null = null;

  function reset(): void {
    spring?.reset();
    layer.quaternion.identity();
  }

  function update(dt: number, amplitude = 1): void {
    if (probe.begin()) spring?.reset();
    // The spring works in view units: its bound follows the piece's size on screen.
    spring ??= new SwaySpring({
      frequency: options.frequency,
      damping: options.damping,
      drag: options.drag ?? DEFAULT_DRAG,
      maxLag: length * probe.scale() * Math.sin(Math.min(options.maxAngle * LAG_HEADROOM, Math.PI / 2)),
    });
    probe.toView(tip.x, tip.y, tip.z, at);
    spring.step(dt, at.x, at.y, at.z);
    spring.lag(lag);
    // Back in the pivot's frame: where the soft tip trails to.
    probe.toLocal(trail.set(at.x + lag[0], at.y + lag[1], at.z + lag[2]), bent);
    if (keepOut) {
      const into = (bent.x - tip.x) * keepOut.x + (bent.y - tip.y) * keepOut.y + (bent.z - tip.z) * keepOut.z;
      if (into > room) bent.addScaledVector(keepOut, room - into);
    }
    if (bent.lengthSq() < 1e-12) return;
    swing.setFromUnitVectors(unitTip, bent.normalize());
    const raw = identity.angleTo(swing);
    if (raw < 1e-6) {
      layer.quaternion.identity();
      return;
    }
    const scale = Math.max(gain * Math.min(Math.max(amplitude, 0), 1), 0);
    layer.quaternion.identity().slerp(swing, swayFraction(raw, scale, options.maxAngle));
  }

  return { layer, update, reset };
}

/**
 * The share of a raw swing of `raw` radians to show, scaled by `scale`, eased into the cone: small
 * swings pass nearly as they are, large ones approach `maxAngle` and never pass it.
 */
export function swayFraction(raw: number, scale: number, maxAngle: number): number {
  if (raw <= 0 || scale <= 0 || maxAngle <= 0) return 0;
  const shown = maxAngle * Math.tanh((raw * scale) / maxAngle);
  return Math.min(shown / raw, 1);
}
