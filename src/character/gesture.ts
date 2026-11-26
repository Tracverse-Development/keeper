/**
 * The touch gesture classifier: turns raw pointer samples over the canvas into at most
 * one `poke` or `pat` per gesture.
 *
 *   poke - pointer down on the character and up again within CLICK_MS, having moved
 *          less than CLICK_SLOP_PX (a click).
 *   pat  - pointer held down and stroked back and forth over the character: at least
 *          PAT_REVERSALS direction reversals, or PAT_TRAVEL_PX of travel, inside the last
 *          PAT_WINDOW_MS. It fires once; a long stroke re-arms after PAT_REARM_MS and
 *          must earn the next pat from scratch (so a minute of petting is a few pats,
 *          not sixty).
 *   carry - pointer pressed on the character and held still for HOLD_MS, then moved: the
 *          character is picked up (`carry()` gives how far it has been moved); no poke or
 *          pat comes from a carry.
 *   drag - anything else (moved, but not a stroke over the character): no event.
 *
 * Pattern: State (a tiny press state machine). Pure (no DOM, no three.js), so it is
 * unit-tested directly: `gesture.test.ts`. Coordinates are CSS pixels, time milliseconds.
 */
import type { HitRegion, TouchKind } from './contract';

export const CLICK_MS = 250;
export const CLICK_SLOP_PX = 8;
export const PAT_WINDOW_MS = 1200;
export const PAT_REVERSALS = 2;
export const PAT_TRAVEL_PX = 120;
export const PAT_REARM_MS = 1500;
/** Pressing the character this long without moving picks it up. */
export const HOLD_MS = 350;
/** A direction change only counts once the stroke has gone this far the new way. */
const REVERSAL_MIN_PX = 6;

/** One pointer reading: where (CSS px), when (ms) and what part of the character is under it. */
export interface GestureSample {
  x: number;
  y: number;
  t: number;
  region: HitRegion | null;
}

export interface GestureEvent {
  kind: TouchKind;
  region: HitRegion;
}

export type GestureCursor = 'default' | 'pointer' | 'grab';

interface Press {
  start: GestureSample;
  last: GestureSample;
  /** Furthest distance from the start: decides click versus movement. */
  maxDistance: number;
  /** Recent travel over the character (time, length) and reversal times, both windowed. */
  strokes: { t: number; length: number }[];
  reversals: number[];
  /** Per axis: the settled direction (-1, 0, 1) and travel against it (or, unsettled, so far). */
  direction: { x: number; y: number };
  run: { x: number; y: number };
  headTravel: number;
  firedAt: number | null;
  /** The character has been picked up (a still hold, then a move). */
  carrying: boolean;
}

export class GestureTracker {
  private press: Press | null = null;

  /** True while a pointer is held down. */
  get pressed(): boolean {
    return this.press !== null;
  }

  down(sample: GestureSample): void {
    this.press = {
      start: sample,
      last: sample,
      maxDistance: 0,
      strokes: [],
      reversals: [],
      direction: { x: 0, y: 0 },
      run: { x: 0, y: 0 },
      headTravel: 0,
      firedAt: null,
      carrying: false,
    };
  }

  /** Feeds a move; returns a `pat` the moment the stroke qualifies, else null. */
  move(sample: GestureSample): GestureEvent | null {
    const press = this.press;
    if (!press) return null;
    const dx = sample.x - press.last.x;
    const dy = sample.y - press.last.y;
    // Held still on the character long enough, and only now moving: it is being picked up.
    if (!press.carrying && press.start.region && press.firedAt === null && press.maxDistance < CLICK_SLOP_PX && sample.t - press.start.t >= HOLD_MS) press.carrying = true;
    if (press.carrying) {
      press.last = sample;
      return null;
    }
    press.maxDistance = Math.max(press.maxDistance, Math.hypot(sample.x - press.start.x, sample.y - press.start.y));
    if (sample.region) {
      const length = Math.hypot(dx, dy);
      press.strokes.push({ t: sample.t, length });
      if (sample.region === 'head') press.headTravel += length;
      this.trackReversal(press, 'x', dx, sample.t);
      this.trackReversal(press, 'y', dy, sample.t);
    }
    press.last = sample;
    return this.checkPat(press, sample.t);
  }

  /** Ends the press; returns a `poke` for a click on the character, else null. */
  up(sample: GestureSample): GestureEvent | null {
    const press = this.press;
    this.press = null;
    if (!press || press.firedAt !== null) return null;
    const distance = Math.max(press.maxDistance, Math.hypot(sample.x - press.start.x, sample.y - press.start.y));
    const quick = sample.t - press.start.t <= CLICK_MS;
    if (quick && distance < CLICK_SLOP_PX && press.start.region) return { kind: 'poke', region: press.start.region };
    return null;
  }

  /** While the character is picked up: how far the pointer is from where it was grabbed (CSS px); else null. */
  carry(): { dx: number; dy: number } | null {
    const press = this.press;
    return press?.carrying ? { dx: press.last.x - press.start.x, dy: press.last.y - press.start.y } : null;
  }

  /** The pointer left or the press was interrupted: forget it without an event. */
  cancel(): void {
    this.press = null;
  }

  /** The cursor to show: a grabbing hand while stroking, a pointer over the character. */
  cursor(regionUnderPointer: HitRegion | null): GestureCursor {
    const press = this.press;
    if (press && (press.carrying || press.firedAt !== null || (press.maxDistance >= CLICK_SLOP_PX && press.strokes.length > 0))) return 'grab';
    return regionUnderPointer ? 'pointer' : 'default';
  }

  /** Counts a turn when the stroke has gone REVERSAL_MIN_PX against its settled direction. */
  private trackReversal(press: Press, axis: 'x' | 'y', delta: number, t: number): void {
    if (delta === 0) return;
    const settled = press.direction[axis];
    if (settled === 0) {
      // No direction yet: settle on one once the stroke has gone far enough.
      press.run[axis] += delta;
      if (Math.abs(press.run[axis]) >= REVERSAL_MIN_PX) {
        press.direction[axis] = Math.sign(press.run[axis]);
        press.run[axis] = 0;
      }
      return;
    }
    if (Math.sign(delta) === settled) {
      press.run[axis] = 0;
      return;
    }
    press.run[axis] += Math.abs(delta);
    if (press.run[axis] >= REVERSAL_MIN_PX) {
      press.direction[axis] = -settled;
      press.run[axis] = 0;
      press.reversals.push(t);
    }
  }

  private checkPat(press: Press, now: number): GestureEvent | null {
    const since = now - PAT_WINDOW_MS;
    press.strokes = press.strokes.filter((stroke) => stroke.t >= since);
    press.reversals = press.reversals.filter((t) => t >= since);
    if (press.firedAt !== null) {
      if (now - press.firedAt < PAT_REARM_MS) return null;
      // Re-armed: the next pat is earned from fresh movement only.
      press.firedAt = null;
      press.strokes = [];
      press.reversals = [];
      press.headTravel = 0;
      return null;
    }
    const travel = press.strokes.reduce((sum, stroke) => sum + stroke.length, 0);
    if (press.reversals.length < PAT_REVERSALS && travel < PAT_TRAVEL_PX) return null;
    press.firedAt = now;
    return { kind: 'pat', region: press.headTravel > 0 ? 'head' : 'body' };
  }
}
