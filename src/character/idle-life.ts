/**
 * Idle life: while the character is idle and nothing else is playing, it now and then does
 * something on its own: glances around (only when nobody is moving the pointer, so it never
 * fights the gaze following the mouse), stretches, winks or nods. The gap between actions is
 * random (`IDLE_GAP`), and the clock only runs while it is free to act.
 *
 * Pattern: a small scheduler with a weighted pick. Pure (no three.js, no DOM; the random
 * source is injectable): tested by `idle-life.test.ts`.
 */
import type { Emote } from './contract';

/** Shortest and longest pause between idle actions (seconds of free time). */
export const IDLE_GAP = [9, 18] as const;

export interface IdleAction {
  readonly emote: Emote;
  readonly weight: number;
  /** Only while nobody is moving the pointer (a glance would fight the gaze). */
  readonly needsStillPointer: boolean;
}

export const IDLE_ACTIONS: readonly IdleAction[] = [
  { emote: 'look-around', weight: 4, needsStillPointer: true },
  { emote: 'stretch', weight: 2, needsStillPointer: false },
  { emote: 'nod', weight: 1, needsStillPointer: false },
  { emote: 'wink', weight: 1, needsStillPointer: false },
];

export class IdleLife {
  private readonly random: () => number;
  private waitFor: number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.waitFor = this.gap();
  }

  /**
   * Counts down `dt` seconds of free time (`free`: idle mood, nothing playing); when the pause
   * is over returns the action to play (or null), and starts the next pause.
   */
  step(dt: number, free: boolean, pointerStill: boolean): Emote | null {
    if (!free) return null;
    this.waitFor -= dt;
    if (this.waitFor > 0) return null;
    this.waitFor = this.gap();
    const options = IDLE_ACTIONS.filter((action) => pointerStill || !action.needsStillPointer);
    const total = options.reduce((sum, action) => sum + action.weight, 0);
    let roll = this.random() * total;
    for (const action of options) {
      roll -= action.weight;
      if (roll < 0) return action.emote;
    }
    return options[options.length - 1]?.emote ?? null;
  }

  private gap(): number {
    return IDLE_GAP[0] + this.random() * (IDLE_GAP[1] - IDLE_GAP[0]);
  }
}
