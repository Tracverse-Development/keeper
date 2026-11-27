/**
 * Photo mode's rules, pure and tested: the two kinds of photo the Studio saves, the size each is
 * drawn at, and turning the drawing into the bytes the core is handed. `take-photo.ts` takes and
 * saves one; `PhotoButton.tsx` is the button on the Studio's stage.
 *
 * - `card`: the keeper card (`keeper-card.ts`: the picture, name, level, soul and outfit band),
 *   drawn at `PHOTO_SCALE` times its 1080 x 1350 size.
 * - `portrait`: the keeper alone, framed whole on the stage mood's own background, 4:5, at
 *   `PHOTO_SCALE` times 1080 x 1350.
 */
import { CARD } from './keeper-card.ts';

export type PhotoKind = 'card' | 'portrait';

/** How much finer than its CSS size a photo is drawn (a 1080 x 1350 portrait is 2160 x 2700 pixels). */
export const PHOTO_SCALE = 2;

/** The kinds in the order the Studio offers them, with their names and one line each. */
export const PHOTO_KINDS: readonly { id: PhotoKind; name: string; about: string }[] = [
  { id: 'portrait', name: 'Portrait', about: 'Your keeper on its stage, framed whole.' },
  { id: 'card', name: 'Card', about: 'A card with its name, level and soul.' },
];

/** The keeper's picture each kind asks the stage for, in CSS pixels (drawn at `PHOTO_SCALE`). */
export function photoRequest(kind: PhotoKind): { width: number; height: number; scale: number } {
  return kind === 'card' ? { width: CARD.picture, height: CARD.picture, scale: PHOTO_SCALE } : { width: CARD.width, height: CARD.height, scale: PHOTO_SCALE };
}

const PNG_PREFIX = 'data:image/png;base64,';

/** The base64 bytes of a PNG data URL (what `photo_save` takes), or null when it is not one. */
export function pngBase64(dataUrl: string | null | undefined): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return null;
  const data = dataUrl.slice(PNG_PREFIX.length);
  return data.length > 0 ? data : null;
}

/** The Studio's confirmation once a photo is saved. */
export function savedWords(kind: PhotoKind, shown: string): string {
  return `${kind === 'card' ? 'Card' : 'Portrait'} saved on this Mac in ${shown}.`;
}
