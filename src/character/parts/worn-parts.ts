/**
 * The factories of the parts worn ON the body (head, neck, torso, back, paws), kept apart from the
 * floating ones so the wearables-fit test can build every one of them, for every species, in
 * plain Node (no GPU): these files import with explicit `.ts` paths for that reason.
 *
 * Pattern: Registry. `parts/index.ts` merges this table into the full factory table, which is
 * typed against `PartId`, so a catalogue row without a factory fails the typecheck.
 */
import { createCrewCap } from './cap/cap.ts';
import { createKnitScarf } from './scarf/scarf.ts';
import { createArkJacket } from './jacket/jacket.ts';
import { createTrailPack } from './backpack/backpack.ts';
import { createDogCollar } from './dog-collar/dog-collar.ts';
import { createPawNails } from './paw-nails/paw-nails.ts';
import type { PartFactory } from './part';

export const WORN_FACTORIES = {
  'ark-jacket': createArkJacket,
  'knit-scarf': createKnitScarf,
  'crew-cap': createCrewCap,
  'trail-pack': createTrailPack,
  'paw-nails': createPawNails,
  'dog-collar': createDogCollar,
} as const satisfies Readonly<Record<string, PartFactory>>;
