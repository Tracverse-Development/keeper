/**
 * The dog's item moments (`item-moments.ts`): what it does now and then with what it wears.
 *   shake-hat      a quick head shake that flaps the ears under a hat, cap, crown or headphones
 *   sniff-brooch   it dips its nose to sniff the brooch or tag at its neck (sniffing nose)
 *   proud-wag      chin up and a happy, harder wag, showing off a bandana or scarf
 *   look-booties   a look down at its feet in booties, one paw lifted to check
 *   shake-coat     a wriggle that settles a jacket or coat on its shoulders
 * `momentDials` is the pose each adds; `puppy-skin.ts` applies it. Also here: which coat zones wear
 * fur by default (`hasFur`). Pure (tested by `puppy-moments.test.ts`).
 */
import type { ActiveMoment, ItemMoment } from '../../item-moments.ts';

export const PUPPY_MOMENTS: readonly ItemMoment[] = [
  { id: 'shake-hat', parts: ['brim-hat', 'soft-hat', 'crew-cap', 'crown', 'head-gear'], weight: 2, duration: 1.4, cooldown: 40 },
  { id: 'sniff-brooch', parts: ['cord-necklace', 'dog-collar'], weight: 2, duration: 2.4, cooldown: 45 },
  { id: 'proud-wag', parts: ['neckwear', 'knit-scarf'], weight: 2, duration: 2.6, cooldown: 40 },
  { id: 'look-booties', parts: ['shoes', 'paw-nails'], weight: 2, duration: 2.8, cooldown: 50 },
  { id: 'shake-coat', parts: ['ranger-jacket', 'ark-jacket', 'top', 'gown'], weight: 1, duration: 1.6, cooldown: 55 },
];

/** Coat zones grow fur unless the look picks another material for them (the eyes never do). */
const FURRED_BY_DEFAULT: ReadonlySet<string> = new Set(['head', 'ears', 'muzzle', 'body', 'legs', 'paws', 'tail']);

/** True when zone `zone` wears fur: painted `fur`, or a coat zone left to its own material. */
export function hasFur(zone: string, material: string | undefined): boolean {
  return material === 'fur' || (material === undefined && FURRED_BY_DEFAULT.has(zone));
}

/** What an item moment adds this frame (all 0 when none plays). */
interface MomentDials {
  headPitch: number;
  headYaw: number;
  headRoll: number;
  bodyRoll: number;
  earPerk: number;
  earFlap: number;
  sniff: number;
  tailSpeed: number;
  tailWag: number;
  pawLift: number;
}

/** The pose each of the dog's item moments adds, scaled by its envelope (0 at both ends). */
export function momentDials(m: ActiveMoment | null): MomentDials {
  const out: MomentDials = { headPitch: 0, headYaw: 0, headRoll: 0, bodyRoll: 0, earPerk: 0, earFlap: 0, sniff: 0, tailSpeed: 0, tailWag: 0, pawLift: 0 };
  if (!m) return out;
  const k = m.envelope;
  switch (m.id) {
    case 'shake-hat': // a quick shake that flaps the ears under the hat
      out.headRoll = 0.22 * Math.sin(m.elapsed * 24) * k;
      out.earFlap = 0.6 * Math.abs(Math.sin(m.elapsed * 24)) * k;
      break;
    case 'sniff-brooch': // nose down to the brooch, sniffing
      out.headPitch = 0.78 * k;
      out.headYaw = 0.12 * k;
      out.earPerk = 0.25 * k;
      out.sniff = Math.max(0, Math.sin(m.elapsed * 9)) * k;
      break;
    case 'proud-wag': // chin up, ears up, a harder wag
      out.headPitch = -0.16 * k;
      out.earPerk = 0.5 * k;
      out.tailSpeed = 3 * k;
      out.tailWag = 0.5 * k;
      break;
    case 'look-booties': // a look down at the feet, one paw lifted to check
      out.headPitch = 0.55 * k;
      out.headYaw = 0.18 * k;
      out.pawLift = 0.55 * k;
      break;
    case 'shake-coat': // a wriggle that settles the coat
      out.bodyRoll = 0.16 * Math.sin(m.elapsed * 18) * k;
      out.earFlap = 0.3 * Math.abs(Math.sin(m.elapsed * 18)) * k;
      break;
  }
  return out;
}

