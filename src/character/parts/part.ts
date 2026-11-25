/**
 * The runtime contract of a wearable part: what a part factory builds and what the wardrobe
 * (`wardrobe.ts`) drives every frame.
 *
 * Pattern: Strategy (like skins). The wardrobe attaches a part's `group` in its slot (it owns
 * the placement and the grow/shrink swap, never the part's own transforms) and hands it one
 * `PartFrame` per frame; what those dials MEAN (spin faster, ripple faster, glow) is the
 * part's business. Effects arrive already resolved and clamped (`effects.ts`).
 */
import type { Group, Vector3 } from 'three';
import type { MoodParams, MotionProfile } from '../moods';
import type { EffectValues } from './effects';

/** Everything the wardrobe hands a part in one frame (eased values only). */
export interface PartFrame {
  readonly dt: number;
  readonly time: number;
  readonly motion: Readonly<MotionProfile>;
  /** The blended mood (halo speed, glow, scale, presence...), without touch. */
  readonly mood: Readonly<MoodParams>;
  /** Microphone level 0..1, already gated by the mood. */
  readonly voice: number;
  /** The eased work level 0..1. */
  readonly work: number;
  /** How much of the thinking mood is showing 0..1 (eased), for the thinking drama. */
  readonly thinking: number;
  /** The "got it" flash 0..1 as a reply arrives after thinking; 0 otherwise. */
  readonly gotIt: number;
  /** The worn species' head centre in world space (thinking sparks stream into it). */
  readonly head: Readonly<Vector3>;
}

/**
 * Something memory sparks can fly into (the Memory Halo): reserve a node, follow it while it
 * moves, reveal it when the spark lands.
 */
export interface SparkTarget {
  reserveNode(): number;
  nodeWorldPosition(index: number, out: Vector3): Vector3;
  revealNode(index: number, time: number): void;
}

export interface PartInstance {
  /** The part's top object; the wardrobe parents it and never moves it. */
  readonly group: Group;
  /** Present on parts that receive memory sparks. */
  readonly sparkTarget?: SparkTarget;
  /** Height (in the part's own space) it grows from and shrinks into on a swap; default 0. */
  readonly pivotY?: number;
  update(frame: PartFrame): void;
  /** Device pixels per world unit, for parts drawn with glowing point sprites. */
  setPointScale?(scale: number): void;
  /** Frees every GPU resource and detaches `group`. */
  dispose(): void;
}

/** Builds a part with resolved effects; `random` is injectable for deterministic tests. */
export type PartFactory = (effects: EffectValues, random?: () => number) => PartInstance;
