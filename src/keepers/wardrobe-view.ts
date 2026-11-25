/**
 * What the Wardrobe section shows (pure; tested): the person's items grouped by slot for one
 * keeper (what it wears, who else does, whether its body offers the slot at all), the outfit with
 * an item tried on for the live preview, the colours to draw an item's swatches with, and the
 * keepers it can be given to. The rules themselves live in the core (`kit/wardrobe.rs`); this only
 * arranges what the core sent.
 */
import type { SlotInfo, Wardrobe, WardrobeItem, WardrobeKeeper, WornPart } from '../kernel/ipc';

export interface ItemView {
  item: WardrobeItem;
  /** The keeper being dressed wears it. */
  wornHere: boolean;
  /** The names of the other keepers wearing it. */
  others: string[];
}

export interface SlotGroup {
  slot: SlotInfo;
  /** The keeper's body offers this slot (otherwise its items cannot be worn by it). */
  offered: boolean;
  items: ItemView[];
}

/** The wardrobe by slot (in slot order) as seen by keeper `keeperId`. */
export function slotGroups(wardrobe: Wardrobe, keeperId: string): SlotGroup[] {
  const body = wardrobe.keepers.find((k) => k.id === keeperId);
  const names = new Map(wardrobe.keepers.map((k) => [k.id, k.name]));
  return wardrobe.slots.map((slot) => ({
    slot,
    offered: Boolean(body?.slots.includes(slot.id)),
    items: wardrobe.items
      .filter((item) => item.slot === slot.id)
      .map((item) => ({
        item,
        wornHere: item.wornBy.includes(keeperId),
        others: item.wornBy.filter((id) => id !== keeperId).map((id) => names.get(id) ?? id),
      })),
  }));
}

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

/** Said when a body has no such slot ("Pup has no back to wear these on."). */
export function missingSlotLine(keeper: WardrobeKeeper | undefined, slot: SlotInfo): string {
  return `${keeper?.name ?? 'This keeper'} has no ${slot.name.toLowerCase()} to wear these on.`;
}

/** The colours an item shows: its own colour effects, else the part's defaults (in schema order). */
export function swatches(item: WardrobeItem, defaults: Readonly<Record<string, number | string>>): string[] {
  return Object.keys(defaults)
    .map((key) => item.effects[key] ?? defaults[key])
    .filter((value): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value));
}

/** The keepers `from` can give an item to (everyone else). */
export function giveTargets(wardrobe: Wardrobe, from: string): WardrobeKeeper[] {
  return wardrobe.keepers.filter((k) => k.id !== from);
}

/** Who wears it, in words ("Worn by Pup and Trini Boi", or nothing). */
export function wornLine(view: ItemView, keeperName: string): string {
  const names = [...(view.wornHere ? [keeperName] : []), ...view.others];
  if (names.length === 0) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Worn by ${list}`;
}
