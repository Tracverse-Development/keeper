/**
 * Outfit rules for the window (pure; tested): which parts and variants can go in a slot on a body,
 * and the outfit after putting one on (one part per slot).
 */
import type { KitCatalog, WornPart } from '../kernel/ipc';

export interface OutfitChoice {
  key: string;
  name: string;
  worn: WornPart;
}

function fits(kit: KitCatalog, partId: string, species: string, slot: string): boolean {
  const p = kit.parts.find((x) => x.id === partId);
  return Boolean(p && p.slot === slot && (p.species.length === 0 || p.species.includes(species)));
}

export function outfitChoices(kit: KitCatalog, species: string, slot: string): OutfitChoice[] {
  const parts = kit.parts.filter((p) => fits(kit, p.id, species, slot)).map((p) => ({ key: `part:${p.id}`, name: p.name, worn: { part: p.id } }));
  const variants = kit.variants.filter((v) => fits(kit, v.part, species, slot)).map((v) => ({ key: `variant:${v.id}`, name: v.name, worn: { part: v.part, effects: v.effects } }));
  return [...parts, ...variants];
}

/** The outfit with `slot` now holding `worn` (or emptied when null). */
export function wear(outfit: WornPart[], kit: KitCatalog, slot: string, worn: WornPart | null): WornPart[] {
  const others = outfit.filter((w) => kit.parts.find((p) => p.id === w.part)?.slot !== slot);
  return worn ? [...others, worn] : others;
}
