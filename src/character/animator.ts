/**
 * The per-frame life of the character, shared by every skin: mood blending, the voice,
 * mouth and work followers, blinking, gaze, touch reactions, and handing eased values to
 * the stage (backdrop, lights, sparkles), the wardrobe (the worn parts) and the worn skin.
 *
 * Inputs arrive at any rate (`setMood`, `setVoiceLevel`, `setMouth`, `setWork`, `lookAt`, `react`)
 * and are only RECORDED; `frame(dt)` is the single place they turn into motion, always
 * through frame-rate independent easing (`damp`), so nothing ever snaps. What the dials
 * MEAN for a body is the skin's business (`skins/skin.ts`, Strategy): this class never
 * names a head shape, an ear or a visor.
 *
 * A reply arriving after real thinking (`thinking` -> `speaking`/`happy`) starts the short
 * "got it" flash (`thinking.ts`), handed to the skin and the parts as `gotIt`.
 *
 * Emotes (`emote`, the hello wave at start, idle stretches and glances, drowsiness after a
 * long quiet spell) run in the `EmoteDirector`; its expression frame folds into the shared
 * face and goes to the skin as `emote`, and an idle glance steers the gaze until the pointer
 * moves again.
 *
 * Gaze is aimed at the pointer relative to where the skin's gaze anchor (its head) is on
 * screen (projected every frame), so the eyes look AT the cursor, not at a point offset
 * by the framing. With no pointer for a few seconds the gaze drifts on its own.
 *
 * The keeper's own look, habits and moment effects ride along: `setLook` repaints the worn skin's
 * zones (only when the look changes, and on every new skin), `setHabits` tells the director what
 * it does when idle and how soon it naps, the worn `thinking`/`celebrate` effects are read from
 * the wardrobe whenever the outfit or body changes, and `focusZone` glides the camera onto a
 * paint zone (`stage/camera-focus.ts`).
 */
import { Vector3 } from 'three';
import type { Emote, Mood, TouchKind } from './contract';
import { BlinkScheduler } from './blink';
import type { EffectLayer } from './effects/effect-layer';
import { EmoteDirector } from './emote-director';
import { easeCarry, readCarry, restingCarry, type Carry, type CarryOffset } from './carry';
import { PRIORITY } from './expression';
import { foldExpression } from './expression-frame';
import { blinkPace, easeFeeling, foldFeeling, readFeeling, type FeelingDials } from './feeling';
import { GazeFollower, POINTER_IDLE_SECONDS } from './gaze';
import type { ZoneFocus } from './look/zone-focus';
import { lookKey, resolveLook } from './look/zones';
import { MOOD_NAMES, blendInto, clampUnit, damp, moodTarget, motionProfile, type MoodParams, type MotionProfile } from './moods';
import type { PartFrame } from './parts';
import { foldTouch, reactionEnvelope } from './reactions';
import type { SkinSwitcher } from './skin-switcher';
import type { Skin } from './skins';
import type { Backdrop } from './stage/backdrop';
import { CameraFocus } from './stage/camera-focus';
import type { Stage } from './stage/scene';
import type { TouchSparkles } from './stage/touch-sparkles';
import type { WornPart } from './contract';
import type { Wardrobe } from './wardrobe';
import { gotItEnvelope, isGotIt, thinkDrama } from './thinking';
import { clampWork, easeWork } from './work-level';

/** Easing rates (1/s): moods glide, voice and mouth follow speech closely. */
const MOOD_RATE = 3.2;
const VOICE_RATE = 14;
const MOUTH_RATE = 24;
/** Longest frame step we animate; a longer gap (a stalled tab) is clamped, not jumped. */
const MAX_STEP = 1 / 20;
/** Motes that rise from the head on a pat, and on a skin swap. */
const PAT_SPARKLES = 7;
const SWAP_SPARKLES = 10;
/** The hello wave starts this long after the character first appears. */
const HELLO_DELAY = 0.7;
/** A microphone level above this counts as activity (wakes a drowsy character). */
const VOICE_ACTIVITY = 0.05;

