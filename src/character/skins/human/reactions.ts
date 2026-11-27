/**
 * The human bodies' reaction tuning as data (shape: `soft-pose.ts` `SoftReactions`): a poke jolts
 * the head back, a pat leans into the hand, thinking tilts the head in slow puzzled waves and looks
 * up, work bobs the head as if keeping time, a cheer hops. Shared by the man and the woman.
 */
import type { SoftReactions } from '../soft-pose';

export const HUMAN_REACTIONS: SoftReactions = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0, lift: 0.05, bodyPitch: 0.05, headPitch: 0.15 },
  pat: { seconds: 1.8, attack: 0.28, holdShare: 0.55, bodyRoll: 0.035, headPitch: 0.08, headRoll: 0.18 },
  think: { workBoost: 0.35, tilt: 0.16, tiltSeconds: 3.6, lookUp: 0.1, gotItWiden: 0.14 },
  work: { vibration: 0, vibrationSpeed: 0, headBob: 0.05, headBobSpeed: 4.2 },
  celebrate: { hopSpeed: 1.7 },
  sleep: { sink: 0.02 },
  float: 0.6,
};
