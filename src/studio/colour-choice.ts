/**
 * Colour choices in the Studio (pure; tested by `colour-choice.test.ts`): the swatches an item
 * offers (its own colours first, then its palette from the core, `kit/colours.rs`), the colour a
 * keeper wears it in, the colour to show for it now, and the arrow-key moves across a swatch row.
 * The core decides what is allowed; the window only offers what the core sent.
 */
import type { WardrobeItem, WornPart } from '../kernel/ipc';

/** One swatch in a row: `id` '' is the item's own colours. `fill` and `edge` paint the dot. */
export interface Swatch {
  id: string;
  name: string;
  fill: string;
  edge: string | null;
}

const OWN_NAME = 'Its own colours';

function hex(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}

/** The second colour of a set of effect values (trim, stripe or tag), as the core applies it. */
function second(effects: Record<string, number | string>): string | null {
  return hex(effects.trim) ?? hex(effects.stripe) ?? hex(effects.tag);
}

/** The swatch row of `item`: its own colours, then each colour of its palette. Empty when it has no palette. */
export function swatchesOf(item: Pick<WardrobeItem, 'effects' | 'colours'>): Swatch[] {
  const palette = item.colours ?? [];
  if (!palette.length) return [];
  const own: Swatch = { id: '', name: OWN_NAME, fill: hex(item.effects.color) ?? '#d39744', edge: second(item.effects) };
  return [own, ...palette.map((c) => ({ id: c.id, name: c.name, fill: hex(c.effects.color) ?? own.fill, edge: second(c.effects) }))];
}

/** The colour keeper's `wearables` wear item `itemId` in ('' = its own colours, or not worn). */
export function wornColour(wearables: readonly WornPart[], itemId: string): string {
  return wearables.find((w) => w.item === itemId)?.colour ?? '';
}

/**
 * The colour to show for `item`: the one just picked in this Studio visit, else the one the keeper
 * wears it in; a colour its palette no longer has is its own colours.
 */
export function shownColour(item: Pick<WardrobeItem, 'id' | 'colours'>, picked: Readonly<Record<string, string>>, wearables: readonly WornPart[]): string {
  const id = picked[item.id] ?? wornColour(wearables, item.id);
  return item.colours?.some((c) => c.id === id) ? id : '';
}

/** The item's effect values in colour `colour` (unknown or '': as designed). */
export function effectsIn(item: Pick<WardrobeItem, 'effects' | 'colours'>, colour: string): Record<string, number | string> {
  const choice = colour ? item.colours?.find((c) => c.id === colour) : undefined;
  return choice ? { ...item.effects, ...choice.effects } : item.effects;
}

/** Where focus goes in a row of `count` swatches from `index` for key `key` (null: not a move key). */
export function swatchMove(index: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
