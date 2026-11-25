/**
 * The thinking beat: the timing and easing curves that make the `thinking` mood cinematic
 * (the robot's scanning eyes and pulse rings, the puppy's puzzled tilt and thought bubble,
 * the halo's travelling waves and streaming sparks) and the "got it" flash when an answer
 * arrives. Species and parts read these curves; this file only says WHEN and HOW MUCH.
 *
 *   drama = thinkDrama(weights.thinking, work)    0 at rest, ~0.6 thinking idle, 1 flat out
 *   every visual is `drama * curve(cyclePhase(time, period))`, so it eases in and out with
 *   the mood weight (already eased by the animator) and never snaps.
 *
 * Every curve is exactly 0 where the effect should be absent, so a non-thinking mood looks
 * exactly as it did before thinking had any drama.
 *
 * Pure (no three.js, no DOM): tested by `thinking.test.ts`.
 */
import type { Mood } from './contract';
import { band, clampWork } from './work-level.ts';

/** Seconds between the robot's energy pulse rings, and the length of one "got it" flash. */
export const THINK_PULSE_SECONDS = 1.2;
export const GOT_IT_SECONDS = 0.75;
/** The thinking weight that must be showing for an arriving reply to earn a "got it". */
export const GOT_IT_MIN_WEIGHT = 0.25;

/**
 * How dramatic thinking looks, 0..1: the thinking mood's weight, scaled up by work
 * (0.6 of full drama while thinking at rest, 1 at full work).
 */
export function thinkDrama(thinkingWeight: number, work: number): number {
  const weight = clampWork(thinkingWeight);
  if (weight === 0) return 0;
  return weight * (0.6 + 0.4 * clampWork(work));
}

/** Where `time` is inside a repeating cycle of `period` seconds, 0..1 (negative time too). */
export function cyclePhase(time: number, period: number): number {
  if (!(period > 0) || !Number.isFinite(time)) return 0;
  const x = time / period;
  return x - Math.floor(x);
}

/** A heartbeat "lub-dub" at `phase` 0..1 of one beat: two soft bumps, peak 1, rest ~0. */
export function heartbeat(phase: number): number {
  const lub = Math.exp(-(((phase - 0.1) / 0.05) ** 2));
  const dub = 0.6 * Math.exp(-(((phase - 0.3) / 0.06) ** 2));
  return Math.min(1, lub + dub);
}

/** Heartbeats per second: calm while thinking at rest, quicker as work rises. */
export function heartbeatRate(work: number): number {
  return 1.1 + 1.5 * clampWork(work);
}

/** A scan bar's position -1..1 at `phase`: sweeps across and back, slowing at each end. */
export function scanSweep(phase: number): number {
  return -Math.cos(phase * Math.PI * 2);
}

/** One radiating pulse ring at `phase` 0..1 of its life: radius multiplier and opacity. */
export interface RingPulse {
  radius: number;
  fade: number;
}

/** Writes the ring's growth (fast then slowing) and fade (in quickly, out slowly) into `out`. */
export function ringPulse(phase: number, out: RingPulse): RingPulse {
  const p = Math.min(Math.max(phase, 0), 1);
  out.radius = 1 + 1.3 * (1 - (1 - p) ** 3);
  out.fade = band(p, 0, 0.08) * (1 - p) ** 2;
  return out;
}

/** The "got it" flash, 0..1, `elapsed` seconds after a reply arrived: quick rise, smooth fall. */
export function gotItEnvelope(elapsed: number, seconds: number = GOT_IT_SECONDS): number {
  if (!(elapsed > 0) || elapsed >= seconds) return 0;
  const attack = seconds * 0.12;
  if (elapsed < attack) return band(elapsed, 0, attack);
  return (1 - (elapsed - attack) / (seconds - attack)) ** 2;
}

/** True when a mood change is a reply arriving after real thinking (worth a "got it"). */
export function isGotIt(previous: Mood, next: Mood, thinkingWeight: number): boolean {
  return previous === 'thinking' && (next === 'speaking' || next === 'happy') && thinkingWeight >= GOT_IT_MIN_WEIGHT;
}

/** A travelling wave over the halo's nodes: 0..1 lit at `angle` (radians) at `time`. */
export function nodeWave(angle: number, time: number, speed: number): number {
  const s = Math.sin(angle * 3 - time * speed);
  return s > 0 ? s ** 6 : 0;
}

/** One dot of a thought bubble: its size multiplier, brightness and upward drift. */
export interface BubbleDot {
  size: number;
  bright: number;
  rise: number;
}

/**
 * Thought-bubble dot `index` (0, 1, 2) at `phase` 0..1 of the loop: the dots appear one by
 * one, hold, then all pop together (swell and vanish), and the loop rests before repeating.
 */
export function bubbleDot(index: number, phase: number, out: BubbleDot): BubbleDot {
  const appear = 0.06 + 0.17 * index;
  const grow = band(phase, appear, appear + 0.12);
  const pop = band(phase, 0.72, 0.8);
  const gone = band(phase, 0.76, 0.86);
  out.size = grow * (1 + 0.9 * pop);
  out.bright = grow * (1 + 0.5 * pop) * (1 - gone);
  out.rise = phase * 0.12;
  return out;
}

/** A side-to-side sway that lingers at each side (a puzzled head tilt), -1..1. */
export function holdWave(phase: number): number {
  const s = Math.sin(phase * Math.PI * 2);
  return (s / Math.sqrt(s * s + 0.15)) * Math.sqrt(1.15);
}

/** A brief flick at the start of each cycle (an ear twitch), 0..1, 0 most of the cycle. */
export function twitch(phase: number): number {
  const s = Math.sin(phase * Math.PI * 2);
  return s > 0 ? s ** 12 : 0;
}

/** Three quick sniffs at the start of each cycle, then rest: 0..1. */
export function sniff(phase: number): number {
  if (phase <= 0 || phase >= 0.36) return 0;
  return Math.sin((Math.PI * phase) / 0.12) ** 2;
}
