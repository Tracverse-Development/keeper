/**
 * The God Keeper's reaction tuning as data (shape: `soft-pose.ts` `SoftReactions`): it hovers (a
 * deeper, slower float than anyone), answers a poke with grace rather than a jolt, and thinks with a
 * slow, regal tilt and a long look upward.
 */
import type { SoftReactions } from '../soft-pose';

export const GOD_REACTIONS: SoftReactions = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0, lift: 0.07, bodyPitch: 0.03, headPitch: 0.1 },
  pat: { seconds: 1.8, attack: 0.28, holdShare: 0.55, bodyRoll: 0.03, headPitch: 0.06, headRoll: 0.14 },
  think: { workBoost: 0.35, tilt: 0.1, tiltSeconds: 4.6, lookUp: 0.16, gotItWiden: 0.12 },
  work: { vibration: 0, vibrationSpeed: 0, headBob: 0.02, headBobSpeed: 3 },
  celebrate: { hopSpeed: 1.2 },
  sleep: { sink: 0.06 },
  float: 1.8,
};
