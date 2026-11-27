/**
 * The keeper card: a picture to share (the keeper as it looks, its name, level and soul). This
 * file holds its measurements and words, pure and tested; `KeeperCard.tsx` draws it.
 */

/** The card's size in pixels (4:5, the shape feeds show whole). */
export const CARD = { width: 1080, height: 1350, picture: 1040, margin: 20 } as const;

export interface CardFacts {
  name: string;
  level: number;
  soulName: string;
  species: string;
  /** What it wears worth showing off (`cardOutfit`); absent = the card shows no outfit band. */
  outfit?: CardOutfit;
}

/** The outfit band on the card: the set it wears whole enough to glow, and its rarest piece. */
export interface CardOutfit {
  set: string | null;
  rarest: { name: string; rarity: string; colour: string } | null;
}

/** A worn piece as the card reads it (the core stamps `rarity` and, while three glow, `set`). */
interface WornForCard {
  item?: string;
  rarity?: string;
  set?: string;
}

/**
 * What the card shows of the outfit: the glowing set's name, and the rarest piece worn (the first
 * of equals) with its rarity's name and colour; null when nothing is worth a band.
 */
export function cardOutfit(
  worn: readonly WornForCard[],
  items: readonly { id: string; name: string }[],
  sets: readonly { id: string; name: string }[],
  rarities: readonly { id: string; name: string; level: number; color: string }[],
): CardOutfit | undefined {
  const setId = worn.find((w) => w.set)?.set;
  const set = (setId && sets.find((s) => s.id === setId)?.name) || null;
  const rank = (id: string | undefined) => rarities.findIndex((r) => r.id === id);
  let best: WornForCard | null = null;
  for (const w of worn) {
    if (!w.item || !items.some((i) => i.id === w.item)) continue;
    if (!best || rank(w.rarity) > rank(best.rarity)) best = w;
  }
  const rarity = best && rarities.find((r) => r.id === best.rarity);
  const rarest = best && rarity && rank(rarity.id) > 0 ? { name: items.find((i) => i.id === best.item)?.name ?? '', rarity: rarity.name, colour: rarity.color } : null;
  return set || rarest ? { set, rarest } : undefined;
}

/** The three lines under the picture. */
export function cardLines(k: CardFacts): { title: string; sub: string; foot: string } {
  const species = k.species ? k.species.charAt(0).toUpperCase() + k.species.slice(1) : 'Keeper';
  return { title: k.name.trim() || 'Keeper', sub: `Level ${Math.max(1, Math.floor(k.level))} · ${k.soulName.trim() || 'Its own soul'} · ${species}`, foot: 'My keeper · Keeper by Umoja Ark' };
}

/** The part of a `srcW` × `srcH` picture that fills a `boxW` × `boxH` box when centred (cover). */
export function coverRect(srcW: number, srcH: number, boxW: number, boxH: number): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) return { sx: 0, sy: 0, sw: Math.max(srcW, 0), sh: Math.max(srcH, 0) };
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

/** The largest font size (from `sizes`, largest first) at which `width(size)` fits `max`. */
export function fitSize(sizes: readonly number[], max: number, width: (size: number) => number): number {
  return sizes.find((s) => width(s) <= max) ?? sizes[sizes.length - 1];
}
