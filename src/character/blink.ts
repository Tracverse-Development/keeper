/**
 * The blink scheduler: when the eyes blink, as a lid closure 0..1 per frame.
 *
 * Natural blinking is irregular: a random gap between blinks (`nextBlinkDelay`, 3 to 6 s),
 * now and then a quick double blink, never while the eyes are nearly shut (asleep, drowsy),
 * and an immediate blink on demand (a poke, waking up). One blink is a fast close and a
 * slightly slower open (`blinkClosure`).
 *
 * Pattern: State (resting / blinking, with a pending double blink). Pure (no three.js, no
 * DOM; the random source is injectable): tested by `blink.test.ts`.
 */
import { BLINK_DURATION, blinkClosure, nextBlinkDelay } from './moods.ts';

/** Share of blinks that are followed by a second one, and the gap before it (s). */
export const DOUBLE_BLINK_CHANCE = 0.18;
export const DOUBLE_BLINK_GAP = 0.12;
/** Below this eye openness the scheduler does not start a blink (the eyes are already low). */
export const BLINK_MIN_OPEN = 0.3;

export class BlinkScheduler {
  private readonly random: () => number;
  private blinkIn: number;
  private blinkAt = -1;
  private pendingDoubleBlink = false;
  /** True while the playing blink is itself the second of a double (it may not earn a third). */
  private secondOfDouble = false;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.blinkIn = nextBlinkDelay(random);
  }

  /** True while a blink is playing. */
  get blinking(): boolean {
    return this.blinkAt >= 0;
  }

  /** Blinks now (unless a blink is already playing). */
  blinkNow(time: number): void {
    if (this.blinkAt < 0) this.blinkAt = time;
  }

  /** Lid closure 0..1 at `time`, `dt` seconds after the last call; `eyeOpen` gates new blinks. */
  step(time: number, dt: number, eyeOpen: number): number {
    if (this.blinkAt >= 0) {
      const elapsed = time - this.blinkAt;
      if (elapsed < BLINK_DURATION) return blinkClosure(elapsed);
      this.blinkAt = -1;
      this.blinkIn = this.pendingDoubleBlink ? DOUBLE_BLINK_GAP : nextBlinkDelay(this.random);
      this.secondOfDouble = this.pendingDoubleBlink;
      this.pendingDoubleBlink = false;
    }
    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && eyeOpen > BLINK_MIN_OPEN) {
      this.blinkAt = time;
      // A double blink never chains into a third (FIX-0007).
      this.pendingDoubleBlink = !this.secondOfDouble && this.random() < DOUBLE_BLINK_CHANCE;
    }
    return 0;
  }
}
