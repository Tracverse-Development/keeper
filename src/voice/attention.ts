/**
 * The keeper's attention between sentences in always-listening mode, as the window shows it:
 *   woken      its name was said alone; it waits for the request ("Yes? Kofi is listening.")
 *   following  it has just answered out loud; the next sentence needs no name for a few seconds
 *              (the core's `voice::wake::FOLLOW_WINDOW`).
 *   overheard  it heard a sentence without its name: shows what it heard and that it waits for
 *              its name, so silence never reads as broken (`heard`, shown a moment, never kept).
 * Pure (tested by `attention.test.ts`): `useVoice` keeps the state, the dock says the words.
 */

export type AttentionKind = 'woken' | 'following' | 'overheard';

export interface Attention {
  readonly kind: AttentionKind;
  /** When it lapses (ms since the epoch). */
  readonly until: number;
  /** What it heard (overheard only). */
  readonly heard?: string;
}

/** How long a keeper waits after its name alone (the core forgets nothing; this is only the hint). */
export const WOKEN_MS = 8000;

/** The attention an event starts at `now`; `seconds` is the window the core opened (following). */
export function attentionFrom(kind: AttentionKind, now: number, seconds?: number, heard?: string): Attention {
  const lasts = kind === 'following' ? (seconds ?? 8) * 1000 : kind === 'overheard' ? OVERHEARD_MS : WOKEN_MS;
  return heard === undefined ? { kind, until: now + lasts } : { kind, until: now + lasts, heard };
}

/** How long what it overheard stays on screen. */
export const OVERHEARD_MS = 5000;

/** The words under the keeper while it pays attention, or null when it does not (or it lapsed). */
export function attentionWords(attention: Attention | null, name: string, now: number): string | null {
  if (!attention || now >= attention.until) return null;
  if (attention.kind === 'overheard') return `I heard “${attention.heard ?? ''}”. Say “${name}” first, then what you need.`;
  return attention.kind === 'woken' ? `Yes? ${name} is listening.` : 'Still listening. Just keep talking.';
}
