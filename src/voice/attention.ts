/**
 * The keeper's attention between sentences in always-listening mode, as the window shows it:
 *   woken      its name was said alone; it waits for the request ("Yes? Kofi is listening.")
 *   following  it has just answered out loud; the next sentence needs no name for a few seconds
 *              (the core's `voice::wake::FOLLOW_WINDOW`).
 * Pure (tested by `attention.test.ts`): `useVoice` keeps the state, the dock says the words.
 */

export type AttentionKind = 'woken' | 'following';

export interface Attention {
  readonly kind: AttentionKind;
  /** When it lapses (ms since the epoch). */
  readonly until: number;
}

/** How long a keeper waits after its name alone (the core forgets nothing; this is only the hint). */
export const WOKEN_MS = 8000;

/** The attention an event starts at `now`; `seconds` is the window the core opened (following). */
export function attentionFrom(kind: AttentionKind, now: number, seconds?: number): Attention {
  return { kind, until: now + (kind === 'following' ? (seconds ?? 8) * 1000 : WOKEN_MS) };
}

/** The words under the keeper while it pays attention, or null when it does not (or it lapsed). */
export function attentionWords(attention: Attention | null, name: string, now: number): string | null {
  if (!attention || now >= attention.until) return null;
  return attention.kind === 'woken' ? `Yes? ${name} is listening.` : 'Still listening. Just keep talking.';
}
