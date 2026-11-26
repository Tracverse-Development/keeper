/**
 * The moment effects: parts for the `effect` slots (`slots.ts`), which draw nothing on the body.
 * The part worn in `thinking` decides how the keeper looks while it thinks, the part worn in
 * `celebrate` how a celebration bursts (`effects/moments.ts` holds what each one draws). None
 * worn = the classic look (`think-classic`, `cheer-confetti`): exactly what shipped before.
 *
 * Plain data (no three.js), merged into `PARTS` by `catalog.ts`; the core mirrors every row
 * (`src-tauri/src/keepers/kit/parts.rs`, `structure.test.ts`) and gives each one its rarity
 * (`rarity.rs`: classic common, pulse uncommon, orbit rare, nebula legendary, vortex mythical;
 * confetti common, fireworks rare, starburst mythical).
 */
import type { EffectSchema } from './effects.ts';

/** Every moment effect has a colour and an intensity (0.25 calm .. 2 twice the show). */
function moment(colour: string): EffectSchema {
  return {
    color: { kind: 'colour', label: 'Colour', default: colour },
    intensity: { kind: 'number', label: 'Intensity', min: 0.25, max: 2, default: 1 },
  };
}

/** The colour the shipped thinking look draws in (the cyan data motes) and the confetti gold. */
export const THINK_COLOUR = '#1fd2d6';
export const CHEER_COLOUR = '#d39744';

export const MOMENT_PARTS = [
  { id: 'think-classic', name: 'Classic Thinking', slot: 'thinking', species: 'any', description: 'The calm thinking look: data motes drift up while it works things out.', effects: moment(THINK_COLOUR) },
  { id: 'think-pulse', name: 'Pulse', slot: 'thinking', species: 'any', description: 'Rings of light pulse out from the head with every beat of thought.', effects: moment(THINK_COLOUR) },
  { id: 'think-orbit', name: 'Orbit', slot: 'thinking', species: 'any', description: 'Bright orbs circle the head on tilted orbits while it thinks.', effects: moment('#4a8df0') },
  { id: 'think-nebula', name: 'Nebula', slot: 'thinking', species: 'any', description: 'A swirling cloud of coloured stardust gathers round the head.', effects: moment('#e3b06a') },
  { id: 'think-vortex', name: 'Vortex', slot: 'thinking', species: 'any', description: 'Thinking at full drama inside a spiralling vortex of light pouring into the head.', effects: moment('#c25cf0') },
  { id: 'cheer-confetti', name: 'Confetti', slot: 'celebrate', species: 'any', description: 'A shower of tumbling paper when it celebrates.', effects: moment(CHEER_COLOUR) },
  { id: 'cheer-fireworks', name: 'Fireworks', slot: 'celebrate', species: 'any', description: 'Three shells of sparks burst above the head when it celebrates.', effects: moment('#f0c98a') },
  { id: 'cheer-starburst', name: 'Starburst', slot: 'celebrate', species: 'any', description: 'A blinding star flares and throws rays, sparks and confetti all round.', effects: moment('#c25cf0') },
] as const;

export type MomentPartId = (typeof MOMENT_PARTS)[number]['id'];
