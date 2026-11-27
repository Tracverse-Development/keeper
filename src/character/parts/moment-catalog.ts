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
  { id: 'think-comet', name: 'Comet', slot: 'thinking', species: 'any', description: 'A comet loops the head on a long glowing tail while it thinks.', effects: moment('#bfe0ff') },
  { id: 'think-beacon', name: 'Beacon', slot: 'thinking', species: 'any', description: 'A rescue beacon turns above the head, sweeping its light round while it thinks.', effects: moment('#ff7a3a') },
  { id: 'think-dream', name: 'Dream', slot: 'thinking', species: 'any', description: 'Sleepy letters and stars drift up while it thinks, dreamy and slow.', effects: moment('#bfa8ff') },
  { id: 'think-wave', name: 'Waveform', slot: 'thinking', species: 'any', description: 'A ring of sound bars pulses round the head like a song in the mix.', effects: moment('#5cc887') },
  { id: 'think-compass', name: 'Compass', slot: 'thinking', species: 'any', description: 'A compass rose turns over the head, its needle swinging and settling.', effects: moment('#e3b06a') },
  { id: 'think-pages', name: 'Page Flutter', slot: 'thinking', species: 'any', description: 'Pages flutter round the head like a book being read at speed.', effects: moment('#f4eee2') },
  { id: 'cheer-sparks', name: 'Spark Shower', slot: 'celebrate', species: 'any', description: 'A shower of hot welding sparks bursts up and rains down.', effects: moment('#ffb347') },
  { id: 'cheer-petals', name: 'Petal Fall', slot: 'celebrate', species: 'any', description: 'Petals burst out and drift down in a slow spiral.', effects: moment('#e2425f') },
  { id: 'cheer-balls', name: 'Ball Burst', slot: 'celebrate', species: 'any', description: 'Bouncy balls burst out every way and tumble down.', effects: moment('#d8f04a') },
  { id: 'cheer-ripple', name: 'Ripple', slot: 'celebrate', species: 'any', description: 'Rings of light ripple out like notes from a steelpan.', effects: moment('#4fd6d6') },
  { id: 'cheer-rainbow', name: 'Rainbow', slot: 'celebrate', species: 'any', description: 'A rainbow arcs over the keeper, with sparkles at both ends.', effects: moment('#ffffff') },
  { id: 'cheer-shooting-star', name: 'Shooting Star', slot: 'celebrate', species: 'any', description: 'A shooting star streaks across and bursts into sparks.', effects: moment('#ffe9a8') },
] as const;

export type MomentPartId = (typeof MOMENT_PARTS)[number]['id'];
