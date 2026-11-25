/**
 * The `Skin` contract: what one look of the character (the robot, the puppy, ...) must
 * provide so the shared stage can animate it.
 *
 * Pattern: Strategy. The stage (renderer, backdrop, halo, sparks, ark) and the animator
 * (mood easing, breathing clock, gaze, blinks, mouth, touch envelopes) are shared; a skin
 * is the interchangeable strategy that turns those per-frame dials into ITS body: the
 * robot moves glowing glyphs under a visor, the puppy rolls its eyes, flops its ears and
 * wags its tail. A new skin is one folder under `skins/<id>/` exporting a `SkinFactory`,
 * one row in `catalog.ts` and one line in `index.ts`; nothing shared changes.
 *
 * Rules a skin follows:
 *  - It builds everything in its factory and adds nothing to the scene itself: the stage
 *    puts `root` into a holder group (used for the swap transition), so a skin may move
 *    and scale `root` freely every frame.
 *  - `apply` is called once per frame with eased values only; a skin never keeps its own
 *    clock for moods, it reads `frame.time` (and its own spring state if it wants one).
 *  - With both touch envelopes at 0 a skin must look exactly as it does without touch.
 */
import type { Object3D } from 'three';
import type { HitRegion, Mood, TouchKind } from '../contract';
import type { MoodParams, MotionProfile } from '../moods';

/** Everything the shared animator hands a skin in one frame. */
export interface SkinFrame {
  /** Seconds since the last frame (already clamped) and the animator's running time. */
  readonly dt: number;
  readonly time: number;
  /** Reduced-motion dials: multiply amplitudes and speeds by these. */
  readonly motion: Readonly<MotionProfile>;
  /** The shared expression: the blended mood dials with touch reactions folded in. */
  readonly mood: Readonly<MoodParams>;
  /** How much of each mood is showing now (eased, sums to ~1), for a skin's own table. */
  readonly weights: Readonly<Record<Mood, number>>;
  /** Eased gaze, -1..1 on both axes (positive x = screen right, positive y = up). */
  readonly gaze: { readonly x: number; readonly y: number };
  /** Lid closure from blinking, 0 open .. 1 shut (on top of `mood.eyeOpen`). */
  readonly blink: number;
  /** Eased mouth openness 0..1 and microphone level 0..1 (already gated by the mood). */
  readonly mouth: number;
  readonly voice: number;
  /** Touch envelopes 0..1: each rises when a reaction plays and falls back to 0. */
  readonly touch: Readonly<Record<TouchKind, number>>;
}

export interface Skin {
  /** The catalogue id this skin was built for. */
  readonly id: string;
  /** The rig's top object; the stage parents it and never touches its transform. */
  readonly root: Object3D;
  /** Gaze is aimed at the pointer relative to this object's position on screen. */
  readonly gazeAnchor: Object3D;
  /** Memory sparks leave from this object's world position. */
  readonly sparkOrigin: Object3D;
  /** Touch sparkles rise from this object's world position (the top of the head). */
  readonly touchOrigin: Object3D;
  /**
   * The meshes `hitTest` raycasts, per region. Cheap invisible proxies are best (a
   * material with `visible: false` still raycasts); they must follow the rig.
   */
  readonly hitRegions: Readonly<Record<HitRegion, readonly Object3D[]>>;
  /** Turns one frame of shared dials into this skin's pose, materials and lights. */
  apply(frame: SkinFrame): void;
  /**
   * A touch reaction just started. The envelope arrives through `apply`; this is the
   * moment to choose a one-off variation (which way to lean, a random ear flick).
   */
  react(kind: TouchKind): void;
  /** Frees every GPU resource the skin made and detaches `root`. */
  dispose(): void;
}

/** Builds a fresh skin. Factories are cheap to look up and only allocate when called. */
export type SkinFactory = () => Skin;
