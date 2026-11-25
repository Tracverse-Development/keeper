/**
 * The night-sky stage behind Umoja, drawn by one full-screen shader quad (no textures):
 * a deep-navy gradient with a soft vignette, a faint warm aura behind the character,
 * two layers of slowly twinkling stars that thin out toward the horizon, and three
 * slow parallax waves along the bottom with faint gold crests (the "waves" of the ark).
 *
 * It is drawn first, without depth, so everything else simply lies on top of it.
 * A touch of blue-noise-like dither keeps the dark gradient free of banding.
 */
import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { PALETTE } from '../palette';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uPresence;
  uniform vec2 uAuraCentre;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uGold;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float stars(vec2 uv, float density, float seed) {
    vec2 cell = floor(uv * density);
    vec2 local = fract(uv * density) - 0.5;
    float h = hash(cell + seed);
    if (h < 0.86) return 0.0;
    vec2 offset = vec2(hash(cell + seed + 1.7), hash(cell + seed + 9.2)) - 0.5;
    float d = length(local - offset * 0.7);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + h * 1.6) + h * 40.0);
    return smoothstep(0.08, 0.0, d) * (h - 0.86) * 7.0 * twinkle;
  }

  float waveLine(vec2 uv, float base, float amp, float freq, float speed, float phase) {
    float y = base + amp * sin(uv.x * freq + uTime * speed + phase)
                   + amp * 0.45 * sin(uv.x * freq * 2.1 - uTime * speed * 0.7 + phase * 1.7);
    return y;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspectUv = vec2(uv.x * uAspect, uv.y);

    // Gradient + vignette.
    vec2 centred = (uv - vec2(0.5, 0.58)) * vec2(uAspect, 1.0);
    float radial = length(centred);
    vec3 colour = mix(uMid, uDeep, smoothstep(0.1, 0.95, radial));
    colour = mix(colour, uHigh, smoothstep(0.55, 0.0, radial) * 0.35);

    // A faint warm aura behind the character (dims when asleep).
    vec2 auraDelta = (uv - uAuraCentre) * vec2(uAspect, 1.0);
    colour += uGold * exp(-dot(auraDelta, auraDelta) * 9.0) * 0.025 * (0.3 + 0.7 * uPresence);

    // Stars, thinning toward the waves.
    float sky = smoothstep(0.12, 0.45, uv.y);
    float starLight = stars(aspectUv, 38.0, 0.0) + stars(aspectUv + 3.1, 90.0, 7.0) * 0.6;
    colour += mix(uHigh * 2.0, vec3(1.0), 0.5) * starLight * sky * 0.35;

    // Three parallax waves at the bottom: dark water below each, a faint gold crest on top.
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float base = 0.2 - fi * 0.05;
      float crest = waveLine(uv, base, 0.012 + fi * 0.004, 5.0 + fi * 2.3, 0.18 + fi * 0.07, fi * 2.4);
      float below = smoothstep(crest + 0.004, crest - 0.02, uv.y);
      colour = mix(colour, uDeep * (0.9 - fi * 0.15), below * 0.75);
      float line = exp(-abs(uv.y - crest) * (380.0 - fi * 60.0));
      colour += uGold * line * (0.08 + fi * 0.03) * (0.4 + 0.6 * uPresence);
    }

    colour *= 1.0 - smoothstep(0.55, 1.25, radial) * 0.55;
    colour += (hash(uv * 1024.0 + fract(uTime)) - 0.5) / 255.0;
    gl_FragColor = vec4(max(colour, 0.0), 1.0);
  }
`;

export interface Backdrop {
  readonly mesh: Mesh;
  setAspect(aspect: number): void;
  update(time: number, presence: number): void;
  dispose(): void;
}

export function createBackdrop(): Backdrop {
  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uPresence: { value: 1 },
    uAuraCentre: { value: new Vector2(0.5, 0.64) },
    uDeep: { value: new Color(PALETTE.navy950) },
    uMid: { value: new Color(PALETTE.navy800) },
    uHigh: { value: new Color(PALETTE.navy600) },
    uGold: { value: new Color(PALETTE.gold500) },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    setAspect(aspect) {
      uniforms.uAspect.value = aspect;
    },
    update(time, presence) {
      uniforms.uTime.value = time;
      uniforms.uPresence.value = presence;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
