/**
 * The look: a colour and a material for each PAINT ZONE of a body (the dog's ears, the robot's
 * face screen), as plain data, validated like any other untrusted input.
 *
 * Each species declares its zones (the core's `src-tauri/src/keepers/kit/look.rs` `ZONES`;
 * `structure.test.ts` keeps the two lists equal). A keeper's look arrives as
 * `{ ears: { color: '#aa3311', material: 'fur' }, body: { material: 'metal' } }`; a zone left
 * out keeps the species' own colour and material, unknown zones and materials are dropped and
 * colours must be `#rrggbb`. Materials (`MATERIALS`) are a closed set the skins know how to
 * draw (`zone-paint.ts`): matte, gloss, metal, fur, glow.
 *
 * Pure (no three.js, no DOM): tested by `zones.test.ts`.
 */
import { isHexColour } from '../parts/effects.ts';

/** The paint zones each species offers, in the order the Studio lists them. */
export const LOOK_ZONES = {
  robot: ['head', 'face', 'eyes', 'body', 'core', 'antenna'],
  puppy: ['head', 'ears', 'muzzle', 'eyes', 'body', 'legs', 'paws', 'tail'],
  man: ['skin', 'hair', 'eyes', 'top', 'bottom', 'shoes'],
  woman: ['skin', 'hair', 'eyes', 'top', 'bottom', 'shoes'],
  owl: ['head', 'face', 'eyes', 'body', 'belly', 'wings', 'beak'],
  god: ['skin', 'body', 'robe', 'eyes', 'crown', 'rings'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export const MATERIALS = ['matte', 'gloss', 'metal', 'fur', 'glow'] as const;
export type MaterialId = (typeof MATERIALS)[number];

/** One zone as the keeper's profile holds it (either part may be missing). */
export interface ZoneLook {
  color?: string;
  material?: string;
}

/** A keeper's look as it arrives: zone id -> colour and material. */
export type Look = Readonly<Record<string, ZoneLook>>;

/** One zone, validated: a colour as 0xrrggbb, and a known material. */
export interface ResolvedZone {
  readonly color?: number;
  readonly material?: MaterialId;
}

export type ResolvedLook = Readonly<Record<string, ResolvedZone>>;

/** The zones species `species` offers (none for an unknown species). */
export function zonesOf(species: string): readonly string[] {
  return (LOOK_ZONES as Readonly<Record<string, readonly string[]>>)[species] ?? [];
}

export function isMaterial(value: unknown): value is MaterialId {
  return typeof value === 'string' && (MATERIALS as readonly string[]).includes(value);
}

/**
 * Validates an untrusted look for `species`: only its zones, a `#rrggbb` colour (or none) and a
 * known material (or none); a zone left with neither is dropped.
 */
export function resolveLook(input: unknown, species: string): ResolvedLook {
  const out: Record<string, ResolvedZone> = {};
  if (input === null || typeof input !== 'object') return out;
  for (const zone of zonesOf(species)) {
    if (!Object.prototype.hasOwnProperty.call(input, zone)) continue;
    const given = (input as Record<string, unknown>)[zone];
    if (given === null || typeof given !== 'object') continue;
    const { color, material } = given as ZoneLook;
    const resolved: { color?: number; material?: MaterialId } = {};
    if (isHexColour(color)) resolved.color = Number.parseInt(color.slice(1), 16);
    if (isMaterial(material)) resolved.material = material;
    if (resolved.color !== undefined || resolved.material !== undefined) out[zone] = resolved;
  }
  return out;
}

/** A stable key for a look (equal looks give equal keys), so an unchanged look repaints nothing. */
export function lookKey(look: ResolvedLook): string {
  return Object.keys(look)
    .sort()
    .map((zone) => `${zone}=${look[zone].color ?? ''}/${look[zone].material ?? ''}`)
    .join(';');
}
