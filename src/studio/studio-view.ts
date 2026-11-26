/**
 * The Studio's pure rules (no React, no core): the level bar, rarity locks, the colour
 * swatches offered for a zone, and the effective habit weights. Tested by `studio-view.test.ts`.
 */
import type { Experience, Rarity, StudioInfo, ZoneLook } from '../kernel/ipc-studio';

/** 0..1: how far the keeper is through its current level. */
export function levelProgress(e: Experience): number {
  const span = e.nextXp - e.levelXp;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (e.xp - e.levelXp) / span));
}

/** The rarity of a wardrobe item: its own (official items), else its part's; common otherwise. */
export function rarityOf(info: StudioInfo, item: { part: string; rarity?: string }): Rarity {
  const id = item.rarity ?? info.partRarity[item.part] ?? 'common';
  return info.rarities.find((r) => r.id === id) ?? info.rarities[0];
}

/** Official items grouped by rarity, rarest last (the Marketplace's order). */
export function byRarity<T extends { rarity?: string }>(info: StudioInfo, items: T[]): { rarity: Rarity; items: T[] }[] {
  return info.rarities.map((rarity) => ({ rarity, items: items.filter((i) => (i.rarity ?? 'common') === rarity.id) })).filter((g) => g.items.length > 0);
}

/** The level an item still needs, or null when this keeper may wear it. */
export function lockedUntil(rarity: Rarity, level: number): number | null {
  return Math.max(1, level) >= rarity.level ? null : rarity.level;
}

/** Colours offered for every zone: the brand, natural coats, and a few bright ones. */
export const SWATCHES = [
  '#151c33', '#d39744', '#f4eee2', '#0b1020', '#e3b06a',
  '#b9773d', '#7f4a24', '#f0e2c8', '#2b2b2b', '#ffffff',
  '#e2425f', '#ff7a1e', '#4fbf7a', '#1fd2d6', '#4a8df0', '#c25cf0',
] as const;

/** A zone's look after a change; an empty look removes the zone (back to the species' colour). */
export function setZone(look: Record<string, ZoneLook>, zone: string, change: ZoneLook | null): Record<string, ZoneLook> {
  const next = { ...look };
  const merged = change ? { ...next[zone], ...change } : {};
  if (!merged.color && !merged.material) delete next[zone];
  else next[zone] = merged;
  return next;
}

/** Default weight for a habit the keeper has not set (napping a little, everything else sometimes). */
export const DEFAULT_HABIT = 1;

export function habitWeight(habits: Record<string, number> | undefined, id: string): number {
  return habits?.[id] ?? DEFAULT_HABIT;
}

/** Words for a weight 0..3. */
export function habitWords(weight: number): string {
  if (weight <= 0) return 'Never';
  if (weight < 1.5) return 'Sometimes';
  if (weight < 2.5) return 'Often';
  return 'All the time';
}

/** What a keeper says when it reaches a new level, naming what opened. */
export function levelUpLine(name: string, level: number, unlocked: { name: string }[]): string {
  const opened = unlocked.map((u) => u.name.charAt(0).toLowerCase() + u.name.slice(1));
  const tail = opened.length === 0 ? '' : opened.length === 1 ? ` I can now wear ${opened[0]}.`.replace('wear a ', 'have a ') : ` New for me: ${opened.slice(0, -1).join(', ')} and ${opened[opened.length - 1]}.`;
  return `${name} reached level ${level}!${tail}`;
}

/** A sample line for testing a voice, in the keeper's own name. */
export function voiceSample(name: string): string {
  return `Hi, I'm ${name}. This is how I'd sound.`;
}

/** The Studio's save line: everything is kept as it is changed, and this says where it stands. */
export function saveWords(dirty: boolean, saving: boolean): string {
  if (saving) return 'Saving…';
  return dirty ? 'Saving in a moment…' : 'Everything is saved';
}
