/**
 * Soft glowing point sprites, shared by the memory halo's nodes and the memory sparks.
 *
 * Per point: `aSize` (world size), `aBright` (0 hides it, >1 is HDR and blooms) and
 * `aPhase` (offsets the twinkle). Points shrink with distance like real objects, are
 * drawn additively (light adds to light) and never write depth, so they layer cleanly
 * in front of and behind the body.
 */
import { AdditiveBlending, Color, ShaderMaterial, type IUniform } from 'three';
import { PALETTE } from '../palette.ts';

export interface GlowPointsUniforms extends Record<string, IUniform> {
  uTime: { value: number };
  uGlow: { value: number };
  /** Device pixels per world unit at distance 1: drawingBufferHeight / (2 tan(fov / 2)). */
  uScale: { value: number };
  uTwinkle: { value: number };
  uWarm: { value: Color };
  uHot: { value: Color };
}

export type GlowPointsMaterial = ShaderMaterial & { uniforms: GlowPointsUniforms };

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform float uTwinkle;
  varying float vBright;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 1.0 + uTwinkle * sin(uTime * 1.7 + aPhase * 6.2831);
    vBright = aBright * twinkle;
    gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
    if (aBright <= 0.0) gl_PointSize = 0.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uGlow;
  uniform vec3 uWarm;
  uniform vec3 uHot;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float core = exp(-r2 * 18.0);
    float glow = exp(-r2 * 4.0) * 0.35;
    vec3 colour = mix(uWarm, uHot, clamp(core * vBright * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(colour * (core + glow) * vBright * uGlow, 1.0);
  }
`;

export function createGlowPointsMaterial(twinkle = 0.25): GlowPointsMaterial {
  const uniforms: GlowPointsUniforms = {
    uTime: { value: 0 },
    uGlow: { value: 1 },
    uScale: { value: 1000 },
    uTwinkle: { value: twinkle },
    uWarm: { value: new Color(PALETTE.gold500) },
    uHot: { value: new Color(PALETTE.cream50) },
  };
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }) as GlowPointsMaterial;
}
