/**
 * The point-sprite shader every effect kind is drawn with: one material per kind, the shape
 * chosen at compile time (`#define SHAPE`), so each kind is a single draw call with no
 * branching per pixel.
 *
 * Per point: `aSize` (world size), `aBright` (0 hides it; above 1 blooms), `aAngle` (spin)
 * and `aColour` (picked from the brand palette at birth). Shapes, drawn in the rotated
 * sprite square:
 *   0 sparkle  - a four-point star with a soft core
 *   1 heart    - a filled heart with a glow
 *   2 puff     - a soft ring of smoke
 *   3 mote     - a tiny glowing square
 *   4 confetti - a paper strip that flips as it spins
 *   5 zzz      - the letter Z
 *   6 note     - a musical eighth note (a head, a stem, a flag)
 *   7 spark    - a hot round point with a bright core
 *   8 orb      - a soft round glow (the thinking aura)
 *   9 flare    - a blinding star: eight long rays round a white-hot core
 * Additive kinds add light (sparkles, hearts, motes); the others are painted over.
 */
import { AdditiveBlending, NormalBlending, ShaderMaterial, type IUniform } from 'three';

export interface EffectUniforms extends Record<string, IUniform> {
  /** Device pixels per world unit at distance 1 (as the glow points use). */
  uScale: { value: number };
}

export type EffectMaterial = ShaderMaterial & { uniforms: EffectUniforms };

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  attribute float aAngle;
  attribute vec3 aColour;
  uniform float uScale;
  varying float vBright;
  varying float vAngle;
  varying vec3 vColour;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vBright = aBright;
    vAngle = aAngle;
    vColour = aColour;
    gl_PointSize = aBright <= 0.0 ? 0.0 : aSize * uScale / max(-mvPosition.z, 0.1);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vBright;
  varying float vAngle;
  varying vec3 vColour;

  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float c = cos(vAngle), s = sin(vAngle);
    p = mat2(c, s, -s, c) * p;
    float shape;
    float alpha;
  #if SHAPE == 0
    vec2 a = abs(p);
    float spikes = exp(-a.x * 16.0) * exp(-a.y * 2.6) + exp(-a.y * 16.0) * exp(-a.x * 2.6);
    shape = spikes + exp(-dot(p, p) * 14.0);
    alpha = 1.0;
  #elif SHAPE == 1
    vec2 q = vec2(abs(p.x), p.y * 1.1 + 0.55) * 1.25;
    float d;
    if (q.y + q.x > 1.0) d = length(q - vec2(0.25, 0.75)) - 0.35355;
    else d = sqrt(min(dot(q - vec2(0.0, 1.0), q - vec2(0.0, 1.0)), dot(q - 0.5 * max(q.x + q.y, 0.0), q - 0.5 * max(q.x + q.y, 0.0)))) * sign(q.x - q.y);
    shape = (1.0 - smoothstep(-0.03, 0.03, d)) * 1.2 + exp(-max(d, 0.0) * 9.0) * 0.4;
    alpha = 1.0;
  #elif SHAPE == 2
    float r = length(p);
    shape = exp(-pow((r - 0.62) / 0.22, 2.0)) * (1.0 - smoothstep(0.85, 1.0, r));
    alpha = shape;
  #elif SHAPE == 3
    vec2 a = abs(p);
    float box = max(a.x, a.y);
    shape = (1.0 - smoothstep(0.32, 0.4, box)) + exp(-dot(p, p) * 5.0) * 0.45;
    alpha = 1.0;
  #elif SHAPE == 4
    vec2 a = abs(vec2(p.x, p.y / max(abs(cos(vAngle * 1.7)), 0.15)));
    shape = (1.0 - smoothstep(0.78, 0.86, a.x)) * (1.0 - smoothstep(0.36, 0.44, a.y));
    alpha = shape;
  #elif SHAPE == 5
    float d = min(min(segment(p, vec2(-0.5, 0.55), vec2(0.5, 0.55)), segment(p, vec2(-0.5, -0.55), vec2(0.5, -0.55))), segment(p, vec2(0.5, 0.55), vec2(-0.5, -0.55)));
    shape = 1.0 - smoothstep(0.1, 0.17, d);
    alpha = shape;
  #elif SHAPE == 6
    vec2 h = (p - vec2(-0.22, -0.52)) * mat2(0.94, 0.34, -0.34, 0.94);
    float head = length(h / vec2(0.3, 0.21)) - 1.0;
    float stem = segment(p, vec2(0.05, -0.48), vec2(0.05, 0.72)) - 0.07;
    float flag = segment(p, vec2(0.05, 0.72), vec2(0.42, 0.28)) - 0.08;
    float d = min(min(head * 0.2, stem), flag);
    shape = (1.0 - smoothstep(-0.02, 0.04, d)) + exp(-max(d, 0.0) * 10.0) * 0.35;
    alpha = 1.0;
  #elif SHAPE == 7
    float r2 = dot(p, p);
    shape = exp(-r2 * 9.0) * 1.4 + exp(-r2 * 2.5) * 0.35;
    alpha = 1.0;
  #elif SHAPE == 8
    float r2 = dot(p, p);
    shape = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2));
    alpha = 1.0;
  #else
    float r = length(p);
    float a = atan(p.y, p.x);
    float rays = pow(abs(cos(a * 4.0)), 24.0) * exp(-r * 3.0) + pow(abs(cos(a * 4.0 + 0.785)), 40.0) * exp(-r * 5.0) * 0.6;
    shape = rays + exp(-r * r * 18.0) * 2.0 + exp(-r * 4.0) * 0.25;
    shape *= 1.0 - smoothstep(0.85, 1.0, r);
    alpha = 1.0;
  #endif
    if (shape < 0.003) discard;
    gl_FragColor = vec4(vColour * shape * vBright, clamp(alpha * min(vBright, 1.0), 0.0, 1.0));
  }
`;

/** A material that draws shape `shape` (`SHAPES` in `particle-kinds.ts`). */
export function createEffectMaterial(shape: number, additive: boolean): EffectMaterial {
  return new ShaderMaterial({
    uniforms: { uScale: { value: 1000 } },
    defines: { SHAPE: shape },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  }) as EffectMaterial;
}
