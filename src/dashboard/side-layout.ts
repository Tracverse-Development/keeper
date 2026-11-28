/**
 * What may be open beside the keeper at once, so the keeper always keeps room (pure; tested by
 * `side-layout.test.ts`). Three things want the sides of the window: the keepers list (left),
 * the Transcript (right) and the Stage's panels (right, wide). The Stage takes the right side
 * alone; on a window narrower than `WIDE_ENOUGH_FOR_BOTH` the list and the Transcript take turns.
 */

/** Narrower than this (px), the keepers list and the Transcript are not open together. */
export const WIDE_ENOUGH_FOR_BOTH = 1240;

export interface Sides {
  /** The keepers list is open (not folded to its rail). */
  readonly keepers: boolean;
  readonly transcript: boolean;
  /** The Stage's panels are showing. */
  readonly stage: boolean;
}

/** The sides after the keepers list is opened or folded on a window `width` px wide. */
export function toggleKeepers(now: Sides, width: number): Sides {
  // Folded beside the Stage, opening the list puts the Stage away (its Scenes pill brings it back).
  const opening = now.stage || !now.keepers;
  if (!opening) return { ...now, keepers: false };
  return { keepers: true, stage: false, transcript: now.transcript && width >= WIDE_ENOUGH_FOR_BOTH };
}

/** Whether the keepers list may stay open when something opens on the right (the Transcript, Memory). */
export function keepersBeside(keepers: boolean, width: number): boolean {
  return keepers && width >= WIDE_ENOUGH_FOR_BOTH;
}

/** The sides after the Transcript is opened or closed on a window `width` px wide. */
export function setTranscript(now: Sides, open: boolean, width: number): Sides {
  if (!open) return { ...now, transcript: false };
  return { transcript: true, stage: false, keepers: keepersBeside(now.keepers, width) };
}
