/**
 * The Inventory's pure rules: which mods a filter shows, and their order (rarest first, then
 * what this keeper wears, then by name). Tested by `inventory-view.test.ts`.
 */
import type { Wardrobe, WardrobeItem } from '../kernel/ipc';

export type InventoryFilter = 'all' | 'body' | 'outfit' | 'effects' | 'yours' | 'wearing';

export const FILTERS: { id: InventoryFilter; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'wearing', name: 'Wearing' },
  { id: 'outfit', name: 'Outfit' },
  { id: 'body', name: 'Floating' },
  { id: 'effects', name: 'Effects' },
  { id: 'yours', name: 'Made by you' },
];

const RARITY_ORDER = ['mythical', 'legendary', 'rare', 'uncommon', 'common'];

/** The mods a filter shows for `keeper`, in Inventory order; `search` matches the name. */
export function inventory(w: Wardrobe, keeper: string, filter: InventoryFilter, search: string, rarityOf: (i: WardrobeItem) => string): WardrobeItem[] {
  const kind = (slot: string) => w.slots.find((s) => s.id === slot)?.kind ?? 'worn';
  const q = search.trim().toLowerCase();
  const keep = (i: WardrobeItem) => {
    if (q && !i.name.toLowerCase().includes(q)) return false;
    switch (filter) {
      case 'wearing': return i.wornBy.includes(keeper);
      case 'outfit': return kind(i.slot) === 'worn';
      case 'body': return kind(i.slot) === 'floating';
      case 'effects': return kind(i.slot) === 'effect';
      case 'yours': return i.source === 'yours';
      default: return true;
    }
  };
  const rank = (i: WardrobeItem) => RARITY_ORDER.indexOf(rarityOf(i));
  return w.items.filter(keep).sort((a, b) => rank(a) - rank(b) || Number(b.wornBy.includes(keeper)) - Number(a.wornBy.includes(keeper)) || a.name.localeCompare(b.name));
}
