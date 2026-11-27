/**
 * The God Keeper's measurements: a human frame (`../human/human-shape.ts`) cut taller in the chest
 * and broader in the shoulders, its robe falling from the waist almost to the feet, hovering higher
 * over the ark than anyone. Pure data (no three.js): shared by the rig (`god-skin.ts`) and the anchors
 * it publishes (`skins/catalog.ts`).
 */
import type { HumanFrame } from '../human/human-shape.ts';

/** How high the God Keeper hovers over its rest place (world units). */
export const GOD_HOVER = 0.18;

export const GOD_FRAME: HumanFrame = {
  head: [0.74, 0.79, 0.72],
  hat: [0.8, 0.86, 0.78],
  torso: [
    [0.001, 0.02],
    [0.2, 0.015],
    [0.36, -0.03],
    [0.5, -0.12],
    [0.52, -0.27],
    [0.46, -0.46],
    [0.4, -0.6],
    [0.44, -0.78],
    [0.52, -1.02],
    [0.6, -1.3],
    [0.64, -1.42],
    [0.001, -1.44],
  ],
  waist: -0.6,
  depth: 0.74,
  shoulder: { x: 0.48, y: -0.15 },
  arm: { sleeve: 0.13, radius: 0.1, length: 0.52, hand: 0.11, spread: 0.2 },
  leg: { x: 0.17, top: -1.5, length: 0.3, radius: 0.12 },
  shoe: [0.12, 0.08, 0.22],
};
