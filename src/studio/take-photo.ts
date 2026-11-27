/**
 * Photo mode, end to end: take a still of the keeper on the Studio's stage (`Character.photo`,
 * drawn offscreen at `PHOTO_SCALE`), make it a card or keep it as a portrait, and hand the PNG to
 * the core (`photo_save`), which checks it, names it and writes it to ~/Pictures/Keeper on this
 * Mac. Nothing is uploaded or shared.
 *
 * Usage:
 *   const saved = await takePhoto('portrait', (r) => photoRef.current?.(r) ?? null, keeper.id, facts);
 *   show(savedWords('portrait', saved.shown));
 */
import type { PhotoRequest } from '../character';
import { core, type PhotoSaved } from '../kernel/ipc';
import { drawCard } from './card-draw';
import type { CardFacts } from './keeper-card';
import { PHOTO_SCALE, photoRequest, pngBase64, type PhotoKind } from './photo-mode';

/** Takes a photo of the stage (null when the stage is not there or cannot be read). */
export type TakeStill = (request: PhotoRequest) => string | null;

/** Take and save one photo of keeper `keeperId`; rejects with a sentence when it cannot. */
export async function takePhoto(kind: PhotoKind, still: TakeStill, keeperId: string, facts: CardFacts): Promise<PhotoSaved> {
  const picture = still(photoRequest(kind));
  if (!picture) throw new Error("I couldn't take the picture. Try again in a moment.");
  const image = kind === 'card' ? await drawCard(picture, facts, PHOTO_SCALE) : picture;
  const data = pngBase64(image);
  if (!data) throw new Error("I couldn't take the picture. Try again in a moment.");
  return core.photoSave(keeperId, data);
}
