/**
 * The skin catalogue: every look the character can wear, as plain data (no three.js),
 * so a settings screen can list them and the tests can check them without a GPU.
 *
 * Adding a skin: one row here, one folder `skins/<id>/` exporting a `SkinFactory`, and
 * one line in `skins/index.ts`. The factory table there is typed against `SkinId`, so a
 * row without a factory (or a factory without a row) fails the typecheck.
 */

export interface SkinInfo {
  /** Stable kebab-case id, stored in settings; never rename a shipped one. */
  readonly id: string;
  /** What the person sees in a picker. */
  readonly name: string;
  /** One short sentence for the picker. */
  readonly description: string;
}

export const SKINS = [
  {
    id: 'robot',
    name: 'Umoja',
    description: 'The pearl robot with a glowing visor face, floating over the ark.',
  },
  {
    id: 'puppy',
    name: 'Puppy',
    description: 'A soft caramel puppy with floppy ears and a wagging tail.',
  },
] as const satisfies readonly SkinInfo[];

export type SkinId = (typeof SKINS)[number]['id'];

/** The look the character wears when nothing else is chosen. */
export const DEFAULT_SKIN_ID: SkinId = 'robot';

/** True when `value` names a skin in the catalogue (guards strings from settings). */
export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && SKINS.some((skin) => skin.id === value);
}

/** A known id unchanged, anything else the default (a removed skin never breaks the face). */
export function resolveSkinId(value: unknown): SkinId {
  return isSkinId(value) ? value : DEFAULT_SKIN_ID;
}
