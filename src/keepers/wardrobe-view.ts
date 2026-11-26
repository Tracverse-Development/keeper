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

/** The outfit with `item` tried on (whatever was in its slot comes off); unchanged for null. */
export function tryOn(wearables: readonly WornPart[], item: WardrobeItem | null, wardrobe: Wardrobe): WornPart[] {
  if (!item) return [...wearables];
  const others = wearables.filter((w) => slotOf(wardrobe, w.part) !== item.slot);
  return [...others, { part: item.part, effects: item.effects, item: item.id }];
}
