/**
 * Idle life: while the character is idle and nothing else is playing, it now and then does
 * something on its own, chosen by its HABITS (`habits.ts`): glances around (only when nobody is
 * moving the pointer, so it never fights the gaze following the mouse), stretches, winks, nods,
 * and the species' own: a robot hums, a dog chases its tail or scratches an ear. Each habit's
 * weight (0 never .. 3 often) is its share of the picks; a habit the keeper never set takes the
 * species' default. The gap between actions is random (`IDLE_GAP`), and the clock only runs
 * while it is free to act. (Napping, the `sleep` habit, is a state run by the director.)
 *
 * Pattern: a small scheduler with a weighted pick. Pure (no three.js, no DOM; the random
 * source is injectable): tested by `idle-life.test.ts`.
 */
import type { Emote } from './contract';
import { habitsOf, resolveHabits, type Habits } from './habits.ts';

/** Shortest and longest pause between idle actions (seconds of free time). */
export const IDLE_GAP = [9, 18] as const;

export interface IdleAction {
  readonly emote: Emote;
  readonly weight: number;
  /** Only while nobody is moving the pointer (a glance would fight the gaze). */
  readonly needsStillPointer: boolean;
}

/** The idle actions `habits` give species `species` (weight 0 = never picked). */
export function idleActions(habits: Habits, species: string): IdleAction[] {
  const out: IdleAction[] = [];
  for (const habit of habitsOf(species)) {
    if (habit.emote) out.push({ emote: habit.emote, weight: habits[habit.id] ?? 0, needsStillPointer: Boolean(habit.needsStillPointer) });
  }
  return out;
}

export class IdleLife {
  private readonly random: () => number;
  private waitFor: number;
  private actions: IdleAction[];

  constructor(random: () => number = Math.random, species = 'robot') {
    this.random = random;
    this.waitFor = this.gap();
    this.actions = idleActions(resolveHabits({}, species), species);
  }

  /** The keeper's habits for its species (missing habits take the species' defaults). */
  setHabits(habits: unknown, species: string): void {
    this.actions = idleActions(resolveHabits(habits, species), species);
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
    let total = 0;
    for (const action of this.actions) if (this.allowed(action, pointerStill)) total += action.weight;
    if (total <= 0) return null;
    let roll = this.random() * total;
    let last: Emote | null = null;
    for (const action of this.actions) {
      if (!this.allowed(action, pointerStill)) continue;
      last = action.emote;
      roll -= action.weight;
      if (roll < 0) return action.emote;
    }
    return last;
  }

  private allowed(action: IdleAction, pointerStill: boolean): boolean {
    return action.weight > 0 && (pointerStill || !action.needsStillPointer);
  }

  private gap(): number {
    return IDLE_GAP[0] + this.random() * (IDLE_GAP[1] - IDLE_GAP[0]);
  }
}
