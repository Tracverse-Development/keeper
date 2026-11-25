/**
 * Part effects: the named, typed knobs a wearable exposes (its colour, spin speeds, counts),
 * declared as a schema and resolved from untrusted data.
 *
 * A variant ("Ruby Halo") is only data: `{ part: 'memory-halo', effects: { color: '#e2425f' } }`.
 * It may come from a pack someone shared, so `resolveEffects` never trusts it: unknown keys
 * are ignored, numbers are clamped into the schema's range (NaN and wrong types fall back to
 * the default), and colours must be `#rrggbb`. The result always has every key of the schema.
 *
 * Pure (no three.js, no DOM): tested by `effects.test.ts`.
 */

/** A numeric effect: the value is clamped into [min, max]; `step: 1` rounds to an integer. */
export interface NumberEffect {
  readonly kind: 'number';
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step?: number;
}

/** A colour effect, written as `#rrggbb` (case-insensitive; stored lower-case). */
export interface ColourEffect {
  readonly kind: 'colour';
  readonly label: string;
  readonly default: string;
}

export type EffectSpec = NumberEffect | ColourEffect;
export type EffectSchema = Readonly<Record<string, EffectSpec>>;
/** Resolved effects: every schema key present, numbers clamped, colours normalised. */
export type EffectValues = Readonly<Record<string, number | string>>;

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** True for a `#rrggbb` string. */
export function isHexColour(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOUR.test(value);
}

/** One value resolved against its spec (anything invalid becomes the default). */
export function resolveEffect(spec: EffectSpec, value: unknown): number | string {
  if (spec.kind === 'colour') return isHexColour(value) ? value.toLowerCase() : spec.default;
  if (typeof value !== 'number' || !Number.isFinite(value)) return spec.default;
  const clamped = Math.min(Math.max(value, spec.min), spec.max);
  return spec.step === 1 ? Math.round(clamped) : clamped;
}

/** Resolves untrusted input against `schema`; keys the schema does not name are dropped. */
export function resolveEffects(schema: EffectSchema, input: unknown): EffectValues {
  const source = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out: Record<string, number | string> = {};
  for (const key of Object.keys(schema)) {
    const given = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
    out[key] = resolveEffect(schema[key], given);
  }
  return out;
}

/** Reads a resolved number (a typed accessor for part factories). */
export function effectNumber(values: EffectValues, key: string): number {
  const value = values[key];
  return typeof value === 'number' ? value : 0;
}

/** Reads a resolved colour as a 0xrrggbb integer. */
export function effectColour(values: EffectValues, key: string): number {
  const value = values[key];
  return typeof value === 'string' && isHexColour(value) ? Number.parseInt(value.slice(1), 16) : 0;
}

/** A stable key for a set of resolved values (equal values give equal keys). */
export function effectsKey(values: EffectValues): string {
  return Object.keys(values)
    .sort()
    .map((key) => `${key}=${values[key]}`)
    .join(';');
}
