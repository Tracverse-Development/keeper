/**
 * Where the eyes look, eased frame by frame: at the pointer (relative to where the head is
 * on screen, so the eyes look AT the cursor, not at a point offset by the framing), or,
 * with no pointer for a few seconds, an idle drift around the mood's own resting gaze.
 *
 * A mood's own gaze (thinking looks up and aside) wins over the pointer as it grows; a poke
 * turns the eyes to the viewer for a moment and a pat lowers them contentedly.
 *
 * Pure (no three.js, no DOM): the caller projects the head onto the screen and passes it in.
 * Tested by `gaze.test.ts`.
 */
import type { TouchKind } from './contract';
import { damp, type MoodParams, type MotionProfile } from './moods.ts';

const GAZE_RATE = 6;
/** Seconds without pointer movement before the gaze drifts on its own. */
export const POINTER_IDLE_SECONDS = 3.5;

export interface ScreenPoint {
  x: number;
  y: number;
}

export class GazeFollower {
  /** The eased gaze, -1..1 on both axes (positive x = screen right, positive y = up). */
  readonly gaze = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  private pointerAge = Infinity;
  private pointerWeight = 0;

  /** Seconds since the pointer last moved (Infinity before it ever did). */
  get pointerIdleSeconds(): number {
    return this.pointerAge;
  }

  /** How much the pointer is steering the gaze now, 0..1 (eased). */
  get following(): number {
    return this.pointerWeight;
  }

  /** The pointer moved to (x, y) in normalised screen space; out-of-range values are clamped. */
  point(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.pointer = { x: clampSigned(x), y: clampSigned(y) };
    this.pointerAge = 0;
    return true;
  }

  /** Eases the gaze toward the pointer or the idle drift; `head` is the head on screen (-1..1). */
  step(dt: number, time: number, p: MoodParams, motion: MotionProfile, head: ScreenPoint, touch: Readonly<Record<TouchKind, number>>): void {
    this.pointerAge += dt;
    const pointerLive = this.pointerAge < POINTER_IDLE_SECONDS ? 1 : 0;
    this.pointerWeight = damp(this.pointerWeight, pointerLive, 2.5, dt);

    const t = time * motion.speed;
    const driftX = (Math.sin(t * 0.23) + 0.5 * Math.sin(t * 0.61 + 1.3)) / 1.5;
    const driftY = (Math.sin(t * 0.17 + 2.1) + 0.5 * Math.sin(t * 0.53 + 0.4)) / 1.5;
    const idleX = p.gazeX + driftX * p.gazeDrift * motion.amplitude;
    const idleY = p.gazeY + driftY * p.gazeDrift * 0.6 * motion.amplitude;

    const moodHold = Math.min(1, Math.hypot(p.gazeX, p.gazeY));
    const follow = this.pointerWeight * (1 - 0.75 * moodHold);
    const pointerX = clampSigned((this.pointer.x - head.x) * 1.4);
    const pointerY = clampSigned((this.pointer.y - head.y) * 1.4);

    let targetX = idleX + (pointerX - idleX) * follow;
    let targetY = idleY + (pointerY - idleY) * follow;
    const { poke, pat } = touch;
    if (poke > 0) {
      targetX -= targetX * poke;
      targetY -= targetY * poke;
    }
    if (pat > 0) targetY += (-0.2 - targetY) * pat * 0.6;

    this.gaze.x = damp(this.gaze.x, targetX, GAZE_RATE, dt);
    this.gaze.y = damp(this.gaze.y, targetY, GAZE_RATE, dt);
  }
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
