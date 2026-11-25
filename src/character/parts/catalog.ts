/**
 * The parts catalogue: every wearable the character can put on, as plain data (no three.js),
 * so a kit screen can list them, a pack importer can validate variants against them, and the
 * tests can check them without a GPU.
 *
 * Pattern: Registry. A part fills one SLOT a species declares (`slots.ts`: floating `halo`,
 * `base`, `aura`; worn on the body `head`, `neck`, `torso`, `back`), lists the species it fits
 * (`'any'` or skin ids) and carries an effects schema (`effects.ts`). A variant is a part id
 * plus effect values. Worn parts fit themselves to the body's published shape (`fit.ts`), so
 * `'any'` really means any species that offers the slot.
 *
 * Adding a part: one row here, one factory under `parts/<id>/` and one line in
 * `parts/index.ts` (whose table is typed against `PartId`, so a row without a factory fails
 * the typecheck).
 */
import type { WornPart } from '../contract';
import { effectsKey, resolveEffects, type EffectSchema, type EffectValues } from './effects.ts';
import type { SlotId } from './slots.ts';

export { SLOT_IDS, SLOTS, isWornSlot, type SlotId, type SlotKind } from './slots.ts';

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
  {
    id: 'ark-jacket',
    name: 'Ark Jacket',
    slot: 'torso',
    species: 'any',
    description: 'A soft open jacket cut to the body, gold-piped, with cuffs wherever there are arms.',
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#f4eee2' },
      trim: { kind: 'colour', label: 'Trim', default: '#d39744' },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'knit-scarf',
    name: 'Knit Scarf',
    slot: 'neck',
    species: 'any',
    description: 'A striped knit scarf wrapped round the neck, its two ends swinging.',
    effects: {
      color: { kind: 'colour', label: 'Wool', default: '#d39744' },
      stripe: { kind: 'colour', label: 'Stripes', default: '#151c33' },
      sway: { kind: 'number', label: 'Swing', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'crew-cap',
    name: 'Crew Cap',
    slot: 'head',
    species: 'any',
    description: 'A six-panel cap shaped to the head, with a gold brim and button.',
    effects: {
      color: { kind: 'colour', label: 'Crown', default: '#151c33' },
      trim: { kind: 'colour', label: 'Brim', default: '#d39744' },
    },
  },
  {
    id: 'trail-pack',
    name: 'Trail Pack',
    slot: 'back',
    species: 'any',
    description: 'A rounded backpack on two belts, with a pocket and a gold zip.',
    effects: {
      color: { kind: 'colour', label: 'Canvas', default: '#1e2848' },
      trim: { kind: 'colour', label: 'Trim', default: '#d39744' },
      sway: { kind: 'number', label: 'Bounce', min: 0, max: 2, default: 1 },
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
