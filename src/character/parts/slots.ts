/**
 * The slots a body can offer, in drawing order: the one list of WHERE a wearable can go.
 *
 * Three kinds of slot:
 *  - `floating`: the part floats steady around the body (the halo's orbit, the ark under it,
 *    the aura's field). The wardrobe glides its holder to the species' anchor and the part
 *    never follows the bob, as the halo and the ark always have.
 *  - `worn`: the part is worn ON the body (a cap on the head, a scarf round the neck, a jacket
 *    on the torso, a backpack on the back). It rides on a bone of the rig (it turns with the
 *    head, leans with the body) and is FITTED to the shape the species publishes for that
 *    slot (`fit.ts`), so one jacket fits a robot and a puppy alike. `legs` is worn over a person's legs and hips (trousers, a skirt); `paws` (named Feet: the id
 *    stays for stored outfits) is worn on every foot
 *    the body publishes (the puppy's paws, the God Keeper's feet); `face` sits at eye level on the
 *    head (spectacles, a visor); `wrist` wraps the left wrist and `held` sits in the right hand,
 *    so only bodies with arms offer them.
 *  - `effect`: nothing is drawn on the body. The part worn there changes how a MOMENT looks
 *    (`thinking`: the aura while it thinks; `celebrate`: the burst when it cheers). None worn =
 *    the classic look (`effects/moments.ts`).
 *
 * Mirrored by the core (`src-tauri/src/keepers/kit/slots.rs`; `structure.test.ts` keeps the
 * two lists equal). Never rename a shipped id: profiles and packs store them.
 */

export const SLOTS = [
  { id: 'halo', name: 'Halo', kind: 'floating' },
  { id: 'head', name: 'Head', kind: 'worn' },
  { id: 'face', name: 'Face', kind: 'worn' },
  { id: 'neck', name: 'Neck', kind: 'worn' },
  { id: 'torso', name: 'Torso', kind: 'worn' },
  { id: 'legs', name: 'Legs', kind: 'worn' },
  { id: 'back', name: 'Back', kind: 'worn' },
  { id: 'paws', name: 'Feet', kind: 'worn' },
  { id: 'wrist', name: 'Wrist', kind: 'worn' },
  { id: 'held', name: 'Held', kind: 'worn' },
  { id: 'base', name: 'Base', kind: 'floating' },
  { id: 'aura', name: 'Aura', kind: 'floating' },
  { id: 'thinking', name: 'Thinking', kind: 'effect' },
  { id: 'celebrate', name: 'Celebrate', kind: 'effect' },
] as const;

export type SlotId = (typeof SLOTS)[number]['id'];
export type SlotKind = (typeof SLOTS)[number]['kind'];

/** Every slot id, in drawing order. */
export const SLOT_IDS: readonly SlotId[] = SLOTS.map((slot) => slot.id);

/** True for a slot whose part is worn on (and fitted to) the body. */
export function isWornSlot(slot: SlotId): boolean {
  return SLOTS.some((s) => s.id === slot && s.kind === 'worn');
}

/** True for a slot whose part changes a moment instead of being drawn on the body. */
export function isEffectSlot(slot: SlotId): boolean {
  return SLOTS.some((s) => s.id === slot && s.kind === 'effect');
}
