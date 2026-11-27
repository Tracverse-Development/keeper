/**
 * Trying an item on (pure; tested): the outfit with an item put on for a live preview, whatever
 * was in its slot taken off. Used by the Studio's Inventory and Marketplace. The wardrobe's rules
 * themselves live in the core (`kit/wardrobe.rs`).
 */
import type { Wardrobe, WardrobeItem, WornPart } from '../kernel/ipc';

/** The slot a worn part fills, read from the wardrobe's own items. */
function slotOf(wardrobe: Wardrobe, part: string): string | undefined {
  return wardrobe.items.find((i) => i.part === part)?.slot;
}

/**
 * The outfit with `item` tried on (whatever was in its slot comes off); unchanged for null. It
 * carries the item's rarity, so a legendary or mythical piece shows its tier while it is tried on
 * (even before the keeper's level opens it). With `colour` (a swatch id of the item's palette) it
 * is tried on in that colour; an unknown one is its own colours, as the core decides.
 */
export function tryOn(wearables: readonly WornPart[], item: WardrobeItem | null, wardrobe: Wardrobe, colour?: string): WornPart[] {
  if (!item) return [...wearables];
  const others = wearables.filter((w) => slotOf(wardrobe, w.part) !== item.slot);
  const choice = colour ? item.colours?.find((c) => c.id === colour) : undefined;
  const effects = choice ? { ...item.effects, ...choice.effects } : item.effects;
  return [...others, { part: item.part, effects, item: item.id, ...(item.rarity ? { rarity: item.rarity } : {}), ...(choice ? { colour: choice.id } : {}) }];
}

/** Pieces of one set worn together for the set glow (the core's `SET_GLOW_PIECES`). */
export const SET_GLOW_PIECES = 3;

/**
 * The outfit with every piece of a set tried on at once (each piece's slot cleared; the first
 * piece wins a slot two share), glowing as a set when enough pieces are on. Moments are included,
 * so the set's reward plays when the stage thinks or celebrates.
 */
export function tryOnSet(wearables: readonly WornPart[], pieces: readonly WardrobeItem[], wardrobe: Wardrobe, set: string): WornPart[] {
  const chosen: WardrobeItem[] = [];
  for (const piece of pieces) if (!chosen.some((c) => c.slot === piece.slot)) chosen.push(piece);
  const slots = new Set(chosen.map((c) => c.slot));
  const others = wearables.filter((w) => !slots.has(slotOf(wardrobe, w.part) ?? ''));
  const glow = chosen.length >= SET_GLOW_PIECES ? set : undefined;
  return [...others, ...chosen.map((c) => ({ part: c.part, effects: c.effects, item: c.id, rarity: c.rarity, set: glow }))];
}
