/**
 * The per-frame life of the character, shared by every skin: mood blending, the voice
 * and mouth followers, blinking, gaze, touch reactions, and handing eased values to the
 * stage (halo, sparks, ark, backdrop, lights) and to the worn skin.
 *
 * Inputs arrive at any rate (`setMood`, `setVoiceLevel`, `setMouth`, `lookAt`, `react`)
 * and are only RECORDED; `frame(dt)` is the single place they turn into motion, always
 * through frame-rate independent easing (`damp`), so nothing ever snaps. What the dials
 * MEAN for a body is the skin's business (`skins/skin.ts`, Strategy): this class never
 * names a head shape, an ear or a visor.
 *
 * Gaze is aimed at the pointer relative to where the skin's gaze anchor (its head) is on
 * screen (projected every frame), so the eyes look AT the cursor, not at a point offset
 * by the framing. With no pointer for a few seconds the gaze drifts on its own.
 */
import { Vector3 } from 'three';
import type { Mood, TouchKind } from './contract';
import {
  BLINK_DURATION,
  MOOD_NAMES,
  blendInto,
  blinkClosure,
  clampUnit,
  damp,
  moodTarget,
  motionProfile,
  nextBlinkDelay,
  type MoodParams,
  type MotionProfile,
} from './moods';
import { foldTouch, reactionEnvelope } from './reactions';
import type { SkinSwitcher } from './skin-switcher';
import type { Skin } from './skins';
import type { Ark } from './stage/ark';
import type { Backdrop } from './stage/backdrop';
import type { Halo } from './stage/halo';
import type { MemorySparks } from './stage/memory-spark';
import type { Stage } from './stage/scene';
import type { TouchSparkles } from './stage/touch-sparkles';

/** Easing rates (1/s): moods glide, voice and mouth follow speech closely. */
const MOOD_RATE = 3.2;
const VOICE_RATE = 14;
const MOUTH_RATE = 24;
const GAZE_RATE = 6;
const POINTER_IDLE_SECONDS = 3.5;
/** Longest frame step we animate; a longer gap (a stalled tab) is clamped, not jumped. */
const MAX_STEP = 1 / 20;
/** Motes that rise from the head on a pat, and on a skin swap. */
const PAT_SPARKLES = 7;
const SWAP_SPARKLES = 10;

export interface StageParts {
  stage: Stage;
  skins: SkinSwitcher;
  halo: Halo;
  sparks: MemorySparks;
  touchSparkles: TouchSparkles;
  ark: Ark;
  backdrop: Backdrop;
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

  private pointer = { x: 0, y: 0 };
  private pointerAge = Infinity;
  private pointerWeight = 0;
  private gaze = { x: 0, y: 0 };

  private blinkIn = nextBlinkDelay();
  private blinkAt = -1;
  private pendingDoubleBlink = false;

  private readonly touchStartedAt: Record<TouchKind, number> = { poke: -Infinity, pat: -Infinity };
  private readonly touch: Record<TouchKind, number> = { poke: 0, pat: 0 };

  private readonly headWorld = new Vector3();
  private readonly scratch = new Vector3();

  constructor(parts: StageParts) {
    this.parts = parts;
  }

  setMood(mood: Mood): void {
    this.target = moodTarget(mood);
    this.targetMood = mood;
  }

  setVoiceLevel(level: number): void {
    this.voiceInput = clampUnit(level);
  }

  setMouth(openness: number): void {
    this.mouthInput = clampUnit(openness);
  }

  lookAt(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.pointer = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    this.pointerAge = 0;
  }

  pulseMemory(): void {
    this.parts.skins.active.sparkOrigin.getWorldPosition(this.scratch);
    this.parts.sparks.launch(this.scratch, this.time);
  }

  /** Starts a touch reaction: the envelope, a surprised blink on a poke, sparkles on a pat. */
  react(kind: TouchKind): void {
    this.touchStartedAt[kind] = this.time;
    const skin = this.parts.skins.active;
    skin.react(kind);
    if (kind === 'poke' && this.blinkAt < 0) this.blinkAt = this.time;
    if (kind === 'pat') {
      skin.touchOrigin.getWorldPosition(this.scratch);
      this.parts.touchSparkles.burst(this.scratch, this.time, PAT_SPARKLES);
    }
  }