export interface StageParts {
  stage: Stage;
  skins: SkinSwitcher;
  wardrobe: Wardrobe;
  touchSparkles: TouchSparkles;
  backdrop: Backdrop;
  effects: EffectLayer;
}

export class Animator {
  private readonly parts: StageParts;
  private readonly current: MoodParams = moodTarget('idle');
  private target: MoodParams = moodTarget('idle');
  /** The blended mood with touch folded in: what the skin is shown this frame. */
  private readonly expression: MoodParams = moodTarget('idle');
  private readonly weights: Record<Mood, number> = oneHot('idle');
  private targetMood: Mood = 'idle';
  private motion: MotionProfile = motionProfile(false);

  private time = 0;
  private voiceInput = 0;
  private voice = 0;
  private mouthInput = 0;
  private mouth = 0;
  private workInput = 0;
  private work = 0;
  /** Where the person holds it while it is picked up (null: not held), and the eased carry. */
  private carryInput: CarryOffset | null = null;
  private readonly carried: Carry = restingCarry();
  /** The keeper's simulated mood: as given, and eased (what the body shows this frame). */
  private feelingInput: FeelingDials = readFeeling(null);
  private readonly feeling: FeelingDials = readFeeling(null);
  /** When the last "got it" beat started (a reply arriving after thinking). */
  private gotItAt = -Infinity;
  /** The worn skin's head centre in world space, refreshed every frame for the parts. */
  private readonly headPoint = new Vector3();
  /** Reused every frame for the wardrobe (no allocation in the loop). */
  private readonly partFrame: { -readonly [K in keyof PartFrame]: PartFrame[K] };

  private readonly gaze = new GazeFollower();
  private readonly blinks = new BlinkScheduler();
  private readonly director: EmoteDirector;

  private readonly touchStartedAt: Record<TouchKind, number> = { poke: -Infinity, pat: -Infinity };
  private readonly touch: Record<TouchKind, number> = { poke: 0, pat: 0 };

  private readonly headWorld = new Vector3();
  private readonly scratch = new Vector3();

  /** The keeper's look and habits as given (untrusted; resolved per species), and the painted key. */
  private look: unknown = {};
  private habits: unknown = {};
  private paintedKey: string | null = null;
  private readonly camera = new CameraFocus();
  private focusedZone: string | null = null;

  constructor(parts: StageParts) {
    this.parts = parts;
    this.director = new EmoteDirector(parts.effects);
    this.director.emote('wave', 0, PRIORITY.idle, HELLO_DELAY);
    this.partFrame = { dt: 0, time: 0, motion: this.motion, mood: this.current, voice: 0, work: 0, thinking: 0, gotIt: 0, dramaFloor: 0, head: this.headPoint };
    this.refreshMoments();
  }

  /** The keeper's colours and materials per paint zone (repaints only when it changes). */
  setLook(look: unknown): void {
    this.look = look;
    this.paint(this.parts.skins.active, false);
  }

  /** The keeper's habits (idle actions and how soon it naps). */
  setHabits(habits: unknown): void {
    this.habits = habits;
    this.director.setHabits(habits, this.parts.skins.active.id);
  }

  /** Changes what is worn (the wardrobe eases it) and reads the moment effects anew. */
  setWearables(worn: readonly WornPart[]): void {
    this.parts.wardrobe.setWearables(worn);
    this.refreshMoments();
  }

  /** Where a camera frames paint zone `zone` on the worn body, or null when it has no such zone. */
  zoneFocus(zone: string): ZoneFocus | null {
    return this.parts.skins.active.focus[zone] ?? null;
  }

  /** Glides the camera onto paint zone `zone` (null or an unknown zone = the whole character). */
  focusZone(zone: string | null): void {
    this.focusedZone = zone;
    const { stage } = this.parts;
    this.camera.want(zone ? this.zoneFocus(zone) : null, stage.camera, this.camera.busy ? this.camera.target : stage.home.target);
  }

