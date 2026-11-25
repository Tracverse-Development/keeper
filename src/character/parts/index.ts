/**
 * The parts registry: the catalogue (`PARTS`, pure data) plus the factory for each id.
 *
 * The factory table is a `Record<PartId, ...>`: the typecheck fails if a catalogue row has
 * no factory, or a factory has no row.
 */
import type { PartId } from './catalog';
import { createArkHull } from './ark-hull/ark-hull';
import type { EffectValues } from './effects';
import { createMemoryHalo } from './memory-halo/memory-halo';
import type { PartFactory, PartInstance } from './part';
import { createStarAura } from './star-aura/star-aura';

export { DEFAULT_WEARABLES, PARTS, SLOT_IDS, resolveWearables, type PartId, type PartInfo, type ResolvedWear, type SlotId } from './catalog';
export type { EffectSchema, EffectSpec, EffectValues } from './effects';
export type { PartFrame, PartInstance, SparkTarget } from './part';

const FACTORIES: Readonly<Record<PartId, PartFactory>> = {
  'memory-halo': createMemoryHalo,
  'ark-hull': createArkHull,
  'star-aura': createStarAura,
};

/** Builds the part `id` with already resolved effects. */
export function createPart(id: PartId, effects: EffectValues): PartInstance {
  return FACTORIES[id](effects);
}
