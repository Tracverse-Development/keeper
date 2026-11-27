/**
 * The set pieces of 0.16.0: twelve new wearable shapes, two for each keeper's new themed set (the
 * official collection's `hero_sets.rs`), each built for close looks like the Ranger Jacket. Like
 * the hero kits they are their own parts (no `style`): one factory each under `parts/<id>/`, listed
 * in `set-factories.ts`.
 *
 *   Harbour Watch (the dog)      sailor-collar, pea-coat
 *   Clockwork (the owl)          top-hat, gear-loupe
 *   Test Match (the man)         batting-whites, cricket-bat
 *   Sky Pilot (the woman)        flight-cap, flight-goggles
 *   Ark Sentinel (the robot)     sentinel-plate, kite-shield
 *   Good Shepherd (God Keeper)   shepherd-crook, stole
 *
 * Plain data (no three.js), merged into `PARTS` by `catalog.ts` after the shape kits; the core
 * mirrors every row (`src-tauri/src/keepers/kit/parts.rs`, kept equal by `structure.test.ts`).
 * A part names who may wear it like any other; the SET decides who its official items are for.
 */
import type { EffectSchema } from './effects.ts';

interface SetPartRow {
  readonly id: string;
  readonly name: string;
  readonly slot: string;
  readonly species: 'any' | readonly string[];
  readonly description: string;
  readonly effects: EffectSchema;
}

export const SET_PARTS = [
  {
    id: 'sailor-collar',
    name: 'Sailor Collar',
    slot: 'neck',
    species: 'any',
    description: 'A square sailor collar over the shoulders, striped at the edge, with a knotted neckerchief at the V.',
    effects: {
      color: { kind: 'colour', label: 'Collar', default: '#151c33' },
      trim: { kind: 'colour', label: 'Stripes', default: '#f4eee2' },
      knot: { kind: 'colour', label: 'Neckerchief', default: '#d39744' },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'pea-coat',
    name: 'Pea Coat',
    slot: 'torso',
    species: 'any',
    description: 'A double-breasted wool pea coat: broad lapels, two rows of anchor buttons, slant pockets and a half-belt.',
    effects: {
      color: { kind: 'colour', label: 'Wool', default: '#151c33' },
      trim: { kind: 'colour', label: 'Buttons', default: '#d39744' },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'top-hat',
    name: 'Top Hat',
    slot: 'head',
    species: 'any',
    description: 'A tall silk top hat with a buckled band and a cluster of brass gears that turn while it works.',
    effects: {
      color: { kind: 'colour', label: 'Silk', default: '#151c33' },
      trim: { kind: 'colour', label: 'Band', default: '#7a1f3d' },
      metal: { kind: 'colour', label: 'Brass', default: '#d39744' },
    },
  },
  {
    id: 'gear-loupe',
    name: 'Gear Loupe',
    slot: 'face',
    species: 'any',
    description: "A clockmaker's loupe: a stepped brass eyepiece on a headband, a second lens flipped up, gears at the hinge.",
    effects: {
      color: { kind: 'colour', label: 'Brass', default: '#d39744' },
      lens: { kind: 'colour', label: 'Lens', default: '#bfe6ff' },
      shine: { kind: 'number', label: 'Shine', min: 0, max: 1, default: 0.7 },
    },
  },
  {
    id: 'batting-whites',
    name: 'Batting Whites',
    slot: 'legs',
    species: ['human'],
    description: 'Cricket whites with ribbed leg guards strapped over both shins, knee rolls and buckles.',
    effects: {
      color: { kind: 'colour', label: 'Whites', default: '#f4eee2' },
      trim: { kind: 'colour', label: 'Straps', default: '#151c33' },
      pad: { kind: 'colour', label: 'Guards', default: '#fbf8f2' },
    },
  },
  {
    id: 'cricket-bat',
    name: 'Cricket Bat',
    slot: 'held',
    species: ['human'],
    description: "A willow cricket bat in the hand: a ridged blade, a grain you can see, a wrapped grip and a maker's badge.",
    effects: {
      color: { kind: 'colour', label: 'Willow', default: '#e8cf9a' },
      trim: { kind: 'colour', label: 'Grip', default: '#151c33' },
    },
  },
  {
    id: 'flight-cap',
    name: 'Flight Cap',
    slot: 'head',
    species: 'any',
    description: "An aviator's leather helmet: stitched panels, a fleece edge round the face, ear flaps and chin straps.",
    effects: {
      color: { kind: 'colour', label: 'Leather', default: '#7f4a24' },
      trim: { kind: 'colour', label: 'Fleece', default: '#f4eee2' },
      wear: { kind: 'number', label: 'Wear', min: 0, max: 1, default: 0.5 },
    },
  },
  {
    id: 'flight-goggles',
    name: 'Flight Goggles',
    slot: 'face',
    species: 'any',
    description: 'Brass-rimmed flying goggles over the eyes: padded cups, tinted glass and a strap round the head.',
    effects: {
      color: { kind: 'colour', label: 'Brass', default: '#d39744' },
      trim: { kind: 'colour', label: 'Strap', default: '#5a3a1a' },
      lens: { kind: 'colour', label: 'Glass', default: '#8fd0e8' },
      shine: { kind: 'number', label: 'Shine', min: 0, max: 1, default: 0.7 },
    },
  },
  {
    id: 'sentinel-plate',
    name: 'Sentinel Plate',
    slot: 'torso',
    species: 'any',
    description: 'Enamelled armour: a ridged breastplate with a glowing ark crest, a gorget, layered pauldrons and lames.',
    effects: {
      color: { kind: 'colour', label: 'Enamel', default: '#1e2848' },
      trim: { kind: 'colour', label: 'Gilt', default: '#d39744' },
      light: { kind: 'colour', label: 'Crest light', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'kite-shield',
    name: 'Kite Shield',
    slot: 'back',
    species: 'any',
    description: 'A curved kite shield slung on the back: gilt rim, studs, the ark and its waves in light, two straps.',
    effects: {
      color: { kind: 'colour', label: 'Field', default: '#151c33' },
      trim: { kind: 'colour', label: 'Rim', default: '#d39744' },
      light: { kind: 'colour', label: 'Emblem light', default: '#ffcf5a' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 1 },
    },
  },
  {
    id: 'shepherd-crook',
    name: "Shepherd's Crook",
    slot: 'held',
    species: ['human'],
    description: "A tall shepherd's staff of olive wood: a curled crook, leather and gold bindings, a soft light in the curl.",
    effects: {
      color: { kind: 'colour', label: 'Wood', default: '#8a6a48' },
      trim: { kind: 'colour', label: 'Bindings', default: '#d39744' },
      glow: { kind: 'number', label: 'Glow', min: 0, max: 2, default: 0.8 },
    },
  },
  {
    id: 'stole',
    name: 'Stole',
    slot: 'neck',
    species: ['divine'],
    description: 'A long embroidered stole round the neck, its ends hanging down the front, gold borders and a fringe.',
    effects: {
      color: { kind: 'colour', label: 'Cloth', default: '#f4eee2' },
      trim: { kind: 'colour', label: 'Embroidery', default: '#d39744' },
      sway: { kind: 'number', label: 'Sway', min: 0, max: 2, default: 1 },
    },
  },
] as const satisfies readonly SetPartRow[];
