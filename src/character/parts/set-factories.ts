/**
 * The factories of the 0.16.0 set pieces (`set-parts.ts`), merged into `worn-parts.ts`'s table so
 * the wearables-fit test builds every one of them for every body that offers its slot. These files
 * import with explicit `.ts` paths so that test runs in plain Node (no GPU).
 *
 * Pattern: Registry (the same table shape as `WORN_FACTORIES`).
 */
import { createBattingWhites } from './batting-whites/batting-whites.ts';
import { createCricketBat } from './cricket-bat/cricket-bat.ts';
import { createFlightCap } from './flight-cap/flight-cap.ts';
import { createFlightGoggles } from './flight-goggles/flight-goggles.ts';
import { createGearLoupe } from './gear-loupe/gear-loupe.ts';
import { createKiteShield } from './kite-shield/kite-shield.ts';
import { createPeaCoat } from './pea-coat/pea-coat.ts';
import { createSailorCollar } from './sailor-collar/sailor-collar.ts';
import { createSentinelPlate } from './sentinel-plate/sentinel-plate.ts';
import { createShepherdCrook } from './shepherd-crook/shepherd-crook.ts';
import { createStole } from './stole/stole.ts';
import { createTopHat } from './top-hat/top-hat.ts';
import type { PartFactory } from './part';

export const SET_FACTORIES = {
  'sailor-collar': createSailorCollar,
  'pea-coat': createPeaCoat,
  'top-hat': createTopHat,
  'gear-loupe': createGearLoupe,
  'batting-whites': createBattingWhites,
  'cricket-bat': createCricketBat,
  'flight-cap': createFlightCap,
  'flight-goggles': createFlightGoggles,
  'sentinel-plate': createSentinelPlate,
  'kite-shield': createKiteShield,
  'shepherd-crook': createShepherdCrook,
  stole: createStole,
} as const satisfies Readonly<Record<string, PartFactory>>;