  /** Swaps to an already built skin with the eased transition and a puff of light. */
  setSkin(skin: Skin): void {
    this.parts.skins.active.touchOrigin.getWorldPosition(this.scratch);
    this.parts.touchSparkles.burst(this.scratch.setY(this.scratch.y - 0.6), this.time, SWAP_SPARKLES, 0.9);
    this.parts.skins.swap(skin, this.time);
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
    this.touch.poke = reactionEnvelope('poke', this.time - this.touchStartedAt.poke);
    this.touch.pat = reactionEnvelope('pat', this.time - this.touchStartedAt.pat);
    const expression = foldTouch(Object.assign(this.expression, p), this.touch);

    const blink = this.stepBlink(dt, p);
    this.stepGaze(dt, p);

    const { stage, skins, halo, sparks, touchSparkles, ark, backdrop } = this.parts;
    skins.apply({
      dt,
      time: this.time,
      motion: this.motion,
      mood: expression,
      weights: this.weights,
      gaze: this.gaze,
      blink,
      mouth: this.mouth,
      voice: this.voice,
      touch: this.touch,
    });

    halo.update({
      dt,
      time: this.time,
      speed: p.haloSpeed * this.motion.speed,
      glow: p.haloGlow * (1 + this.voice * 0.7),
      scale: p.haloScale * (1 + this.voice * 0.14 * this.motion.amplitude),
      amplitude: this.motion.amplitude,
    });
    sparks.update(this.time, p.haloGlow);
    touchSparkles.update(this.time);
    ark.update({ time: this.time, amplitude: this.motion.amplitude, speed: this.motion.speed, presence: p.presence });
    backdrop.update(this.time * this.motion.speed, p.presence);

    const voiceGlow = 1 + this.voice * 0.15;
    stage.faceLight.intensity = 0.45 * expression.glow * voiceGlow;
    for (const rim of stage.rimLights) rim.intensity = 1.25 * (0.3 + 0.7 * p.presence);
    stage.bloom.strength = 0.45 + 0.15 * Math.min(p.haloGlow, 1.6);
    stage.render();
  }

  /** Lid closure 0..1 from the idle blink schedule (no blinking while asleep). */
  private stepBlink(dt: number, p: MoodParams): number {
    if (this.blinkAt >= 0) {
      const elapsed = this.time - this.blinkAt;
      if (elapsed < BLINK_DURATION) return blinkClosure(elapsed);
      this.blinkAt = -1;
      this.blinkIn = this.pendingDoubleBlink ? 0.12 : nextBlinkDelay();
      this.pendingDoubleBlink = false;
    }
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && p.eyeOpen > 0.3) {
      this.blinkAt = this.time;
      this.pendingDoubleBlink = !this.pendingDoubleBlink && Math.random() < 0.18;
    }
    return 0;
  }

  /**
   * Eases the gaze toward the pointer (relative to the head on screen) or an idle drift.
   * A poke turns the eyes to the viewer for a moment; a pat lowers them contentedly.
   */
  private stepGaze(dt: number, p: MoodParams): void {
    this.pointerAge += dt;
    const pointerLive = this.pointerAge < POINTER_IDLE_SECONDS ? 1 : 0;
    this.pointerWeight = damp(this.pointerWeight, pointerLive, 2.5, dt);

    const t = this.time * this.motion.speed;
    const driftX = (Math.sin(t * 0.23) + 0.5 * Math.sin(t * 0.61 + 1.3)) / 1.5;
    const driftY = (Math.sin(t * 0.17 + 2.1) + 0.5 * Math.sin(t * 0.53 + 0.4)) / 1.5;
    const idleX = p.gazeX + driftX * p.gazeDrift * this.motion.amplitude;
    const idleY = p.gazeY + driftY * p.gazeDrift * 0.6 * this.motion.amplitude;

    const head = this.headOnScreen();
    // A mood's own gaze (thinking looks up and aside) wins over the pointer as it grows.
    const moodHold = Math.min(1, Math.hypot(p.gazeX, p.gazeY));
    const follow = this.pointerWeight * (1 - 0.75 * moodHold);
    const pointerX = clampSigned((this.pointer.x - head.x) * 1.4);
    const pointerY = clampSigned((this.pointer.y - head.y) * 1.4);

    let targetX = idleX + (pointerX - idleX) * follow;
    let targetY = idleY + (pointerY - idleY) * follow;
    const { poke, pat } = this.touch;
    if (poke > 0) {
      targetX -= targetX * poke;
      targetY -= targetY * poke;
    }
    if (pat > 0) targetY += (-0.2 - targetY) * pat * 0.6;

    this.gaze.x = damp(this.gaze.x, targetX, GAZE_RATE, dt);
    this.gaze.y = damp(this.gaze.y, targetY, GAZE_RATE, dt);
  }

  /** The gaze anchor's centre in normalised device coordinates (-1..1). */
  private headOnScreen(): { x: number; y: number } {
    this.parts.skins.active.gazeAnchor.getWorldPosition(this.headWorld);
    this.headWorld.project(this.parts.stage.camera);
    return { x: this.headWorld.x, y: this.headWorld.y };
  }
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function oneHot(mood: Mood): Record<Mood, number> {
  return Object.fromEntries(MOOD_NAMES.map((name) => [name, name === mood ? 1 : 0])) as Record<Mood, number>;
}
