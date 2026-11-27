/**
 * The shape kits: wearables drawn from one factory each, whose `style` effect picks the shape (a
 * brimmed hat is a fedora, a wide brim, a straw boater or a sun visor) and whose colours and dials
 * make the item. The official collection (`src-tauri/src/keepers/kit/collection/`) is written as
 * data over these kits, so a new item in an existing kit is one row, never new drawing code.
 *
 * Plain data (no three.js), merged into `PARTS` by `catalog.ts`; the core mirrors every row
 * (`src-tauri/src/keepers/kit/parts.rs`, kept equal by `structure.test.ts`). `style` is a whole
 * number (step 1): each factory documents what each style draws, and clamps an unknown one.
 */
import type { EffectSchema } from './effects.ts';

interface KitRow {
  readonly id: string;
  readonly name: string;
  readonly slot: string;
  readonly species: 'any' | readonly string[];
  readonly description: string;
  readonly effects: EffectSchema;
}

export const KIT_PARTS = [
  {
    id: 'brim-hat',
    name: 'Brimmed Hat',
    slot: 'head',
    species: 'any',
    description: "A hat with a full brim shaped to the head: a fedora, a wide brim, a straw boater or an open sun visor.",
    effects: {
      color: { kind: 'colour', label: 'Crown', default: '#c9a66b' },
      trim: { kind: 'colour', label: 'Band', default: '#151c33' },
      style: { kind: 'number', label: 'Style', min: 0, max: 3, default: 0, step: 1 },
    },
  },
  {
    id: 'soft-hat',
    name: 'Soft Hat',
    slot: 'head',
    species: 'any',
    description: "A soft hat that hugs the head: a pom beanie, an acorn cap, a mortarboard with its tassel, or a tall wrap.",
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#d65a3a' },
      trim: { kind: 'colour', label: 'Accent', default: '#f4eee2' },
      style: { kind: 'number', label: 'Style', min: 0, max: 3, default: 0, step: 1 },
    },
  },
  {
    id: 'head-gear',
    name: 'Head Gear',
    slot: 'head',
    species: 'any',
    description: "Gear on a band over the head: studio headphones, a headlamp that lights the way, or a sprouting antenna.",
    effects: {
      color: { kind: 'colour', label: 'Band', default: '#1e2848' },
      trim: { kind: 'colour', label: 'Accent', default: '#d39744' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.6 },
      style: { kind: 'number', label: 'Style', min: 0, max: 2, default: 0, step: 1 },
    },
  },
  {
    id: 'crown',
    name: 'Crown',
    slot: 'head',
    species: 'any',
    description: "Worn round the brow: a thin gold circlet, a ring of leaves, a tall plumed headpiece or a crown of rays.",
    effects: {
      color: { kind: 'colour', label: 'Metal', default: '#ffcf5a' },
      trim: { kind: 'colour', label: 'Jewel', default: '#e2425f' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.6 },
      style: { kind: 'number', label: 'Style', min: 0, max: 3, default: 0, step: 1 },
    },
  },
  {
    id: 'neckwear',
    name: 'Neckwear',
    slot: 'neck',
    species: 'any',
    description: "Something at the neck: a folded bandana, a narrow tie, or a sheer shawl with tiny sparkles.",
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#c2373a' },
      trim: { kind: 'colour', label: 'Pattern', default: '#f4eee2' },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
      style: { kind: 'number', label: 'Style', min: 0, max: 2, default: 0, step: 1 },
    },
  },
  {
    id: 'top',
    name: 'Top',
    slot: 'torso',
    species: 'any',
    description: "A top cut to the body: a tee, a shirt, a hoodie, a sweater, a blazer, a vest, a waistcoat, sequins, plating, a blouse or a robe.",
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#f4eee2' },
      trim: { kind: 'colour', label: 'Accent', default: '#151c33' },
      glow: { kind: 'number', label: 'Shine', min: 0, max: 2, default: 0.4 },
      style: { kind: 'number', label: 'Style', min: 0, max: 10, default: 0, step: 1 },
    },
  },
  {
    id: 'gown',
    name: 'Gown',
    slot: 'torso',
    species: 'any',
    description: "A floor-length gown with a soft shimmer, from the shoulders past the knees. Takes the legs too.",
    effects: {
      color: { kind: 'colour', label: 'Silk', default: '#7a1f3d' },
      trim: { kind: 'colour', label: 'Trim', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Shimmer', min: 0, max: 2, default: 0.6 },
    },
  },
  {
    id: 'trousers',
    name: 'Trousers',
    slot: 'legs',
    species: 'any',
    description: "Worn on the legs: straight jeans, cuffed chinos, cargo trousers or a wrap skirt tied at the side.",
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#2f4a7a' },
      trim: { kind: 'colour', label: 'Stitching', default: '#d39744' },
      style: { kind: 'number', label: 'Style', min: 0, max: 3, default: 0, step: 1 },
    },
  },
  {
    id: 'bangles',
    name: 'Bangles',
    slot: 'wrist',
    species: ['human'],
    description: "On the wrist: stacked bead bracelets or a jewelled arm band that catches the light.",
    effects: {
      color: { kind: 'colour', label: 'Beads', default: '#e2662c' },
      trim: { kind: 'colour', label: 'Accent', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Sparkle', min: 0, max: 2, default: 0.4 },
      style: { kind: 'number', label: 'Style', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  {
    id: 'tote',
    name: 'Tote',
    slot: 'held',
    species: ['human'],
    description: "Carried in the hand: a woven basket tote with leather handles, or a well-read book.",
    effects: {
      color: { kind: 'colour', label: 'Weave', default: '#c9a66b' },
      trim: { kind: 'colour', label: 'Leather', default: '#7f4a24' },
      style: { kind: 'number', label: 'Style', min: 0, max: 1, default: 0, step: 1 },
    },
  },
  {
    id: 'cape',
    name: 'Cape',
    slot: 'back',
    species: 'any',
    description: "From the shoulders: a long cloak lined with light, huge feathered carnival wings, or wings of light.",
    effects: {
      color: { kind: 'colour', label: 'Outside', default: '#151c33' },
      trim: { kind: 'colour', label: 'Lining', default: '#bfe0ff' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.6 },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
      style: { kind: 'number', label: 'Style', min: 0, max: 2, default: 0, step: 1 },
    },
  },
  {
    id: 'shoes',
    name: 'Shoes',
    slot: 'paws',
    species: 'any',
    description: "On every foot: sneakers, high-tops, boots, oxfords, sandals, heels, soft booties or slipper socks.",
    effects: {
      color: { kind: 'colour', label: 'Upper', default: '#f4eee2' },
      trim: { kind: 'colour', label: 'Sole', default: '#151c33' },
      style: { kind: 'number', label: 'Style', min: 0, max: 7, default: 0, step: 1 },
    },
  },
  {
    id: 'emblem-halo',
    name: 'Emblem Halo',
    slot: 'halo',
    species: 'any',
    description: "Something turning over the head: a ring of satellites, sun-seeking petals, a crescent moon, a compass rose or the halo of ages.",
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.8 },
      speed: { kind: 'number', label: 'Speed', min: 0, max: 4, default: 1 },
      style: { kind: 'number', label: 'Style', min: 0, max: 4, default: 0, step: 1 },
    },
  },
  {
    id: 'platform',
    name: 'Platform',
    slot: 'base',
    species: 'any',
    description: "What the keeper stands on: a hover ring, a cushion, a mossy branch, a stone, lapping waves, a spotlight or a cloud.",
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#6f7686' },
      trim: { kind: 'colour', label: 'Accent', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.6 },
      style: { kind: 'number', label: 'Style', min: 0, max: 6, default: 0, step: 1 },
    },
  },
  {
    id: 'drift-aura',
    name: 'Drift Aura',
    slot: 'aura',
    species: 'any',
    description: "Something drifting in the air round the keeper: golden pollen, a night sky, fireflies or warm lantern light.",
    effects: {
      color: { kind: 'colour', label: 'Colour', default: '#ffcf5a' },
      count: { kind: 'number', label: 'Count', min: 8, max: 120, default: 40, step: 1 },
      speed: { kind: 'number', label: 'Speed', min: 0, max: 4, default: 1 },
      style: { kind: 'number', label: 'Style', min: 0, max: 3, default: 0, step: 1 },
    },
  },
] as const satisfies readonly KitRow[];

/**
 * Parts that take more than their own slot: the gown covers the legs, so no trousers go under it
 * (the core's `parts::COVERS` says the same).
 */
export const COVERS: Readonly<Record<string, readonly string[]>> = { gown: ['legs'] };
