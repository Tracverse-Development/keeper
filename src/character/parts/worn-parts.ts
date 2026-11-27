/**
 * The factories of the parts worn ON the body (head, face, neck, torso, legs, back, feet, wrist, held), kept apart from the
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
import { createSpectacles } from './spectacles/spectacles.ts';
import { createWelderVisor } from './welder-visor/welder-visor.ts';
import { createTrailWatch } from './trail-watch/trail-watch.ts';
import { createStarLantern } from './star-lantern/star-lantern.ts';
import { createBrimHat } from './brim-hat/brim-hat.ts';
import { createSoftHat } from './soft-hat/soft-hat.ts';
import { createHeadGear } from './head-gear/head-gear.ts';
import { createCrown } from './crown/crown.ts';
import { createNeckwear } from './neckwear/neckwear.ts';
import { createTop } from './top/top.ts';
import { createGown } from './gown/gown.ts';
import { createTrousers } from './trousers/trousers.ts';
import { createBangles } from './bangles/bangles.ts';
import { createTote } from './tote/tote.ts';
import { createCape } from './cape/cape.ts';
import { createShoes } from './shoes/shoes.ts';
import { createRangerJacket } from './ranger-jacket/ranger-jacket.ts';
import { createCordNecklace } from './cord-necklace/cord-necklace.ts';
import type { PartFactory } from './part';

export const WORN_FACTORIES = {
  'ark-jacket': createArkJacket,
  'knit-scarf': createKnitScarf,
  'crew-cap': createCrewCap,
  'trail-pack': createTrailPack,
  'paw-nails': createPawNails,
  'dog-collar': createDogCollar,
  'round-spectacles': createSpectacles,
  'welder-visor': createWelderVisor,
  'trail-watch': createTrailWatch,
  'star-lantern': createStarLantern,
  'brim-hat': createBrimHat,
  'soft-hat': createSoftHat,
  'head-gear': createHeadGear,
  'crown': createCrown,
  'neckwear': createNeckwear,
  'top': createTop,
  'gown': createGown,
  'trousers': createTrousers,
  'bangles': createBangles,
  'tote': createTote,
  'cape': createCape,
  'shoes': createShoes,
  'ranger-jacket': createRangerJacket,
  'cord-necklace': createCordNecklace,
} as const satisfies Readonly<Record<string, PartFactory>>;
