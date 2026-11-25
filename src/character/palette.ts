/**
 * The character's colours, mirrored from `src/kernel/tokens.css` (the brand kit:
 * navy #151C33, gold #D39744, cream #F4EEE2, stage #0B1020). WebGL cannot read CSS
 * custom properties, so this is the ONE place the 3D scene takes its colours from;
 * keep it in step with tokens.css.
 */
export const PALETTE = {
  navy950: 0x070a16,
  navy900: 0x0b1020,
  navy800: 0x111830,
  navy700: 0x151c33,
  navy600: 0x1e2848,
  navy500: 0x2a3760,
  gold300: 0xf0c98a,
  gold400: 0xe3b06a,
  gold500: 0xd39744,
  gold600: 0xb57b2c,
  cream50: 0xfbf8f2,
  cream100: 0xf4eee2,
  cream300: 0xd9cfbd,
  // Skin colours (not brand tokens): the puppy's coat and features, tuned to sit
  // beside the brand navy and gold under the same lights.
  caramel400: 0xd09455,
  caramel500: 0xb9773d,
  caramel700: 0x7f4a24,
  coatCream: 0xf0e2c8,
  nose900: 0x1b1315,
  eye950: 0x0f0a09,
  iris600: 0x5a321a,
  tongue400: 0xe5807e,
  mouth900: 0x3a181b,
  // Work colours (not brand tokens): the robot's eyes go electric cyan while it works and
  // hot amber near its limit; embers and the chest heat glow use the amber; the puppy's
  // sweat drop is a cool glint.
  workCyanCore: 0xd8fcff,
  workCyanEdge: 0x1fd2d6,
  heatCore: 0xffe4bd,
  heatAmber: 0xff7a1e,
  sweatGlint: 0xd2efff,
} as const;
