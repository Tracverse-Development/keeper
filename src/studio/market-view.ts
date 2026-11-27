/**
 * The Marketplace's pure rules (no React, no core): which official items a filter shows, the
 * order they are shown in, where the keeper stands (how many it may wear, what opens next),
 * what a card's button says, and what a pack file says it carries BEFORE it is added. Tested by
 * `market-view.test.ts`. The core still validates every pack on import; the preview only tells
 * the person what they are about to add.
 */
import type { Wardrobe, WardrobeItem } from '../kernel/ipc';
import type { Rarity, StudioInfo } from '../kernel/ipc-studio';
import { lockedUntil, rarityOf } from './studio-view.ts';

export type MarketFilter = 'all' | 'ready' | 'outfit' | 'body' | 'effects';

export const MARKET_FILTERS: { id: MarketFilter; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'ready', name: 'Ready to wear' },
  { id: 'outfit', name: 'Outfit' },
  { id: 'body', name: 'Floating' },
  { id: 'effects', name: 'Effects' },
];

/** One official item as the Marketplace shows it for one keeper. */
export interface Listing {
  item: WardrobeItem;
  rarity: Rarity;
  /** The level it still needs, or null when the keeper's level is high enough. */
  locked: number | null;
  /** The keeper's body has the slot this item goes in, and its race may wear it (`fitsKeeper`). */
  fits: boolean;
  wearing: boolean;
  slotName: string;
  /** The item's own colours, for its picture (empty when it has none). */
  colours: string[];
  /** When its race rule keeps it off this keeper: "Only for humans" (null otherwise). */
  onlyFor: string | null;
}

/** The colours an item is made of (its effect values that are colours). */
export function coloursOf(item: { effects: Record<string, number | string> }): string[] {
  return Object.values(item.effects).filter((v): v is string => typeof v === 'string' && v.startsWith('#'));
}

/**
 * True when `keeper` can put `item` on: its body offers the item's slot AND the item is for its
 * species or race (a human piece never fits the robot; the God Keeper wears everything). The core
 * decides (`wears`, from the same `parts::check` that `wear` applies); an older core without it
 * falls back to the slot alone.
 */
export function fitsKeeper(w: Wardrobe, keeper: string, item: Pick<WardrobeItem, 'id' | 'slot'>): boolean {
  const body = w.keepers.find((k) => k.id === keeper);
  if (!body || !body.slots.includes(item.slot)) return false;
  return body.wears ? body.wears.includes(item.id) : true;
}

/** How a species or race reads in "Only for robots" (plural, plain words). */
const WHO_WORDS: Readonly<Record<string, string>> = { human: 'humans', robot: 'robots', animal: 'animals', divine: 'the God Keeper', puppy: 'dogs', man: 'men', woman: 'women', owl: 'owls', god: 'the God Keeper' };

/**
 * Why `keeper` cannot wear `item`, in a few words ("Biscuit has no wrist", "Only for humans"), or
 * null when it can.
 */
export function misfit(w: Wardrobe, keeper: string, item: Pick<WardrobeItem, 'id' | 'slot' | 'who'>): string | null {
  if (fitsKeeper(w, keeper, item)) return null;
  const body = w.keepers.find((k) => k.id === keeper);
  const slotName = (w.slots.find((s) => s.id === item.slot)?.name ?? item.slot).toLowerCase();
  return onlyFor(w, keeper, item) ?? `${body?.name ?? 'This keeper'} has no ${slotName}`;
}

/** "Only for humans" when the body has the slot but its race may not wear the item; null otherwise. */
function onlyFor(w: Wardrobe, keeper: string, item: Pick<WardrobeItem, 'id' | 'slot' | 'who'>): string | null {
  const body = w.keepers.find((k) => k.id === keeper);
  if (!body || !body.slots.includes(item.slot) || fitsKeeper(w, keeper, item)) return null;
  return item.who?.length ? `Only for ${item.who.map((id) => WHO_WORDS[id] ?? id).join(' and ')}` : null;
}

/** Every official item, as a listing for `keeper` (unfiltered, catalogue order). */
export function listings(w: Wardrobe, info: StudioInfo, keeper: string): Listing[] {
  return w.items
    .filter((item) => item.source === 'official')
    .map((item) => {
      const rarity = rarityOf(info, item);
      return {
        item,
        rarity,
        locked: lockedUntil(rarity, info.experience.level),
        fits: fitsKeeper(w, keeper, item),
        onlyFor: onlyFor(w, keeper, item),
        wearing: item.wornBy.includes(keeper),
        slotName: w.slots.find((s) => s.id === item.slot)?.name ?? item.slot,
        colours: coloursOf(item),
      };
    });
}

/** The listings a filter and a search leave (the search matches the name and the one-liner). */
export function filtered(all: Listing[], w: Wardrobe, filter: MarketFilter, search: string): Listing[] {
  const kind = (slot: string) => w.slots.find((s) => s.id === slot)?.kind ?? 'worn';
  const q = search.trim().toLowerCase();
  return all.filter((l) => {
    if (q && !`${l.item.name} ${l.item.blurb ?? ''}`.toLowerCase().includes(q)) return false;
    switch (filter) {
      case 'ready': return l.locked === null && l.fits;
      case 'outfit': return kind(l.item.slot) === 'worn';
      case 'body': return kind(l.item.slot) === 'floating';
      case 'effects': return kind(l.item.slot) === 'effect';
      default: return true;
    }
  });
}

