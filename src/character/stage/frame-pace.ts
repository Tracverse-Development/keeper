/**
 * The render loop's pacing, pure and node-tested: how much time a frame advances the world, and
 * which animation-frame callbacks draw at all.
 *
 * - `frameStep`: the first frame after a start or a resume advances nothing, and an interval too
 *   long to be a frame (the window was hidden, the Mac slept, a stall) advances one ordinary frame,
 *   so the keeper never jumps or snaps after a pause.
 * - `FramePacer`: while the window is in the background (shown but not focused) the keeper is
 *   drawn at `BACKGROUND_FPS`: it keeps breathing and blinking at half the battery. Focused, every
 *   callback draws.
 *
 * Usage (inside the requestAnimationFrame callback):
 *   if (!pacer.due(now)) return;
 *   const seconds = frameStep(last, now); last = now;
 */

/** An interval longer than this (ms) is a pause, not a frame. */
export const PAUSE_MS = 250;
/** What a frame after a pause advances (s): one 60 fps frame. */
export const RESUME_STEP_S = 1 / 60;
/** The frame rate while the window is shown but not focused. */
export const BACKGROUND_FPS = 30;

/** Seconds this frame advances, from the previous drawn frame's timestamp (undefined = first). */
export function frameStep(lastMs: number | undefined, nowMs: number): number {
  if (lastMs === undefined || !Number.isFinite(lastMs) || !Number.isFinite(nowMs)) return 0;
  const interval = nowMs - lastMs;
  if (interval <= 0) return 0;
  if (interval > PAUSE_MS) return RESUME_STEP_S;
  return interval / 1000;
}

/** Decides which animation-frame callbacks draw (all when focused; `BACKGROUND_FPS` when not). */
export class FramePacer {
  private lastDrawn: number | undefined;
  private background = false;

  /** The window lost (true) or regained (false) focus. */
  setBackground(background: boolean): void {
    this.background = background;
  }

  get inBackground(): boolean {
    return this.background;
  }

  /** Forget the last drawn frame (after a pause): the next callback draws. */
  reset(): void {
    this.lastDrawn = undefined;
  }

  /** Whether the callback at `nowMs` draws (and, if so, it counts as drawn). */
  due(nowMs: number): boolean {
    if (this.background && this.lastDrawn !== undefined) {
      // A little early is on time: callbacks land on the screen's beat, not on ours.
      const interval = 1000 / BACKGROUND_FPS;
      if (nowMs - this.lastDrawn < interval * 0.9) return false;
    }
    this.lastDrawn = nowMs;
    return true;
  }
}
