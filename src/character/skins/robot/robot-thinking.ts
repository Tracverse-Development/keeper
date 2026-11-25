/**
 * The robot's thinking effects that live on its head, beyond the face glyphs themselves:
 *   - data lines: faint cyan dashes flowing sideways across the visor glass, row by row,
 *     like a display reading records (an additive overlay patch just above the glass);
 *   - pulse rings: a soft cyan energy ring radiating outward from the head every
 *     `THINK_PULSE_SECONDS` (two ring quads behind the head, staggered half a life apart).
 *
 * `update(drama, t)` takes the thinking drama 0..1 (`thinking.ts`, already eased) and the
 * motion-scaled clock. At drama 0 every mesh is hidden (no draw call), so a robot that is
 * not thinking renders exactly as it did. Nothing allocates per frame.
 */
import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial, type IUniform, type Object3D } from 'three';
import { PALETTE } from '../../palette';
import { THINK_PULSE_SECONDS, cyclePhase, ringPulse } from '../../thinking';
import { ellipsoidPatch } from './head-shape';

/** The visor's outline (the same shape `body.ts` builds the glass from), lifted a touch above it. */
const VISOR = { halfWidth: 0.7, halfHeight: 0.4, centreY: 0.02, exponent: 4.2, inflate: 0.018 };
/** How bright the data lines get at full drama (they stay faint), and the rings. */
const LINES_GLOW = 0.4;
const RING_GLOW = 0.75;
/** Ring quad size, the head-sized radius a ring is born at, and how far behind the face it sits. */
const RING_QUAD = 5.6;
const RING_START = 1.04;
const RING_DEPTH = -0.05;

const VISOR_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VISOR_FRAGMENT = /* glsl */ `
  uniform float uAmount;
  uniform float uTime;
  uniform vec3 uColour;
  varying vec2 vPos;
  float hash(float n) { return fract(sin(n * 91.7) * 43758.5453); }
  void main() {
    const float rowHeight = 0.05;
    float rowCoord = (vPos.y + 1.0) / rowHeight;
    float row = floor(rowCoord);
    float line = exp(-pow((fract(rowCoord) - 0.5) * rowHeight / 0.0035, 2.0));
    float direction = hash(row) > 0.5 ? 1.0 : -1.0;
    float x = vPos.x * 6.0 + direction * uTime * (1.5 + hash(row + 7.0) * 3.5) + hash(row + 3.0) * 10.0;
    float cell = fract(x);
    float dash = step(hash(floor(x) + row * 17.0), 0.55) * smoothstep(0.0, 0.1, cell) * (1.0 - smoothstep(0.6, 0.75, cell));
    float edge = pow(abs(vPos.x) / 0.7, 4.2) + pow(abs(vPos.y - 0.02) / 0.4, 4.2);
    float mask = 1.0 - smoothstep(0.45, 0.95, edge);
    gl_FragColor = vec4(uColour * line * dash * mask * uAmount, 1.0);
  }
`;

const RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform float uRadius;
  uniform float uFade;
  uniform float uQuad;
  uniform vec3 uColour;
  varying vec2 vUv;
  void main() {
    float d = length((vUv - 0.5) * uQuad) - uRadius;
    float core = exp(-pow(d / 0.03, 2.0));
    float soft = exp(-pow(d / 0.16, 2.0)) * 0.35;
    gl_FragColor = vec4(uColour * (core + soft) * uFade, 1.0);
  }
`;

function additive(uniforms: Record<string, IUniform>, vertexShader: string, fragmentShader: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export interface RobotThinking {
  /** `drama` 0..1 (hidden at 0) and the motion-scaled clock in seconds. */
  update(drama: number, t: number): void;
}

/** Adds the data lines and pulse rings to the robot's `head` group (freed with the rig). */
export function addRobotThinking(head: Object3D): RobotThinking {
  const cyan = new Color(PALETTE.workCyanEdge);
  const lines = additive({ uAmount: { value: 0 }, uTime: { value: 0 }, uColour: { value: cyan } }, VISOR_VERTEX, VISOR_FRAGMENT);
  const overlay = new Mesh(ellipsoidPatch(VISOR), lines);
  overlay.renderOrder = 1;
  overlay.visible = false;
  head.add(overlay);

  const ringGeometry = new PlaneGeometry(RING_QUAD, RING_QUAD);
  const rings = [0, 1].map(() => {
    const material = additive(
      { uRadius: { value: RING_START }, uFade: { value: 0 }, uQuad: { value: RING_QUAD }, uColour: { value: cyan.clone().lerp(new Color(PALETTE.workCyanCore), 0.35) } },
      RING_VERTEX,
      RING_FRAGMENT,
    );
    const mesh = new Mesh(ringGeometry, material);
    mesh.position.z = RING_DEPTH;
    mesh.renderOrder = 1;
    mesh.visible = false;
    head.add(mesh);
    return { mesh, material };
  });
  const pulse = { radius: 1, fade: 0 };

  return {
    update(drama, t) {
      const on = drama > 0.002;
      overlay.visible = on;
      for (const ring of rings) ring.mesh.visible = on;
      if (!on) return;
      lines.uniforms.uAmount.value = LINES_GLOW * drama;
      lines.uniforms.uTime.value = t;
      for (let i = 0; i < rings.length; i++) {
        // Each ring lives two pulse periods; staggered by one period, so one is born every pulse.
        ringPulse(cyclePhase(t + i * THINK_PULSE_SECONDS, THINK_PULSE_SECONDS * rings.length), pulse);
        rings[i].material.uniforms.uRadius.value = RING_START * pulse.radius;
        rings[i].material.uniforms.uFade.value = RING_GLOW * pulse.fade * drama;
      }
    },
  };
}
