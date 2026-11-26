/**
 * The skin catalogue: every SPECIES the character can be (a skin in code), as plain data
 * (no three.js), so a settings screen can list them and the tests can check them without a
 * GPU. A species owns its rig and declares its SLOTS: where each wearable (`parts/`) sits
 * on this body, as an anchor placement relative to the rig's root (position, rotation in
 * radians, and a scale the part is drawn at). The halo and base anchors below are where
 * the halo and the ark always sat, so the default look is unchanged.
 *
 * Slots worn ON the body (head, neck, torso, back: `parts/slots.ts`) also name the rig bone
 * they ride (`follow`: the head turns a cap with it, the body leans a jacket) and publish the
 * body's SHAPE there (`parts/fit.ts`), measured from the same constants the rig is built from
 * (`robot/robot-shape.ts`, `puppy/puppy-shape.ts`). Any wearable for that slot fits itself to
 * the shape, so it works on every species that offers the slot. A species without a slot
 * simply leaves it out, and the wardrobe says so instead of failing.
 *
 * Adding a skin: one row here, one folder `skins/<id>/` exporting a `SkinFactory`, and
 * one line in `skins/index.ts`. The factory table there is typed against `SkinId`, so a
 * row without a factory (or a factory without a row) fails the typecheck.
 */

import type { BodyShape } from '../parts/fit.ts';
import type { SlotId } from '../parts/slots.ts';
import { PUPPY_HAT_FORWARD, PUPPY_HEAD_SHAPE, PUPPY_NECK_SHAPE, PUPPY_NECK_Y, PUPPY_PAWS_SHAPE, PUPPY_TORSO_SHAPE } from './puppy/puppy-shape.ts';
import { ROBOT_HEAD_SHAPE, ROBOT_NECK_SHAPE, ROBOT_NECK_Y, ROBOT_TORSO_SHAPE } from './robot/robot-shape.ts';

/**
 * The rig joints a worn slot (or one foot of it) can ride: the leaning body, the turning head, and
 * the puppy's waving front paw and scratching hind paw.
 */
export type Bone = 'body' | 'head' | 'paw' | 'hindPaw';

/**
 * Where one slot sits on a body. Floating slots: relative to the rig root at rest (parts float
 * steady: they never follow the bob). Worn slots: relative to the `follow` bone, with the body's
 * `shape` there for the part to fit. Effect slots (`thinking`, `celebrate`) hold no placement
 * that matters (`MOMENT`): nothing is drawn on the body, the worn effect changes a moment.
 */
export interface SlotPlacement {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly follow?: Bone;
  readonly shape?: BodyShape;
}

/** A worn slot riding `follow` at `position`, fitted to `shape` (no rotation; drawn at scale 1). */
function worn(follow: Bone, position: readonly [number, number, number], shape: BodyShape): SlotPlacement {
  return { position, rotation: [0, 0, 0], scale: 1, follow, shape };
}

export interface SkinInfo {
  /** Stable kebab-case id, stored in settings; never rename a shipped one. */
  readonly id: string;
  /** What the person sees in a picker. */
  readonly name: string;
  /** One short sentence for the picker. */
  readonly description: string;
  /** The slots this species offers and where each sits. */
  readonly slots: Readonly<Partial<Record<SlotId, SlotPlacement>>>;
}

/** The halo orbit and the ark: the placements both species shipped with. */
const HALO_RING: SlotPlacement = { position: [0, 0.15, 0], rotation: [0.32, 0, -0.1], scale: 1 };
const ARK_BASE: SlotPlacement = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
/** An effect slot: the body offers the moment; there is nothing to place. */
const MOMENT: SlotPlacement = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };

export const SKINS = [
  {
    id: 'robot',
    name: 'Robot',
    description: 'The pearl robot with a glowing visor face, floating over the ark.',
    slots: {
      halo: HALO_RING,
      head: worn('head', [0, 0, 0], ROBOT_HEAD_SHAPE),
      neck: worn('body', [0, ROBOT_NECK_Y, 0], ROBOT_NECK_SHAPE),
      torso: worn('body', [0, ROBOT_NECK_Y, 0], ROBOT_TORSO_SHAPE),
      back: worn('body', [0, ROBOT_NECK_Y, 0], ROBOT_TORSO_SHAPE),
      base: ARK_BASE,
      aura: { position: [0, -0.35, 0], rotation: [0, 0, 0], scale: 1 },
      thinking: MOMENT,
      celebrate: MOMENT,
    },
  },
  {
    id: 'puppy',
    name: 'Puppy',
    description: 'A soft caramel puppy with floppy ears and a wagging tail.',
    slots: {
      halo: HALO_RING,
      head: worn('head', [0, 0, PUPPY_HAT_FORWARD], PUPPY_HEAD_SHAPE),
      neck: worn('body', [0, PUPPY_NECK_Y, 0], PUPPY_NECK_SHAPE),
      torso: worn('body', [0, PUPPY_NECK_Y, 0], PUPPY_TORSO_SHAPE),
      back: worn('body', [0, PUPPY_NECK_Y, 0], PUPPY_TORSO_SHAPE),
      paws: worn('body', [0, 0, 0], PUPPY_PAWS_SHAPE),
      base: ARK_BASE,
      aura: { position: [0, -0.62, 0.05], rotation: [0, 0, 0], scale: 0.98 },
      thinking: MOMENT,
      celebrate: MOMENT,
    },
  },
] as const satisfies readonly SkinInfo[];

export type SkinId = (typeof SKINS)[number]['id'];

/** The look the character wears when nothing else is chosen. */
export const DEFAULT_SKIN_ID: SkinId = 'robot';

/** True when `value` names a skin in the catalogue (guards strings from settings). */
export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && SKINS.some((skin) => skin.id === value);
}

/** The slots species `id` declares (its catalogue row's placements). */
export function slotsOf(id: SkinId): SkinInfo['slots'] {
  return SKINS.find((skin) => skin.id === id)?.slots ?? {};
}

/** A known id unchanged, anything else the default (a removed skin never breaks the face). */
export function resolveSkinId(value: unknown): SkinId {
  return isSkinId(value) ? value : DEFAULT_SKIN_ID;
}
