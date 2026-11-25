/**
 * The mood table: what each mood LOOKS like, as plain numbers, plus the easing maths
 * that moves the character from one mood to the next.
 *
 * Pattern: State, as a lookup table. Each `Mood` maps to one `MoodParams` target; the
 * animator never branches on the mood itself, it only eases its current parameters
 * toward the target of the active mood. Adding a mood is one row here, nothing else.
 *
 * This file is pure (no three.js, no DOM) so it is unit-tested directly with
 * `node --test --experimental-strip-types src/character/moods.test.ts`.
 */
import type { Mood } from './contract';

/** Every visual dial a mood can turn. All values are unitless and eased frame by frame. */
export interface MoodParams {
  /** Eye openness: 0 closed, 1 normal, >1 wide (listening). */
  eyeOpen: number;
  /** Happy squint 0..1: the lower lid rises into a "^" arc. */
  squint: number;
  /** Eye curve: >0 ends rise (a content closed-eye smile), <0 ends droop. */
  eyeBend: number;
  /** Glow multiplier of eyes and mouth (HDR, feeds the bloom). */
  glow: number;
  /** Resting smile of the mouth line, -1..1. */
  smile: number;
  /** Forward lean of the body in radians (listening leans in). */
  lean: number;
  /** Where the gaze rests when nobody is pointing, normalised -1..1. */
  gazeX: number;
  gazeY: number;
  /** How far the idle gaze drifts around its rest point. */
  gazeDrift: number;
  /** Breathing bob amplitude (world units) and speed (cycles per second). */
  bobAmp: number;
  bobSpeed: number;
  /** Nod amplitude in radians (speaking nods gently). */
  nod: number;
  /** Orbit speed of the memory halo in radians per second. */
  haloSpeed: number;
  /** Halo brightness multiplier. */
  haloGlow: number;
  /** Halo radius multiplier (voice level swells it further while listening). */
  haloScale: number;
  /** How strongly the microphone level drives the halo and the ear glow, 0..1. */
  voiceGain: number;
  /** Overall light of the body (rim + ears), 0..1. Asleep dims the whole being. */
  presence: number;
  /** Bounce amplitude of a happy hop (world units). */
  bounce: number;
}

export type MoodTable = Readonly<Record<Mood, Readonly<MoodParams>>>;

const IDLE: MoodParams = {
  eyeOpen: 1,
  squint: 0,
  eyeBend: 0,
  glow: 1,
  smile: 0.25,
  lean: 0,
  gazeX: 0,
  gazeY: 0,
  gazeDrift: 0.35,
  bobAmp: 0.05,
  bobSpeed: 0.22,
  nod: 0,
  haloSpeed: 0.12,
  haloGlow: 1,
  haloScale: 1,
  voiceGain: 0,
  presence: 1,
  bounce: 0,
};

/** The target look of every mood. Rows spread IDLE so each lists only what it changes. */
export const MOOD_TABLE: MoodTable = {
  idle: IDLE,
  listening: {
    ...IDLE,
    eyeOpen: 1.18,
    glow: 1.12,
    smile: 0.15,
    lean: 0.09,
    gazeDrift: 0.08,
    bobAmp: 0.035,
    haloSpeed: 0.2,
    haloGlow: 1.25,
    voiceGain: 1,
  },
  thinking: {
    ...IDLE,
    eyeOpen: 0.82,
    eyeBend: -0.15,
    smile: 0,
    gazeX: 0.45,
    gazeY: 0.55,
    gazeDrift: 0.12,
    haloSpeed: 0.9,
    haloGlow: 1.6,
    haloScale: 1.04,
  },
  speaking: {
    ...IDLE,
    glow: 1.15,
    smile: 0.3,
    gazeDrift: 0.15,
    nod: 0.035,
    haloSpeed: 0.18,
    haloGlow: 1.15,
  },
  happy: {
    ...IDLE,
    eyeOpen: 0.9,
    squint: 1,
    eyeBend: -0.35,
    glow: 1.4,
    smile: 1,
    gazeY: 0.1,
    bobAmp: 0.06,
    haloSpeed: 0.3,
    haloGlow: 1.5,
    haloScale: 1.03,
    bounce: 0.09,
  },
  asleep: {
    ...IDLE,
    eyeOpen: 0,
    eyeBend: 0.45,
    glow: 0.35,
    smile: 0.1,
    lean: -0.04,
    gazeY: -0.35,
    gazeDrift: 0,
    bobAmp: 0.03,
    bobSpeed: 0.12,
    haloSpeed: 0.03,
    haloGlow: 0.3,
    haloScale: 0.96,
    presence: 0.35,
  },
};

export const MOOD_NAMES = Object.keys(MOOD_TABLE) as readonly Mood[];

/** True when `value` is one of the known moods (guards strings arriving from outside). */
export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MOOD_TABLE, value);
}

/** A fresh, mutable copy of a mood's target (the animator owns and mutates its copy). */
export function moodTarget(mood: Mood): MoodParams {
  return { ...MOOD_TABLE[mood] };
}

/**
 * Frame-rate independent exponential easing: moves `current` toward `target` so that
 * after one second only `exp(-rate)` of the gap is left, whatever the frame rate.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  if (dt <= 0) return current;
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Eases every parameter of `current` toward `target` in place (no allocation per frame). */
export function blendInto(current: MoodParams, target: Readonly<MoodParams>, rate: number, dt: number): MoodParams {
  for (const key of Object.keys(target) as (keyof MoodParams)[]) {
    current[key] = damp(current[key], target[key], rate, dt);
  }
  return current;
}

/** Shortest and longest gap between idle blinks, in seconds (the brief: every 3 to 6 s). */
export const BLINK_MIN_GAP = 3;
export const BLINK_MAX_GAP = 6;
/** How long one blink takes, close and reopen, in seconds. */
export const BLINK_DURATION = 0.16;

/** The next blink delay; `random` is injectable so tests are deterministic. */
export function nextBlinkDelay(random: () => number = Math.random): number {
  const r = Math.min(Math.max(random(), 0), 1);
  return BLINK_MIN_GAP + r * (BLINK_MAX_GAP - BLINK_MIN_GAP);
}

/**
 * Lid closure 0..1 at `elapsed` seconds into a blink: a fast close, a slightly slower
 * open (how real blinks feel), 0 outside the blink.
 */
export function blinkClosure(elapsed: number, duration: number = BLINK_DURATION): number {
  if (elapsed <= 0 || elapsed >= duration) return 0;
  const closeTime = duration * 0.4;
  if (elapsed < closeTime) return easeInOut(elapsed / closeTime);
  return 1 - easeInOut((elapsed - closeTime) / (duration - closeTime));
}

/** Smooth 0..1 cubic ease in-out. */
export function easeInOut(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** Clamps a level arriving from outside (microphone, mouth) into 0..1; NaN becomes 0. */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

/** Motion dials for `prefers-reduced-motion`: smaller and slower movement, same moods. */
export interface MotionProfile {
  /** Multiplies every amplitude (bob, tilt, drift, bounce, ripple). */
  amplitude: number;
  /** Multiplies every speed (orbit, waves, drift). */
  speed: number;
}

export function motionProfile(reducedMotion: boolean): MotionProfile {
  return reducedMotion ? { amplitude: 0.4, speed: 0.5 } : { amplitude: 1, speed: 1 };
}
