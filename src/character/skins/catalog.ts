/**
 * The skin catalogue: every SPECIES the character can be (a skin in code), as plain data
 * (no three.js), so a settings screen can list them and the tests can check them without a
 * GPU. A species owns its rig and declares its SLOTS: where each wearable (`parts/`) sits
 * on this body, as an anchor placement relative to the rig's root (position, rotation in
 * radians, and a scale the part is drawn at). The halo and base anchors below are where
 * the halo and the ark always sat, so the default look is unchanged.
 *
 * Adding a skin: one row here, one folder `skins/<id>/` exporting a `SkinFactory`, and
 * one line in `skins/index.ts`. The factory table there is typed against `SkinId`, so a
 * row without a factory (or a factory without a row) fails the typecheck.
 */

import type { SlotId } from '../parts/catalog';

/** Where one slot sits on a body, relative to the rig root at rest (parts float steady: they never follow the bob). */
export interface SlotPlacement {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
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

export const SKINS = [
  {
    id: 'robot',
    name: 'Umoja',
    description: 'The pearl robot with a glowing visor face, floating over the ark.',
    slots: {
      halo: HALO_RING,
      base: ARK_BASE,
      aura: { position: [0, -0.35, 0], rotation: [0, 0, 0], scale: 1 },
    },
  },
  {
    id: 'puppy',
    name: 'Puppy',
    description: 'A soft caramel puppy with floppy ears and a wagging tail.',
    slots: {
      halo: HALO_RING,
      base: ARK_BASE,
      aura: { position: [0, -0.62, 0.05], rotation: [0, 0, 0], scale: 0.98 },
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
