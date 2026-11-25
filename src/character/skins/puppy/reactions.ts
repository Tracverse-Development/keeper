/**
 * The puppy's reaction tuning as data (shape: `skins/reactions-table.ts`). Poke, pat, hop,
 * curl and timing numbers are the ones the puppy first shipped with; `work` adds how it
 * concentrates: ears perk and twitch, the tail wags faster, the head bobs, it pants with
 * its tongue out at high work and a little sweat drop sparkles at the very top end.
 */
import type { PatTuning, PokeTuning, ReactionTable, SleepTuning, WorkTuning } from '../reactions-table';

export interface PuppyPokeTuning extends PokeTuning {
  readonly earPop: number;
  readonly tailSpeed: number;
  readonly tagSwing: number;
}

export interface PuppyPatTuning extends PatTuning {
  readonly mouth: number;
  readonly tongue: number;
  readonly tailSpeed: number;
  readonly tailWag: number;
  /** Ears flop in (share of their spread) and back (radians). */
  readonly earFlop: number;
  readonly earBack: number;
}

export interface PuppyWorkTuning extends WorkTuning {
  readonly earPerk: number;
  readonly earTwitch: number;
  readonly tailSpeed: number;
  readonly tailWag: number;
  /** Panting (jaw + tongue) rises over [pantFrom, pantTo] at `pantSpeed` breaths/s. */
  readonly pantFrom: number;
  readonly pantTo: number;
  readonly pantSpeed: number;
  /** The sweat drop appears from here (full at 1). */
  readonly sweatFrom: number;
}

export interface PuppySleepTuning extends SleepTuning {
  /** How far the curled head drops and comes forward. */
  readonly headDrop: number;
  readonly headForward: number;
}

export interface PuppyReactions extends ReactionTable {
  readonly poke: PuppyPokeTuning;
  readonly pat: PuppyPatTuning;
  readonly work: PuppyWorkTuning;
  readonly sleep: PuppySleepTuning;
}

export const PUPPY_REACTIONS: PuppyReactions = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0, lift: 0.06, bodyPitch: 0.05, headPitch: 0.16, earPop: 0.6, tailSpeed: 1.5, tagSwing: 0.25 },
  pat: {
    seconds: 1.8,
    attack: 0.28,
    holdShare: 0.55,
    bodyRoll: 0.035,
    headPitch: 0.1,
    headRoll: 0.2,
    mouth: 0.35,
    tongue: 0.8,
    tailSpeed: 3.4,
    tailWag: 0.55,
    earFlop: 0.45,
    earBack: 0.75,
  },
  think: { workBoost: 0.35 },
  work: {
    vibration: 0,
    vibrationSpeed: 0,
    headBob: 0.06,
    headBobSpeed: 4.4,
    earPerk: 0.7,
    earTwitch: 1,
    tailSpeed: 3.2,
    tailWag: 0.25,
    pantFrom: 0.5,
    pantTo: 0.9,
    pantSpeed: 2.6,
    sweatFrom: 0.84,
  },
  celebrate: { hopSpeed: 1.7 },
  sleep: { sink: 0.05, headDrop: 0.14, headForward: 0.16 },
};
