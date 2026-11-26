/**
 * Being picked up: the person holds the character and moves it. While carried it lifts off its
 * spot, stretches a little as it dangles, leans against the way it is pulled and looks
 * surprised; let go, it settles back by itself. A layer on the expression frame like
 * drowsiness and naps: with nothing carried every channel is left exactly as it was.
 *
 * Pure (no three.js, no DOM): tested by `carry.test.ts`.
 */
import type { ExpressionFrame } from './expression-frame.ts';
import { damp } from './moods.ts';

/** Where it is held, relative to where it was grabbed: -1..1 of the stage each way (y up). */
export interface CarryOffset {
  x: number;
  y: number;
}

/** The carry as the animator holds it: the eased offset and how firmly it is held, 0..1. */
export interface Carry extends CarryOffset {
  held: number;
}

/** How fast it follows the hand, and how fast it settles once let go (1/s). */
export const FOLLOW_RATE = 12;
export const SETTLE_RATE = 5;

function unit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, -1), 1) : 0;
}

/** An offset arriving from outside, clamped; anything that is not one means "not carried". */
export function readCarry(value: unknown): CarryOffset | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { x?: unknown; y?: unknown };
  return { x: unit(v.x), y: unit(v.y) };
}

export function restingCarry(): Carry {
  return { x: 0, y: 0, held: 0 };
}

/** Eases `carry` toward the hand (`target`), or back to rest when it is let go (null). In place. */
export function easeCarry(carry: Carry, target: Readonly<CarryOffset> | null, dt: number): Carry {
  const rate = target ? FOLLOW_RATE : SETTLE_RATE;
  carry.x = damp(carry.x, target?.x ?? 0, rate, dt);
  carry.y = damp(carry.y, target?.y ?? 0, rate, dt);
  carry.held = damp(carry.held, target ? 1 : 0, rate, dt);
  if (!target && carry.held < 1e-3) Object.assign(carry, restingCarry());
  return carry;
}

/** Layers a carry onto `frame`. */
export function addCarry(frame: ExpressionFrame, carry: Readonly<Carry>): ExpressionFrame {
  if (carry.held <= 0 && carry.x === 0 && carry.y === 0) return frame;
  frame.lift += 0.16 * carry.held + 0.5 * carry.y;
  // It hangs from the hand: pulled right, its body trails to the left.
  frame.roll -= 0.4 * carry.x;
  frame.swing += carry.x;
  frame.squash += 0.1 * carry.held;
  frame.wide = Math.max(frame.wide, 0.8 * carry.held);
  frame.mouthO = Math.max(frame.mouthO, 0.45 * carry.held);
  return frame;
}
