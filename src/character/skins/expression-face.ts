/**
 * How the soft bodies (the man, the woman, the owl, the God Keeper) draw the face mix
 * (`../expression-mix.ts`, `SkinFrame.face`) with their eyes, brows and mouth:
 *
 *   happy      brows lift a little over smiling eyes (the squint and smile are in the mood already)
 *   focused    brows knit in and down, inner ends lowest; the lower lids rise flat; lips pressed
 *   sleepy     brows settle, outer ends falling, over heavy lids
 *   surprised  brows fly up, the eyes swell, the mouth drops into an "o"
 *
 * `softFacePose` is the shared eye pose (`soft-pose.ts` `softEyePose`) with these added, so a skin
 * swaps one call; `faceMouthO` is the round mouth the face adds to the emote's. With an all-zero mix
 * both return exactly what they did before. Pure (no three.js).
 */
import type { SoftEyePose } from './soft-eyes';
import { softEyePose, type SoftReactions } from './soft-pose';
import type { SkinFrame } from './skin';

/** How far each expression moves the brows (-1..1 dial of `SoftEyePose.brows`). */
const BROW_LIFT = { surprised: 0.95, happy: 0.3, sleepy: -0.15 } as const;
/** How much a surprised face swells the eyes and rounds the mouth. */
const SURPRISE_POP = 0.85;
const SURPRISE_O = 0.7;

/** The soft eyes' pose for this frame: the shared pose plus the face mix's brows and lids. */
export function softFacePose(frame: SkinFrame, R: SoftReactions): SoftEyePose {
  const pose: SoftEyePose = softEyePose(frame, R);
  const m = frame.face;
  const lift = BROW_LIFT.surprised * m.surprised + BROW_LIFT.happy * m.happy + BROW_LIFT.sleepy * m.sleepy;
  pose.brows = Math.min(Math.max((pose.brows ?? 0) + lift, -1), 1);
  pose.knit = m.focused;
  pose.narrow = m.focused * (1 - m.happy);
  pose.droop = m.sleepy;
  pose.pop = Math.max(pose.pop ?? 0, SURPRISE_POP * m.surprised);
  return pose;
}

/** The round "o" of the mouth: the emote's (a yawn, a surprise), or the surprised face's. */
export function faceMouthO(frame: SkinFrame): number {
  return Math.max(frame.emote.mouthO, SURPRISE_O * frame.face.surprised);
}