/** Listings in the order a keeper earns them: most common rarity first, then by name. */
export function earningOrder(info: StudioInfo, shown: Listing[]): Listing[] {
  const rank = (l: Listing) => info.rarities.findIndex((r) => r.id === l.rarity.id);
  return [...shown].sort((a, b) => rank(a) - rank(b) || a.item.name.localeCompare(b.item.name));
}

/** Where the keeper stands: how many items its level opens, and the next rarity to open. */
export function standing(info: StudioInfo, all: Listing[]): { open: number; total: number; next: Rarity | null } {
  const level = Math.max(1, info.experience.level);
  const next = info.rarities.filter((r) => r.level > level).sort((a, b) => a.level - b.level)[0] ?? null;
  return { open: all.filter((l) => l.locked === null).length, total: all.length, next };
}

/** What a listing's button says, and whether it can be pressed. */
export function listingAction(l: Listing): { label: string; can: boolean } {
  if (l.wearing) return { label: 'Wearing', can: false };
  if (l.locked !== null) return { label: `Unlocks at level ${l.locked}`, can: false };
  if (!l.fits) return { label: l.onlyFor ?? `No ${l.slotName.toLowerCase()} to wear it on`, can: false };
  return { label: 'Wear', can: true };
}

/** A pack is small text; the core refuses anything bigger (`packs.rs` MAX_BYTES). */
export const PACK_MAX_BYTES = 64 * 1024;
const PACK_FORMAT = 'keeper-pack/1';

/** Who a pack says made it: a label from the file, never a proof (packs are not signed). */
export interface PackMaker {
  name: string;
  /** A plain https address, or '' when the file gives none that is. */
  link: string;
}

export type PackPreview = { ok: true; kind: 'keeper' | 'soul' | 'variant'; title: string; name: string; carries: string[]; maker: PackMaker | null } | { ok: false; why: string };

const text = (v: unknown, max = 40): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The maker a pack names, cleaned: a name, and its link only when it is a plain https address. */
export function packMaker(value: unknown): PackMaker | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = text(raw.name);
  if (!name) return null;
  const link = typeof raw.link === 'string' ? raw.link.trim() : '';
  return { name, link: /^https:\/\/[^\s"<>\\]{1,192}$/.test(link) ? link : '' };
}

/** What a pack file says it is and carries, in plain words, before anything is added. */
export function packPreview(fileText: string): PackPreview {
  if (fileText.length > PACK_MAX_BYTES) return { ok: false, why: 'That file is too big to be a keeper pack.' };
  let pack: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(fileText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    pack = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, why: "That isn't a keeper pack (or it's damaged)." };
  }
  if (pack.format !== PACK_FORMAT) return { ok: false, why: `This pack is for a different Keeper version (${text(pack.format) || 'unknown'}).` };
  const body = (key: string) => (pack[key] && typeof pack[key] === 'object' ? (pack[key] as Record<string, unknown>) : null);
  const maker = packMaker(pack.maker);
  if (pack.kind === 'soul') {
    const soul = body('soul');
    const name = text(soul?.name);
    if (!soul || !name) return { ok: false, why: 'The soul in this pack has no name.' };
    const traits = Array.isArray(soul.traits) ? soul.traits.length : 0;
    return { ok: true, kind: 'soul', title: 'A soul', name, maker, carries: ['How it speaks and what it is like', ...(traits ? [count(traits, 'trait', 'traits')] : [])] };
  }
  if (pack.kind === 'variant') {
    const variant = body('variant');
    const name = text(variant?.name);
    if (!variant || !name) return { ok: false, why: 'The item in this pack has no name.' };
    return { ok: true, kind: 'variant', title: 'A wardrobe item', name, maker, carries: [`One item for the wardrobe${text(variant.part) ? ` (${text(variant.part).replace(/-/g, ' ')})` : ''}`] };
  }
  if (pack.kind === 'keeper') {
    const keeper = body('keeper');
    const name = text(keeper?.name, 24);
    if (!keeper || !name) return { ok: false, why: 'The keeper in this pack has no name.' };
    const soul = keeper.soul && typeof keeper.soul === 'object' ? text((keeper.soul as Record<string, unknown>).name) : '';
    const worn = Array.isArray(keeper.wearables) ? keeper.wearables.length : 0;
    const painted = keeper.look && typeof keeper.look === 'object' ? Object.keys(keeper.look).length : 0;
    return {
      ok: true,
      kind: 'keeper',
      title: 'A keeper',
      name,
      maker,
      carries: [
        `Its body${text(keeper.species) ? ` (${text(keeper.species)})` : ''} and job${text(keeper.role) ? ` (${text(keeper.role)})` : ''}`,
        ...(soul ? [`Its soul (${soul})`] : []),
        ...(worn ? [`${count(worn, 'outfit item', 'outfit items')}`] : []),
        ...(painted ? ['Its own colours'] : []),
      ],
    };
  }
  return { ok: false, why: "That isn't a keeper pack (or it's damaged)." };
}
