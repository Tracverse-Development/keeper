/**
 * The owl's reaction tuning as data (shape: `soft-pose.ts` `SoftReactions`): a calmer body than a
 * person's (smaller hops, slower puzzled tilts), a longer think, and a little more poke in the head.
 */
import type { SoftReactions } from '../soft-pose';

export const OWL_REACTIONS: SoftReactions = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0, lift: 0.04, bodyPitch: 0.04, headPitch: 0.18 },
  pat: { seconds: 1.8, attack: 0.28, holdShare: 0.55, bodyRoll: 0.03, headPitch: 0.08, headRoll: 0.22 },
  think: { workBoost: 0.3, tilt: 0.3, tiltSeconds: 4.2, lookUp: 0.06, gotItWiden: 0.18 },
  work: { vibration: 0, vibrationSpeed: 0, headBob: 0.04, headBobSpeed: 3.2 },
  celebrate: { hopSpeed: 1.4 },
  sleep: { sink: 0.04 },
  float: 0.5,
};
