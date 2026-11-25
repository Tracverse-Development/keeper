/**
 * The materials worn parts are made of: soft cloth (a strong sheen lobe, like the puppy's fur,
 * so edges catch a velvety glow under the rim lights) and a satin trim for piping, brims, zips
 * and buttons. Colours come from a part's effects (already resolved `#rrggbb`), so a variant is
 * just another colour of the same cloth. Both are double-sided: a garment is one thin shell.
 */
import { Color, DoubleSide, MeshPhysicalMaterial } from 'three';

/** Soft fabric in `colour` (0xrrggbb); `roughness` 0.6 (knit) .. 0.9 (canvas). */
export function clothMaterial(colour: number, roughness = 0.78): MeshPhysicalMaterial {
  const base = new Color(colour);
  return new MeshPhysicalMaterial({
    color: base,
    roughness,
    metalness: 0,
    // A soft lobe tinted by the cloth itself: a white sheen turns dark cloth to frosted glass.
    sheen: 0.8,
    sheenRoughness: 0.55,
    sheenColor: base.clone().lerp(new Color(0xffffff), 0.22),
    side: DoubleSide,
    envMapIntensity: 0.7,
  });
}

/** Satin trim in `colour`: a soft metallic gleam (gold piping reads as gold thread). */
export function trimMaterial(colour: number): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: colour,
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    side: DoubleSide,
  });
}