  setMood(mood: Mood): void {
    if (isGotIt(this.targetMood, mood, this.weights.thinking)) this.gotItAt = this.time;
    if (mood !== this.targetMood) this.director.activity();
    this.target = moodTarget(mood);
    this.targetMood = mood;
  }

  setVoiceLevel(level: number): void {
    this.voiceInput = clampUnit(level);
    if (this.voiceInput > VOICE_ACTIVITY) this.director.activity();
  }

  setMouth(openness: number): void {
    this.mouthInput = clampUnit(openness);
  }

  /** The person picked it up and holds it at `offset` (untrusted: clamped), or let go (null). */
  carry(offset: unknown): void {
    this.carryInput = readCarry(offset);
    if (this.carryInput) this.director.activity();
  }

  /** The keeper's simulated mood for the body (untrusted: clamped; null = none). */
  setFeeling(feeling: unknown): void {
    this.feelingInput = readFeeling(feeling);
  }

  setWork(level: number): void {
    this.workInput = clampWork(level);
  }

  lookAt(x: number, y: number): void {
    if (this.gaze.point(x, y)) this.director.activity();
  }

  /** Plays an emote on top of the mood (the director runs its timeline and effects). */
  emote(name: Emote): void {
    this.director.emote(name, this.time);
  }

  /** A memory spark from the chest into the worn halo (nothing when no halo is worn). */
  pulseMemory(): void {
    this.parts.skins.active.sparkOrigin.getWorldPosition(this.scratch);
    this.parts.wardrobe.pulse(this.scratch);
  }

  /** Starts a touch reaction: the envelope, a surprised blink on a poke, sparkles on a pat. */
  react(kind: TouchKind): void {
    this.touchStartedAt[kind] = this.time;
    const skin = this.parts.skins.active;
    skin.react(kind);
    if (kind === 'poke') this.blinks.blinkNow(this.time);
    if (kind === 'pat') {
      skin.touchOrigin.getWorldPosition(this.scratch);
      this.parts.touchSparkles.burst(this.scratch, this.time, PAT_SPARKLES);
    }
    this.director.touch(kind, skin, this.time);
  }

  /** Swaps to an already built skin with the eased transition and a puff of light. */
  setSkin(skin: Skin): void {
    this.parts.skins.active.touchOrigin.getWorldPosition(this.scratch);
    this.parts.touchSparkles.burst(this.scratch.setY(this.scratch.y - 0.6), this.time, SWAP_SPARKLES, 0.9);
    this.parts.skins.swap(skin, this.time);
    this.parts.wardrobe.setSpecies(skin);
    this.paint(skin, true);
    this.director.setHabits(this.habits, skin.id);
    this.refreshMoments();
    if (this.focusedZone) this.focusZone(this.focusedZone);
  }

  setReducedMotion(reduced: boolean): void {
    this.motion = motionProfile(reduced);
  }

