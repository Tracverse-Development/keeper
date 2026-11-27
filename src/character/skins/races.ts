/**
 * Races: the families species belong to (human, robot, animal, divine), as plain data. An item
 * names who may wear it by species or by race (`parts/catalog.ts` `fitsSpecies`), so a piece "for
 * humans" fits the man and the woman and never the robot, the dog or the owl. The divine race (the
 * God Keeper) wears everything from every race, each piece drawn in its own divine finish
 * (`parts/divine-finish.ts`). Mirrors the core (`src-tauri/src/keepers/kit/species.rs` `RACES` and
 * each species' `race`; `structure.test.ts` keeps them equal).
 *
 * Pure (no three.js): the species-to-race table lives here, not in the skin catalogue, so the parts
 * catalogue can read it without importing any body.
 */

export const RACES = [
  { id: 'human', name: 'Human' },
  { id: 'robot', name: 'Robot' },
  { id: 'animal', name: 'Animal' },
  { id: 'divine', name: 'Divine' },
] as const;

export type RaceId = (typeof RACES)[number]['id'];

/** The race that may wear anything from any race. */
export const WEARS_EVERYTHING: RaceId = 'divine';

/** Each species' race (skin ids, `skins/catalog.ts`). */
export const SPECIES_RACE: Readonly<Record<string, RaceId>> = {
  robot: 'robot',
  puppy: 'animal',
  man: 'human',
  woman: 'human',
  owl: 'animal',
  god: 'divine',
};

/** The race of `species` ('' for an unknown species, which no race-only item fits). */
export function raceOf(species: string): RaceId | '' {
  return SPECIES_RACE[species] ?? '';
}
