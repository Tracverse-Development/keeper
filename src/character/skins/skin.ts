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
 *  - With both touch envelopes at 0 a skin must look exactly as it does without touch, with
 *    `work` at 0 exactly as it does without work, and with the thinking weight and `gotIt`
 *    at 0 exactly as it does without the thinking drama (`thinking.ts`), and with every
 *    `emote` channel at 0 exactly as it does without emotes.
 *  - It declares its slots (`slots`, built from its catalogue row by `anchors.ts`) and keeps
 *    every reaction amplitude and timing in its data table (`reactions`).
 *  - It paints every paint zone its species declares (`paint`, `look/zones.ts`) and publishes a
 *    camera focus for each (`focus`).
 */
import type { Object3D } from 'three';
import type { HitRegion, Mood, TouchKind } from '../contract';
import type { ExpressionFrame } from '../expression-frame';
import type { FaceMix } from '../expression-mix';
import type { ZoneFocus } from '../look/zone-focus';
import type { ResolvedLook } from '../look/zones';
import type { MoodParams, MotionProfile } from '../moods';
import type { SlotAnchors } from './anchors';
import type { ReactionTable } from './reactions-table';

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
  /** The eased work level 0..1 (`work-level.ts`), applied on top of the mood. */
  readonly work: number;
  /** The "got it" flash 0..1 as a reply arrives after thinking (`thinking.ts`); 0 otherwise. */
  readonly gotIt: number;
  /** The least thinking drama the worn thinking effect allows (`thinkDrama`'s floor; 0 = classic). */
  readonly dramaFloor: number;
  /**
   * The playing emote and drowsiness (`expression-frame.ts`): body offsets (squash and
   * stretch, lift, roll, pitch, a spin, a wave, a raised paw) and face amounts (hearts, stars,
   * a wink, wide, sleepy, an "o" mouth). The shared face channels are already folded into
   * `mood`; skins draw the rest their own way. All 0 when nothing plays.
   */
  readonly emote: Readonly<ExpressionFrame>;
  /**
   * The face it wears (`expression-mix.ts`), eased, 0..1 each: happy, focused, sleepy, surprised.
   * Their share of the lids, squint, smile and glow is already folded into `mood`; a skin draws the
   * rest its own way (brows, ears, brow tufts, the visor's glyphs, the mouth). All 0 = its plain face.
   */
  readonly face: Readonly<FaceMix>;
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
  /** Where wearables sit on this body, per slot it offers. */
  readonly slots: SlotAnchors;
  /** The species' reaction tuning (touch timings feed the shared envelopes). */
  readonly reactions: ReactionTable;
  /**
   * Where a camera frames each paint zone this species has (`look/zones.ts` ids), measured from
   * the rig at rest (`look/zone-focus.ts`).
   */
  readonly focus: Readonly<Record<string, ZoneFocus>>;
  /**
   * Repaints the zones: `look` is already validated for this species; a zone left out gets the
   * species' own colour and material back. Called only when the look changes (never per frame).
   */
  paint(look: ResolvedLook): void;
  /**
   * The slots something is worn in right now (the wardrobe says, whenever the outfit changes): a
   * skin with a coat lays it short under clothes (the puppy's fur under a jacket). Optional.
   */
  covered?(slots: readonly string[]): void;
  /**
   * The part ids worn right now (the wardrobe says, whenever the outfit changes), so a skin can
   * play its own small moments with what it wears: the owl adjusts its monocle, Malik checks his
   * watch. Called with the same timing as `covered`. Optional.
   */
  wearing?(parts: readonly string[]): void;
  /** Starts one of its item moments now if what it wears offers it (previews); false otherwise. Optional. */
  playMoment?(id: string): boolean;
  /** Device pixels per world unit, for skins that draw glowing point sprites. */
  setPointScale?(scale: number): void;
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
