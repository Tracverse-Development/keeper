/**
 * The expression state machine on top of the moods: is the character neutral, playing an
 * emote, or drowsy after a long quiet spell?
 *
 *   neutral --trigger--> emoting --(its timeline ends)--> neutral, or drowsy if long quiet
 *   neutral --(quiet for DROWSY_AFTER s while idle)--> drowsy --(any activity)--> neutral
 *   drowsy  --trigger--> emoting
 *
 * Emotes carry a priority: one the dashboard asks for (`asked`) is never cut short by one
 * the character picks for itself (`idle`: the hello wave, stretches, glances); a new asked
 * emote replaces whatever is playing. Every trigger gets a fresh `instance` number, so the
 * director knows to fire that emote's cues again even when the same emote repeats.
 *
 * Pattern: State (a tagged union, one transition function). Pure (no three.js, no DOM):
 * tested by `expression.test.ts`.
 */
import type { Emote, Mood } from './contract';
import { EMOTE_SPECS } from './emotes.ts';

/** Seconds of quiet (no pointer, touch, voice, mood change or emote) before it grows drowsy. */
export const DROWSY_AFTER = 75;

export const PRIORITY = { idle: 1, asked: 2 } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export type ExpressionState =
  | { readonly kind: 'neutral' }
  | { readonly kind: 'emoting'; readonly emote: Emote; readonly startedAt: number; readonly priority: Priority; readonly instance: number }
  | { readonly kind: 'drowsy'; readonly since: number };

const NEUTRAL: ExpressionState = { kind: 'neutral' };

export class ExpressionMachine {
  private current: ExpressionState = NEUTRAL;
  private instances = 0;

  get state(): ExpressionState {
    return this.current;
  }

  /** The playing emote and seconds since it started (negative while delayed), or null. */
  playing(now: number): { emote: Emote; elapsed: number; instance: number } | null {
    const s = this.current;
    return s.kind === 'emoting' ? { emote: s.emote, elapsed: now - s.startedAt, instance: s.instance } : null;
  }

  get drowsy(): boolean {
    return this.current.kind === 'drowsy';
  }

  /**
   * Starts `emote` `delay` seconds after `now`. Refused (false) while an emote of higher
   * priority is still playing.
   */
  trigger(emote: Emote, now: number, priority: Priority = PRIORITY.asked, delay = 0): boolean {
    const s = this.current;
    if (s.kind === 'emoting' && s.priority > priority && now - s.startedAt < EMOTE_SPECS[s.emote].seconds) return false;
    this.instances += 1;
    this.current = { kind: 'emoting', emote, startedAt: now + Math.max(delay, 0), priority, instance: this.instances };
    return true;
  }

  /**
   * Advances the machine: an emote whose timeline ended returns to neutral (or drowsy), a long
   * quiet spell while idle turns drowsy, and activity wakes it. Returns the state.
   */
  step(now: number, quietSeconds: number, mood: Mood): ExpressionState {
    const sleepyTime = mood === 'idle' && quietSeconds >= DROWSY_AFTER;
    const s = this.current;
    if (s.kind === 'emoting') {
      if (now - s.startedAt >= EMOTE_SPECS[s.emote].seconds) this.current = sleepyTime ? { kind: 'drowsy', since: now } : NEUTRAL;
    } else if (s.kind === 'neutral') {
      if (sleepyTime) this.current = { kind: 'drowsy', since: now };
    } else if (!sleepyTime) {
      this.current = NEUTRAL;
    }
    return this.current;
  }
}
