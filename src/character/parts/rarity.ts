/**
 * Rarity tiers as the character draws them: how grand a worn item's effect is, from common to
 * mythical, in that order (`rarity-flourish.ts` builds the effect). Mirrors the core's
 * `src-tauri/src/keepers/kit/rarity.rs` ids and colours (`structure.test.ts` keeps them equal).
 *
 *   common     the item as it is
 *   uncommon   a soft shimmer of its tier colour and a few twinkles
 *   rare       a breathing glow, more twinkles and one thin halo ring
 *   legendary  a brighter glow, two crossed halo rings, turning rays and orbiting motes
 *   mythical   colour-shifting light, three rings, a rising vortex of particles and bursts
 *
 * Pure (no three.js): tested by `rarity.test.ts`.
 */

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#9aa3b5' },
  { id: 'uncommon', name: 'Uncommon', color: '#4fbf7a' },
  { id: 'rare', name: 'Rare', color: '#4a8df0' },
  { id: 'legendary', name: 'Legendary', color: '#e3b06a' },
  { id: 'mythical', name: 'Mythical', color: '#c25cf0' },
] as const;

export type RarityId = (typeof RARITIES)[number]['id'];

/** A known rarity id unchanged; anything else (missing, misspelt, from a pack) is common. */
export function resolveRarity(value: unknown): RarityId {
  return RARITIES.some((r) => r.id === value) ? (value as RarityId) : 'common';
}

/** The tier's place: common 0 .. mythical 4. */
export function tierOf(rarity: RarityId): number {
  return RARITIES.findIndex((r) => r.id === rarity);
}

/** What one tier's effect is made of: every number grows (or stays) from tier to tier. */
export interface FlourishSpec {
  /** Peak extra light on the item's own surfaces, in its tier colour (0 = none). */
  readonly glow: number;
  /** Twinkling sparkles round the item. */
  readonly sparkles: number;
  /** Halo rings orbiting the item. */
  readonly rings: number;
  /** Light rays turning behind the item. */
  readonly rays: number;
  /** Motes orbiting and rising through the item. */
  readonly motes: number;
  /** The tier colour drifts through the spectrum (mythical). */
  readonly shift: boolean;
  /** Seconds between bursts of sparks (0 = never). */
  readonly burstEvery: number;
  /** A soft flare of light at the item's heart, as a multiple of its size (0 = none). */
  readonly flare: number;
  /** A small light the item casts on the body round it, in its tier colour (0 = none). */
  readonly light: number;
  /** How far the motes reach out and up, as a multiple of the item's size. */
  readonly reach: number;
}

export const FLOURISH: Readonly<Record<RarityId, FlourishSpec>> = {
  common: { glow: 0, sparkles: 0, rings: 0, rays: 0, motes: 0, shift: false, burstEvery: 0, flare: 0, light: 0, reach: 1 },
  uncommon: { glow: 0.14, sparkles: 8, rings: 0, rays: 0, motes: 0, shift: false, burstEvery: 0, flare: 0, light: 0, reach: 1 },
  rare: { glow: 0.24, sparkles: 12, rings: 1, rays: 0, motes: 10, shift: false, burstEvery: 0, flare: 1.4, light: 0, reach: 1.1 },
  legendary: { glow: 0.34, sparkles: 20, rings: 2, rays: 6, motes: 26, shift: false, burstEvery: 0, flare: 2.2, light: 0.5, reach: 1.5 },
  mythical: { glow: 0.44, sparkles: 28, rings: 3, rays: 8, motes: 64, shift: true, burstEvery: 2.6, flare: 3, light: 0.9, reach: 2.1 },
};
