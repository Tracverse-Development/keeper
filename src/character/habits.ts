/**
 * Habits: what a keeper does on its own when left idle, and how often, as weights from 0 (never)
 * to 3 (often). Unique per keeper (`KeeperProfile.habits`); a species may offer habits only it has
 * (only a dog chases its tail or scratches an ear, only a robot hums). Ids and the species that
 * own them mirror the core (`src-tauri/src/keepers/kit/look.rs` `HABITS`; `structure.test.ts`
 * keeps them equal).
 *
 * Every habit but `sleep` is an idle emote picked by `idle-life.ts` with its weight; `sleep` sets
 * how soon a quiet keeper dozes off and naps (`napAfter`). A habit left out of a keeper's map takes
 * the species' default (`SPECIES_HABITS`), so a keeper with no habits behaves as it always did.
 *
 * Pure (no three.js, no DOM): tested by `habits.test.ts`.
 */
import type { Emote } from './contract';

export interface HabitInfo {
  readonly id: string;
  /** The emote it plays when picked (none for `sleep`, which is a state, not an emote). */
  readonly emote?: Emote;
  /** Species that have it; empty = every species. */
  readonly only: readonly string[];
  /** Only while nobody is moving the pointer (a glance would fight the gaze). */
  readonly needsStillPointer?: boolean;
}

export const HABITS: readonly HabitInfo[] = [
  { id: 'sleep', only: [] },
  { id: 'stretch', emote: 'stretch', only: [] },
  { id: 'look-around', emote: 'look-around', only: [], needsStillPointer: true },
  { id: 'wink', emote: 'wink', only: [] },
  { id: 'nod', emote: 'nod', only: [] },
  { id: 'hum', emote: 'hum', only: ['robot'] },
  { id: 'chase-tail', emote: 'chase-tail', only: ['puppy'] },
  { id: 'scratch', emote: 'scratch', only: ['puppy'] },
];

export const MAX_HABIT = 3;

/**
 * Each species' own habits when the keeper says nothing. The shared four keep the ratio the
 * idle life always had (look-around 4 : stretch 2 : nod 1 : wink 1).
 */
export const SPECIES_HABITS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  robot: { sleep: 1, stretch: 1, 'look-around': 2, wink: 0.5, nod: 0.5, hum: 1 },
  puppy: { sleep: 1, stretch: 1, 'look-around': 2, wink: 0.5, nod: 0.5, 'chase-tail': 0.8, scratch: 0.8 },
};

/** Seconds of quiet before a keeper with `sleep` weight 1 dozes; heavier sleepers doze sooner. */
export const DOZE_AFTER = 75;
/** Seconds of dozing (heavy lids) before the doze becomes a real nap. */
export const NAP_AFTER_DOZE = 12;

export type Habits = Readonly<Record<string, number>>;

/** The habits species `species` has. */
export function habitsOf(species: string): readonly HabitInfo[] {
  return HABITS.filter((h) => h.only.length === 0 || h.only.includes(species));
}

/**
 * A keeper's habits for `species`: its own weights (clamped 0..MAX_HABIT; NaN and unknown ids
 * dropped) over the species' defaults. Every habit the species has gets a weight.
 */
export function resolveHabits(input: unknown, species: string): Habits {
  const own = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const defaults = SPECIES_HABITS[species] ?? {};
  const out: Record<string, number> = {};
  for (const habit of habitsOf(species)) {
    const given = Object.prototype.hasOwnProperty.call(own, habit.id) ? own[habit.id] : undefined;
    out[habit.id] = typeof given === 'number' && Number.isFinite(given) ? Math.min(Math.max(given, 0), MAX_HABIT) : (defaults[habit.id] ?? 1);
  }
  return out;
}

/** Seconds of quiet before dozing at `sleep` weight (Infinity at 0: it never dozes). */
export function dozeAfter(sleepWeight: number): number {
  if (!(sleepWeight > 0)) return Infinity;
  return (DOZE_AFTER * 1.5) / (0.5 + Math.min(sleepWeight, MAX_HABIT));
}

/** A stable key for a set of habits. */
export function habitsKey(habits: Habits): string {
  return Object.keys(habits)
    .sort()
    .map((id) => `${id}=${habits[id]}`)
    .join(';');
}
