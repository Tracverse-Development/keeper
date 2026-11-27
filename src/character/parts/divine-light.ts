/**
 * Divine light that keeps the surface readable: the God Keeper (and anything it wears) is radiant at
 * its EDGES, while its surfaces keep real shading, so engraved gold, armour plates and robe folds
 * show instead of blooming to white.
 *
 * Two things are added to a lit material's shader, after all its lighting:
 *
 *   a soft ceiling  the surface's own light (lights, reflections, its glow) rolls off smoothly as it
 *                   nears `SURFACE_CEILING`, below the stage's bloom threshold (1.05 in
 *                   `stage/scene.ts`), so a surface never blooms; its darks and mid-tones (where
 *                   engraving and folds live) are untouched, its highlights compressed, not clipped
 *   a rim of light  a fresnel edge in the divine gold, added AFTER the ceiling, so the silhouette
 *                   alone blooms: the keeper looks lit from within
 *
 * Usage: `addDivineLight(material, rim)` once per material (it sets `onBeforeCompile`, so call it
 * after anything else that does, or fold that in); animate the rim by writing `rim.strength.value`.
 * One `DivineRim` may be shared by many materials. The halo, the rays and the motes are separate
 * light meshes and are not touched: they stay free to bloom.
 */
import { Color, type MeshStandardMaterial } from 'three';

/** Where the soft ceiling begins and the level a surface approaches but never reaches (linear). */
export const KNEE_START = 0.5;
export const SURFACE_CEILING = 0.96;

/** The divine gold of the rim. */
export const DIVINE_GOLD = new Color(1.0, 0.86, 0.55);

/** The rim's uniforms (shared by every material that wears it). */
export interface DivineRim {
  readonly strength: { value: number };
  readonly colour: { value: Color };
  /** How tight the rim hugs the edge (higher = thinner). */
  readonly power: { value: number };
}

/** A rim of `strength` in the divine gold. */
export function divineRim(strength: number, power = 2.6): DivineRim {
  return { strength: { value: strength }, colour: { value: DIVINE_GOLD.clone() }, power: { value: power } };
}

/**
 * The ceiling as plain maths, mirrored in the shader (tested): a luminance `l` maps to itself up to
 * KNEE_START, then rolls off exponentially toward SURFACE_CEILING. Order is kept (brighter stays brighter).
 */
export function softCeiling(l: number): number {
  if (l <= KNEE_START) return l;
  const room = SURFACE_CEILING - KNEE_START;
  return KNEE_START + room * (1 - Math.exp(-(l - KNEE_START) / room));
}

const HEAD = /* glsl */ `
uniform float uDivineRim;
uniform vec3 uDivineColour;
uniform float uDivinePower;
`;

const APPLY = /* glsl */ `
  {
    float divineL = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
    if (divineL > ${KNEE_START.toFixed(3)}) {
      float divineRoom = ${(SURFACE_CEILING - KNEE_START).toFixed(3)};
      float divineTo = ${KNEE_START.toFixed(3)} + divineRoom * (1.0 - exp(-(divineL - ${KNEE_START.toFixed(3)}) / divineRoom));
      outgoingLight *= divineTo / divineL;
    }
    float divineEdge = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uDivinePower);
    outgoingLight += uDivineColour * divineEdge * uDivineRim;
  }
  #include <opaque_fragment>
`;

/** Gives `material` the soft ceiling and the divine rim (see the module doc). */
export function addDivineLight(material: MeshStandardMaterial, rim: DivineRim): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDivineRim = rim.strength;
    shader.uniforms.uDivineColour = rim.colour;
    shader.uniforms.uDivinePower = rim.power;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${HEAD}`).replace('#include <opaque_fragment>', APPLY);
  };
  material.customProgramCacheKey = () => 'divine-light';
  material.needsUpdate = true;
}
