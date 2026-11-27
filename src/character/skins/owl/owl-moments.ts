/**
 * The owl's item moments (`item-moments.ts`): what it does now and then with what it wears.
 *   adjust-spectacles  a wing tip lifts to the face and nudges the spectacles (or monocle); a slow blink
 *   settle-cloak       a shrug of both wings that settles a cloak or wings on its back
 *   tassel-tilt        a long, curious head tilt that swings a mortarboard tassel or a hat
 *   preen-neck         it dips its head to preen the scarf or collar at its neck
 *   check-pack         a look back over its shoulder at the pack or satchel it carries
 * Posed by `owl-skin.ts`. Plain data.
 */
import type { ItemMoment } from '../../item-moments.ts';

export const OWL_MOMENTS: readonly ItemMoment[] = [
  { id: 'adjust-spectacles', parts: ['round-spectacles'], weight: 3, duration: 2.6, cooldown: 40 },
  { id: 'settle-cloak', parts: ['cape'], weight: 2, duration: 2.2, cooldown: 45 },
  { id: 'tassel-tilt', parts: ['soft-hat', 'brim-hat', 'crew-cap', 'crown', 'head-gear'], weight: 2, duration: 3, cooldown: 50 },
  { id: 'preen-neck', parts: ['knit-scarf', 'neckwear', 'dog-collar', 'cord-necklace'], weight: 2, duration: 2.4, cooldown: 50 },
  { id: 'check-pack', parts: ['trail-pack'], weight: 1, duration: 2.4, cooldown: 60 },
];
