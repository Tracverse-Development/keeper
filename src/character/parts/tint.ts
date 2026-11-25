/**
 * Re-tints a palette colour by a part's chosen colour, keeping the palette's relationships.
 *
 * Parts are designed in the brand gold: an edge in gold400, a ring in gold500, an emissive in
 * gold600. A variant names ONE colour (`#e2425f`); each designed colour is scaled channel by
 * channel by (chosen / gold500), so lighter and darker shades stay lighter and darker. The
 * default colour (gold500) gives a ratio of exactly 1, so the shipped look is unchanged.
 */
import { Color } from 'three';
import { PALETTE } from '../palette';

const BASE = new Color(PALETTE.gold500);

/** `reference` (0xrrggbb) re-tinted by `chosen` (0xrrggbb), as a new linear-space Color. */
export function tintColour(reference: number, chosen: number): Color {
  const pick = new Color(chosen);
  const out = new Color(reference);
  out.r *= pick.r / BASE.r;
  out.g *= pick.g / BASE.g;
  out.b *= pick.b / BASE.b;
  return out;
}
