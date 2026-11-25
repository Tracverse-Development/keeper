/**
 * The glowing "glyph" shader that draws the eyes and the mouth on the visor.
 *
 * One signed-distance shape covers every expression: a rounded pill whose height is
 * the lid opening (`open`), bent into a smile or a frown (`bend`), with its underside
 * carved into a "^" arc for a happy squint (`squint`). The shape is drawn crisp with
 * `fwidth` anti-aliasing, a cream core fading to a gold edge, a soft HDR glow around it
 * (that is what the bloom picks up) and a small catchlight that follows the gaze.
 * Drawing it in a shader, not with geometry, keeps every transition perfectly smooth.
 *
 * All sizes are in head-space units, the same units as the quad the material sits on.
 */
import { AdditiveBlending, Color, ShaderMaterial, type IUniform, Vector2 } from 'three';
import { PALETTE } from '../../palette';

export interface GlyphUniforms extends Record<string, IUniform> {
  uQuad: { value: Vector2 };
  uHalf: { value: Vector2 };
  uShift: { value: Vector2 };
  uOpen: { value: number };
  uLine: { value: number };
  uBend: { value: number };
  uSquint: { value: number };
  uGlow: { value: number };
  uGlowWidth: { value: number };
  uCore: { value: Color };
  uEdge: { value: Color };
}

export type GlyphMaterial = ShaderMaterial & { uniforms: GlyphUniforms };

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec2 uQuad;
  uniform vec2 uHalf;
  uniform vec2 uShift;
  uniform float uOpen;
  uniform float uLine;
  uniform float uBend;
  uniform float uSquint;
  uniform float uGlow;
  uniform float uGlowWidth;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  varying vec2 vUv;

  float roundBox(vec2 p, vec2 halfSize, float radius) {
    vec2 d = abs(p) - halfSize + radius;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uQuad - uShift;
    // Bend: positive lifts the ends (a smile, a content closed eye), negative droops them.
    p.y -= uBend * (p.x * p.x) / max(uHalf.x, 1e-4);

    float h = max(uHalf.y * uOpen, uLine);
    float d = roundBox(p, vec2(uHalf.x, h), min(uHalf.x, h));

    // Happy squint: a wide circle rises from below and carves the pill into an arc.
    float carveRadius = uHalf.x * 1.7;
    float carveCentre = -h - carveRadius + uSquint * h * 1.35;
    d = max(d, -(length(p - vec2(0.0, carveCentre)) - carveRadius));

    float aa = max(fwidth(d), 1e-4);
    float body = 1.0 - smoothstep(-aa, aa, d);
    float inner = smoothstep(0.0, -max(h, uLine) * 0.9, d);
    float halo = exp(-max(d, 0.0) / uGlowWidth);

    // A soft catchlight up and to the left of the gaze: the eye feels wet and alive.
    vec2 spot = p - vec2(-0.3 * uHalf.x, 0.45 * h);
    float catchlight = exp(-dot(spot, spot) / max(0.012 * uHalf.x * uHalf.x, 1e-5)) * body;

    vec3 colour = mix(uEdge, uCore, inner) * body * 1.45;
    colour += uCore * catchlight * 0.9;
    colour += uEdge * halo * (1.0 - body) * 0.35;
    gl_FragColor = vec4(colour * uGlow, 1.0);
  }
`;

export interface GlyphOptions {
  /** Size of the quad the shape is drawn on (head units). */
  quad: Vector2;
  /** Half size of the shape when fully open. */
  half: Vector2;
  /** Half thickness of the shape when closed to a line. */
  line: number;
  /** Width of the glow fall-off. */
  glowWidth: number;
}

/** A new glyph material; the face mutates its uniforms every frame. */
export function createGlyphMaterial(options: GlyphOptions): GlyphMaterial {
  const uniforms: GlyphUniforms = {
    uQuad: { value: options.quad.clone() },
    uHalf: { value: options.half.clone() },
    uShift: { value: new Vector2() },
    uOpen: { value: 1 },
    uLine: { value: options.line },
    uBend: { value: 0 },
    uSquint: { value: 0 },
    uGlow: { value: 1 },
    uGlowWidth: { value: options.glowWidth },
    uCore: { value: new Color(PALETTE.cream50) },
    uEdge: { value: new Color(PALETTE.gold400) },
  };
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  }) as GlyphMaterial;
}