  /** Advances the world by `seconds` and renders one frame. */
  frame(seconds: number): void {
    const dt = Math.min(Math.max(seconds, 0), MAX_STEP);
    this.time += dt;
    const p = blendInto(this.current, this.target, MOOD_RATE, dt);
    for (const mood of MOOD_NAMES) this.weights[mood] = damp(this.weights[mood], mood === this.targetMood ? 1 : 0, MOOD_RATE, dt);
    this.voice = damp(this.voice, this.voiceInput * p.voiceGain, VOICE_RATE, dt);
    this.mouth = damp(this.mouth, this.mouthInput, MOUTH_RATE, dt);
    this.work = easeWork(this.work, this.workInput, dt);
    const timing = this.parts.skins.active.reactions;
    this.touch.poke = reactionEnvelope('poke', this.time - this.touchStartedAt.poke, timing.poke);
    this.touch.pat = reactionEnvelope('pat', this.time - this.touchStartedAt.pat, timing.pat);
    const expression = foldTouch(Object.assign(this.expression, p), this.touch);
    // Its mood colours the resting body; asleep (setup, muted) it shows none.
    foldFeeling(expression, easeFeeling(this.feeling, this.feelingInput, dt), 1 - this.weights.asleep);
    const gotIt = gotItEnvelope(this.time - this.gotItAt) * (0.55 + 0.45 * this.motion.amplitude);

    const emote = this.director.step({
      time: this.time,
      dt,
      mood: this.targetMood,
      motion: this.motion,
      pointerStill: this.gaze.pointerIdleSeconds > POINTER_IDLE_SECONDS,
      drama: thinkDrama(this.weights.thinking, this.work, this.director.dramaFloor),
      work: this.work,
      skin: this.parts.skins.active,
      carry: easeCarry(this.carried, this.carryInput, dt),
    });
    foldExpression(expression, emote);
    if (this.director.takeWake()) this.blinks.blinkNow(this.time);
    const blink = this.blinks.step(this.time, dt * blinkPace(this.feeling), expression.eyeOpen);
    this.gaze.step(dt, this.time, p, this.motion, this.headOnScreen(), this.touch, emote);

    const { stage, skins, wardrobe, touchSparkles, backdrop } = this.parts;
    skins.apply({
      dt,
      time: this.time,
      motion: this.motion,
      mood: expression,
      weights: this.weights,
      gaze: this.gaze.gaze,
      blink,
      mouth: this.mouth,
      voice: this.voice,
      touch: this.touch,
      work: this.work,
      gotIt,
      dramaFloor: this.director.dramaFloor,
      emote,
    });

    const partFrame = this.partFrame;
    partFrame.dt = dt;
    partFrame.time = this.time;
    partFrame.motion = this.motion;
    partFrame.voice = this.voice;
    partFrame.work = this.work;
    partFrame.thinking = this.weights.thinking;
    partFrame.gotIt = gotIt;
    partFrame.dramaFloor = this.director.dramaFloor;
    skins.active.gazeAnchor.getWorldPosition(this.headPoint);
    wardrobe.update(partFrame);
    touchSparkles.update(this.time);
    backdrop.update(this.time * this.motion.speed, p.presence);

    const voiceGlow = 1 + this.voice * 0.15;
    stage.faceLight.intensity = 0.45 * expression.glow * voiceGlow;
    for (const rim of stage.rimLights) rim.intensity = 1.25 * (0.3 + 0.7 * p.presence);
    stage.bloom.strength = 0.45 + 0.15 * Math.min(p.haloGlow, 1.6);
    this.camera.step(dt, stage.camera, stage.home);
    stage.render();
  }

  /** Paints `skin` with the keeper's look for its species (a new skin always; else only on change). */
  private paint(skin: Skin, fresh: boolean): void {
    const look = resolveLook(this.look, skin.id);
    const key = `${skin.id}|${lookKey(look)}`;
    if (!fresh && key === this.paintedKey) return;
    this.paintedKey = key;
    skin.paint(look);
  }

  /** Reads the worn moment effects from the wardrobe for the director. */
  private refreshMoments(): void {
    const { wardrobe } = this.parts;
    this.director.setMoments(wardrobe.moment('thinking'), wardrobe.moment('celebrate'));
  }

  /** The gaze anchor's centre in normalised device coordinates (-1..1). */
  private headOnScreen(): { x: number; y: number } {
    this.parts.skins.active.gazeAnchor.getWorldPosition(this.headWorld);
    this.headWorld.project(this.parts.stage.camera);
    return { x: this.headWorld.x, y: this.headWorld.y };
  }
}

function oneHot(mood: Mood): Record<Mood, number> {
  return Object.fromEntries(MOOD_NAMES.map((name) => [name, name === mood ? 1 : 0])) as Record<Mood, number>;
}
