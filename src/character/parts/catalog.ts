/**
 * The parts catalogue: every wearable the character can put on, as plain data (no three.js),
 * so a kit screen can list them, a pack importer can validate variants against them, and the
 * tests can check them without a GPU.
 *
 * A part fills one SLOT that a species declares (`halo` around the head and upper body,
 * `base` under it, `aura` around the whole body), lists the species it fits (`'any'` or skin
 * ids) and carries an effects schema (`effects.ts`). A variant is a part id plus effect values.
 *
 * Adding a part: one row here, one factory under `parts/<id>/` and one line in
 * `parts/index.ts` (whose table is typed against `PartId`, so a row without a factory fails
 * the typecheck).
 */
import type { WornPart } from '../contract';
import { effectsKey, resolveEffects, type EffectSchema, type EffectValues } from './effects.ts';

/** The slots a species can offer, in drawing order. */
export const SLOT_IDS = ['halo', 'base', 'aura'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export interface PartInfo {
  /** Stable kebab-case id, stored in profiles and packs; never rename a shipped one. */
  readonly id: string;
  readonly name: string;
  readonly slot: SlotId;
  /** `'any'`, or the species (skin ids) it fits. */
  readonly species: 'any' | readonly string[];
  /** One short sentence for a kit screen. */
  readonly description: string;
  readonly effects: EffectSchema;
}

export const PARTS = [
  {
    id: 'memory-halo',
    name: 'Memory Halo',
    slot: 'halo',
    species: 'any',
    description: 'The knowledge graph as an orbit of gold nodes; every memory write sparks into it.',
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#d39744' },
      spinIdle: { kind: 'number', label: 'Idle spin', min: 0, max: 4, default: 1 },
      spinWork: { kind: 'number', label: 'Working spin', min: 0, max: 8, default: 2.4 },
      nodes: { kind: 'number', label: 'Nodes', min: 24, max: 200, default: 84, step: 1 },
    },
  },
  {
    id: 'ark-hull',
    name: 'Ark Hull',
    slot: 'base',
    species: 'any',
    description: 'A polished gold ark crescent rocking over rippling rings of light.',
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#d39744' },
      rock: { kind: 'number', label: 'Rocking', min: 0, max: 3, default: 1 },
    },
  },
  {
    id: 'star-aura',
    name: 'Star Aura',
    slot: 'aura',
    species: 'any',
    description: 'A soft field of gold motes slowly orbiting the body; they quicken with work.',
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#e3b06a' },
      count: { kind: 'number', label: 'Motes', min: 8, max: 120, default: 42, step: 1 },
      speed: { kind: 'number', label: 'Speed', min: 0, max: 4, default: 1 },
    },
  },
] as const satisfies readonly PartInfo[];

export type PartId = (typeof PARTS)[number]['id'];

/** What the character wears when nothing else is chosen: the shipped look. */
export const DEFAULT_WEARABLES: readonly WornPart[] = [{ part: 'memory-halo' }, { part: 'ark-hull' }];

/** The catalogue row for `id`, or undefined for an unknown part. */
export function findPart(id: unknown): PartInfo | undefined {
  return PARTS.find((part) => part.id === id);
}

/** True when `part` may be worn by `species`. */
export function fitsSpecies(part: PartInfo, species: string): boolean {
  return part.species === 'any' || part.species.includes(species);
}

/** One worn part, resolved: its row, clamped effects and a key that changes with either. */
export interface ResolvedWear {
  readonly info: PartInfo;
  readonly id: PartId;
  readonly effects: EffectValues;
  readonly key: string;
}

/**
 * Resolves an untrusted wear list for `species`: unknown parts and parts that do not fit the
 * species are skipped, effects are clamped, and each slot holds at most one part (the first
 * listed wins). Returned in slot order.
 */
export function resolveWearables(worn: unknown, species: string): Partial<Record<SlotId, ResolvedWear>> {
  const out: Partial<Record<SlotId, ResolvedWear>> = {};
  if (!Array.isArray(worn)) return out;
  for (const item of worn) {
    if (item === null || typeof item !== 'object') continue;
    const info = findPart((item as WornPart).part);
    if (!info || !fitsSpecies(info, species) || out[info.slot]) continue;
    const effects = resolveEffects(info.effects, (item as WornPart).effects);
    out[info.slot] = { info, id: info.id as PartId, effects, key: `${info.id}|${effectsKey(effects)}` };
  }
  return out;
}
