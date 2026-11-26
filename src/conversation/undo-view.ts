/**
 * How long a forgotten or replaced fact can be put back with Undo, and whether that time is up.
 * Pure, so it is tested.
 */

/** Undo is offered this long after a fact leaves memory. */
export const UNDO_MS = 30_000;

/** Is Undo still offered for something that left memory at `leftAt`? */
export function canUndo(leftAt: number, now: number): boolean {
  return now >= leftAt && now - leftAt < UNDO_MS;
}

/** The note under an answer whose records are waiting to be written (nothing is lost). */
export function waitingWords(queued: number): string | null {
  if (queued <= 0) return null;
  return 'Saved on this Mac for now: it reaches your memory as soon as the memory node answers.';
}
