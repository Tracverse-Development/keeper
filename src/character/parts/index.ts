/**
 * The parts registry: the catalogue (`PARTS`, pure data) plus the factory for each id.
 *
 * The factory table is a `Record<PartId, ...>`: the typecheck fails if a catalogue row has
 * no factory, or a factory has no row. Worn parts come from `worn-parts.ts`.
 */
import type { PartId } from './catalog';
import { createArkHull } from './ark-hull/ark-hull';
import type { EffectValues } from './effects';
import type { PartFit } from './fit';
import { createMemoryHalo } from './memory-halo/memory-halo';
import type { PartFactory, PartInstance } from './part';
import { createStarAura } from './star-aura/star-aura';
import { WORN_FACTORIES } from './worn-parts';

export { DEFAULT_WEARABLES, PARTS, SLOT_IDS, isWornSlot, resolveWearables, type PartId, type PartInfo, type ResolvedWear, type SlotId } from './catalog';
export type { EffectSchema, EffectSpec, EffectValues } from './effects';
export type { BodyShape, PartFit } from './fit';
export type { PartFrame, PartInstance, SparkTarget } from './part';

const FACTORIES: Readonly<Record<PartId, PartFactory>> = {
  'memory-halo': (effects) => createMemoryHalo(effects),
  'ark-hull': (effects) => createArkHull(effects),
  'star-aura': (effects) => createStarAura(effects),
  ...WORN_FACTORIES,
};

/** Builds the part `id` with already resolved effects, fitted to `fit` (worn parts read its shape). */
export function createPart(id: PartId, effects: EffectValues, fit: PartFit): PartInstance {
  return FACTORIES[id](effects, fit);
}
