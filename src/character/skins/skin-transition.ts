/**
 * The skin swap as a pure timeline: how big the outgoing and incoming skins are at
 * `elapsed` seconds into a swap. The outgoing skin shrinks away (ease in), the incoming
 * one starts growing before the old is gone and settles with a small overshoot, so the
 * hand-over reads as one gesture rather than a cut. Tested by `skin-transition.test.ts`.
 */

/** Whole swap length, and the windows of each half (seconds). */
export const SWAP_SECONDS = 0.9;
const OUT_END = 0.5;
const IN_START = 0.22;

export interface SwapPose {
  /** Scale of the outgoing skin (0 = gone) and of the incoming skin (1 = settled). */
  outgoing: number;
  incoming: number;
  /** True once the swap is over and the outgoing skin can be freed. */
  done: boolean;
}

export function swapPose(elapsed: number): SwapPose {
  const t = Number.isFinite(elapsed) ? Math.max(elapsed, 0) : SWAP_SECONDS;
  const out = Math.min(t / OUT_END, 1);
  const into = Math.min(Math.max((t - IN_START) / (SWAP_SECONDS - IN_START), 0), 1);
  return {
    outgoing: 1 - out * out * out,
    incoming: into <= 0 ? 0 : into >= 1 ? 1 : Math.max(easeOutBack(into), 0),
    done: t >= SWAP_SECONDS,
  };
}

/** 0 -> 1 with a gentle overshoot (~6%) before settling. */
function easeOutBack(x: number): number {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}
