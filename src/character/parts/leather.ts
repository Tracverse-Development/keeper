/**
 * Worn leather, drawn by the shader (no texture files): a pebbled grain you can see catch the
 * light, large soft patches where the dye has faded, and paler scuffs where it has rubbed thin.
 * `wear` (0 new .. 1 well travelled) scales the fading and the scuffs; the grain is always there.
 *
 * Built on `MeshPhysicalMaterial` (`onBeforeCompile`), so it is lit, fogged and tone-mapped like
 * every other surface on the stage, and the rarity and set decorators treat it as any material.
 * The pattern is read from the surface's own position, so it needs no UVs and never swims when the
 * cloth sways.
 */
import { Color, DoubleSide, MeshPhysicalMaterial } from 'three';

/** Grain cells per world unit, and how hard the grain bends the light. */
const GRAIN = 70;
const GRAIN_BUMP = 0.005;

export function leatherMaterial(colour: number, wear = 0.6): MeshPhysicalMaterial {
  const base = new Color(colour);
  const material = new MeshPhysicalMaterial({
    color: base,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: base.clone().lerp(new Color(0xffffff), 0.3),
    side: DoubleSide,
  });
  const uWear = { value: Math.min(Math.max(wear, 0), 1) };
  material.customProgramCacheKey = () => 'leather';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLeatherWear = uWear;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLeatherPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeatherPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${COLOUR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROUGHNESS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${BUMP}`);
  };
  return material;
}

const HEAD = /* glsl */ `
  varying vec3 vLeatherPos;
  uniform float uLeatherWear;
  float leatherHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float leatherNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(leatherHash(i), leatherHash(i + vec3(1, 0, 0)), f.x), mix(leatherHash(i + vec3(0, 1, 0)), leatherHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(leatherHash(i + vec3(0, 0, 1)), leatherHash(i + vec3(1, 0, 1)), f.x), mix(leatherHash(i + vec3(0, 1, 1)), leatherHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float leatherFbm(vec3 p) {
    return 0.5 * leatherNoise(p) + 0.3 * leatherNoise(p * 2.1 + 3.7) + 0.2 * leatherNoise(p * 4.3 + 9.1);
  }
  /** The pebbled grain: rounded cells with creases between them (0 in a crease, 1 on a pebble). */
  float leatherGrain(vec3 p) {
    vec3 q = p * ${GRAIN.toFixed(1)};
    vec3 i = floor(q);
    vec3 f = fract(q);
    float near = 1.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 o = vec3(float(x), float(y), float(z));
      vec3 c = o + vec3(leatherHash(i + o), leatherHash(i + o + 5.3), leatherHash(i + o + 11.7)) - f;
      near = min(near, dot(c, c));
    }
    return 1.0 - smoothstep(0.0, 0.55, near);
  }
`;

const COLOUR = /* glsl */ `
  float leatherFade = leatherFbm(vLeatherPos * 5.0);
  float leatherScuff = smoothstep(0.6, 0.78, leatherFbm(vLeatherPos * 17.0 + 4.0));
  // The grain fades out where a pebble is smaller than a pixel (far away it would only shimmer).
  float leatherNear = 1.0 - smoothstep(0.35, 1.1, length(fwidth(vLeatherPos)) * ${GRAIN.toFixed(1)});
  float leatherPebble = mix(0.6, leatherGrain(vLeatherPos), leatherNear);
  diffuseColor.rgb *= mix(1.0, mix(0.72, 1.22, smoothstep(0.25, 0.75, leatherFade)), 0.35 + 0.65 * uLeatherWear);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.6 + 0.03, uLeatherWear * leatherScuff * 0.6);
  diffuseColor.rgb *= 0.9 + 0.1 * leatherPebble;
`;

const ROUGHNESS = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor + 0.22 * (1.0 - leatherPebble) + 0.2 * uLeatherWear * leatherScuff - 0.08, 0.2, 1.0);
`;

/** Bends the normal by the grain's slope (screen-space derivatives: no tangents needed). */
const BUMP = /* glsl */ `
  {
    vec3 lp1 = dFdx(-vViewPosition);
    vec3 lp2 = dFdy(-vViewPosition);
    float lh1 = dFdx(leatherPebble);
    float lh2 = dFdy(leatherPebble);
    vec3 lr1 = cross(lp2, normal);
    vec3 lr2 = cross(normal, lp1);
    float ldet = dot(lp1, lr1);
    vec3 lgrad = sign(ldet) * (lh1 * lr1 + lh2 * lr2);
    normal = normalize(abs(ldet) * normal - ${GRAIN_BUMP.toFixed(4)} * lgrad);
  }
`;
