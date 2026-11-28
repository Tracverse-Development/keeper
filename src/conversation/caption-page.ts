/**
 * What the captions under the keeper show of a reply: never a wall of text over the character.
 *
 *   captionPage(text, max)   a finished reply's first page: whole sentences up to `max` characters
 *                            (or the first words of one long sentence, with "…"), and whether more
 *                            is waiting in the Transcript.
 *   liveTail(text, max)      a reply still arriving: its last `max` characters from a word start,
 *                            "…" in front when cut, so the newest words stay in view.
 *
 * Pure (tested by `caption-page.test.ts`); `Captions.tsx` draws the result.
 */

/** How much of a reply the captions hold at once (about three lines at caption size). */
export const CAPTION_CHARS = 210;
/** Beside the Stage's panels the keeper's column is narrow: about three short lines. */
export const NARROW_CAPTION_CHARS = 110;

export interface CaptionPage {
  readonly shown: string;
  /** Words left out: the full reply is in the Transcript. */
  readonly more: boolean;
}

/** The first page of a finished reply (see the module doc). */
export function captionPage(text: string, max = CAPTION_CHARS): CaptionPage {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return { shown: clean, more: false };
  // Whole sentences while they fit.
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [clean];
  let shown = '';
  for (const s of sentences) {
    if ((shown + s).trim().length > max) break;
    shown += s;
  }
  if (shown.trim()) return { shown: shown.trim(), more: true };
  // One long sentence: its first words.
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return { shown: `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:]$/, '')}…`, more: true };
}

/** The newest words of a reply still arriving (see the module doc). */
export function liveTail(text: string, max = CAPTION_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trimStart();
  if (clean.length <= max) return clean;
  const tail = clean.slice(clean.length - max);
  const space = tail.indexOf(' ');
  return `…${space >= 0 && space < max * 0.5 ? tail.slice(space + 1) : tail}`;
}
