/**
 * The robot's reaction tuning as data (shape: `skins/reactions-table.ts`). The poke, pat,
 * hop and timing numbers are the ones the robot first shipped with; `work` adds how it
 * shows effort: eyes shift from warm cream to electric cyan, then to hot amber; the chest
 * light and visor rim heat up; embers rise and the body hums at the very top end.
 */
import type { ReactionTable, WorkTuning } from '../reactions-table';

export interface RobotWorkTuning extends WorkTuning {
  /** The eyes go cyan over [coolFrom, coolTo], then amber over [hotFrom, hotTo]. */
  readonly coolFrom: number;
  readonly coolTo: number;
  readonly hotFrom: number;
  readonly hotTo: number;
  /** Chest-light and visor-rim heat rises over [heatFrom, 1]; the heart gets `heatGlow` times brighter. */
  readonly heatFrom: number;
  readonly heatGlow: number;
  /** Embers and the hum start here and are full at 1. */
  readonly emberFrom: number;
}

export interface RobotReactions extends ReactionTable {
  readonly work: RobotWorkTuning;
}

export const ROBOT_REACTIONS: RobotReactions = {
  poke: { seconds: 0.9, attack: 0.06, holdShare: 0, lift: 0.05, bodyPitch: 0.05, headPitch: 0.14 },
  pat: { seconds: 1.8, attack: 0.28, holdShare: 0.55, bodyRoll: 0.04, headPitch: 0.07, headRoll: 0.16 },
  think: { workBoost: 0.35 },
  work: {
    vibration: 0.007,
    vibrationSpeed: 58,
    headBob: 0,
    headBobSpeed: 0,
    coolFrom: 0.04,
    coolTo: 0.45,
    hotFrom: 0.62,
    hotTo: 1,
    heatFrom: 0.3,
    heatGlow: 1.6,
    emberFrom: 0.68,
  },
  celebrate: { hopSpeed: 1.7 },
  sleep: { sink: 0 },
};
