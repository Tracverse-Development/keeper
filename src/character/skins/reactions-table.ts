/**
 * The shared shape of a species' reaction tuning: how a body answers a poke and a pat, how
 * thinking amplifies work, how it works, celebrates and sleeps, as plain numbers.
 *
 * Each species keeps its table in `skins/<id>/reactions.ts` (data only) and its animation
 * code reads every amplitude and timing from there, so a future pack can retune a body
 * without code. A species may extend a section with fields only its body has (the puppy's
 * ears and tail, the robot's heat colours); the shared fields below are required for all.
 *
 * Pure (types plus one list): the tables are tested by `skins/reactions.test.ts`.
 */

/** A touch reaction's envelope: total length, rise time, and the share of it held at full. */
export interface ReactionTiming {
  readonly seconds: number;
  readonly attack: number;
  /** The envelope holds at 1 until `seconds * holdShare` (never before the attack ends). */
  readonly holdShare: number;
}

/** A quick click: a jolt up, the body and head pitch back. */
export interface PokeTuning extends ReactionTiming {
  readonly lift: number;
  readonly bodyPitch: number;
  readonly headPitch: number;
}

/** A stroke: the body and head lean into the hand (to a side picked per pat). */
export interface PatTuning extends ReactionTiming {
  readonly bodyRoll: number;
  readonly headPitch: number;
  readonly headRoll: number;
}

/** Thinking: how much the thinking mood amplifies the work level (0 = not at all). */
export interface ThinkTuning {
  readonly workBoost: number;
}

/** Working: a fast vibration and a concentrating head bob (either may be 0). */
export interface WorkTuning {
  readonly vibration: number;
  readonly vibrationSpeed: number;
  readonly headBob: number;
  readonly headBobSpeed: number;
}

/** Celebrating (the happy mood): how fast the hop repeats. */
export interface CelebrateTuning {
  readonly hopSpeed: number;
}

/** Sleeping: how far the whole body sinks when fully asleep (curled). */
export interface SleepTuning {
  readonly sink: number;
}

export interface ReactionTable {
  readonly poke: PokeTuning;
  readonly pat: PatTuning;
  readonly think: ThinkTuning;
  readonly work: WorkTuning;
  readonly celebrate: CelebrateTuning;
  readonly sleep: SleepTuning;
}

/** The sections every table has, and the fields each section must carry. */
export const REACTION_FIELDS: Readonly<Record<keyof ReactionTable, readonly string[]>> = {
  poke: ['seconds', 'attack', 'holdShare', 'lift', 'bodyPitch', 'headPitch'],
  pat: ['seconds', 'attack', 'holdShare', 'bodyRoll', 'headPitch', 'headRoll'],
  think: ['workBoost'],
  work: ['vibration', 'vibrationSpeed', 'headBob', 'headBobSpeed'],
  celebrate: ['hopSpeed'],
  sleep: ['sink'],
};
