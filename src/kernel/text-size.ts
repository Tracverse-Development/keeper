/**
 * The person's text size: Normal, Large or Larger. Every size on the type scale is multiplied
 * by it (`--text-scale` in tokens.css), so all text grows together and nothing is cut by a
 * zoomed layout. Kept on this device (it is about this screen and these eyes), applied before
 * the first frame.
 */
export const TEXT_SIZES = [
  { id: 'normal', name: 'Normal', scale: 1 },
  { id: 'large', name: 'Large', scale: 1.12 },
  { id: 'larger', name: 'Larger', scale: 1.25 },
] as const;

export type TextSizeId = (typeof TEXT_SIZES)[number]['id'];

const KEY = 'keeper-text-size';

/** The size for a stored value; anything unknown is Normal. */
export function sizeOf(stored: string | null): (typeof TEXT_SIZES)[number] {
  return TEXT_SIZES.find((s) => s.id === stored) ?? TEXT_SIZES[0];
}

/** The chosen size (Normal when nothing is stored or storage is unavailable). */
export function readTextSize(): TextSizeId {
  try {
    return sizeOf(window.localStorage.getItem(KEY)).id;
  } catch {
    return 'normal';
  }
}

/** Apply a size now and remember it. */
export function applyTextSize(id: TextSizeId): void {
  document.documentElement.style.setProperty('--text-scale', String(sizeOf(id).scale));
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Not remembered on this device; still applied for this session.
  }
}
