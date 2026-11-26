/**
 * The thinking aura: what the worn thinking effect (`moments.ts`) draws round the head while the
 * keeper thinks, beyond the shipped thinking look: two rings of light pulsing out (pulse), orbs
 * circling on three tilted orbits (orbit), a swirling cloud of stardust (nebula) and a vortex of
 * light spiralling up into the head from below (vortex).
 *
 * One `Points` draw for every layer, positions written each frame by closed-form motion into one
 * preallocated buffer (no allocation in the loop; `AURA_CAPACITY` points at most). Each point has
 * a fixed seed (its angle, radius, height and speed) chosen once. Colours change only when the
 * style or colour changes. At drama 0 the aura is hidden (no draw call), so a keeper that is not
 * thinking, or wears the classic effect, renders exactly as before.
 *
 * Pattern: a small Flyweight renderer (shared buffers, per-point seeds) driven by style data.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, type Vector3 } from 'three';
import { PALETTE } from '../palette';
import { cyclePhase, ringPulse, type RingPulse } from '../thinking';
import { createEffectMaterial } from './effect-material';
import { AURA_CAPACITY, scaled, type Moment, type ThinkStyle } from './moments';
import { AURA_SHAPE } from './particle-kinds';

/** The shipped thinking colours each layer uses when the worn effect keeps its default colour. */
const LAYER_COLOURS = {
  pulse: [PALETTE.workCyanEdge, PALETTE.workCyanCore],
  orbit: [PALETTE.workCyanCore, PALETTE.gold300],
  cloud: [PALETTE.workCyanEdge, PALETTE.gold400, PALETTE.cream50],
  funnel: [PALETTE.workCyanEdge, PALETTE.workCyanCore, PALETTE.gold300],
} as const;
type Layer = keyof typeof LAYER_COLOURS;

/** Seconds per pulse ring life, orbit speeds (rad/s), how far the cloud reaches, the vortex height. */
const PULSE_SECONDS = 1.6;
const ORBIT_SPEED = 1.7;
const CLOUD_INNER = 1.05;
const CLOUD_OUTER = 2.1;
const FUNNEL_DEPTH = 2.6;
const FUNNEL_TOP_RADIUS = 0.35;
const FUNNEL_WIDTH = 2.3;
/** The three orbit planes' tilts (radians about x, then z). */
const ORBIT_TILTS = [
  [1.15, 0.3],
  [1.45, -0.7],
  [0.9, 1.2],
] as const;

export interface ThinkingAura {
  readonly points: Points;
  /**
   * Draws `moment` round `head` (world space) at `drama` 0..1 (hidden at 0); `t` is the
   * motion-scaled clock, `amplitude` the reduced-motion dial.
   */
  update(moment: Moment<ThinkStyle>, drama: number, head: Readonly<Vector3>, t: number, amplitude: number): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

export function createThinkingAura(random: () => number = Math.random): ThinkingAura {
  const n = AURA_CAPACITY;
  const positions = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const brights = new Float32Array(n);
  const angles = new Float32Array(n);
  const colours = new Float32Array(n * 3);
  const seeds = Float32Array.from({ length: n * 4 }, () => random());
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aAngle', new BufferAttribute(angles, 1));
  geometry.setAttribute('aColour', new BufferAttribute(colours, 3));
  const material = createEffectMaterial(AURA_SHAPE, true);
  material.blending = AdditiveBlending;
  const points = new Points(geometry, material);
  points.name = 'thinking-aura';
  points.frustumCulled = false;
  points.renderOrder = 4;
  points.visible = false;
  const pulse: RingPulse = { radius: 1, fade: 0 };
  let colourKey = '';
  // Per-frame state, kept here so a frame allocates nothing.
  const counts: Record<Layer, number> = { pulse: 0, orbit: 0, cloud: 0, funnel: 0 };
  const frame = { i: 0, level: 0, x: 0, y: 0, z: 0 };

  /** Writes point `frame.i` at (x, y, z) from the head with `size` and `bright`, and moves on. */
  function put(x: number, y: number, z: number, size: number, bright: number): void {
    const i = frame.i++;
    positions[i * 3] = frame.x + x;
    positions[i * 3 + 1] = frame.y + y;
    positions[i * 3 + 2] = frame.z + z;
    sizes[i] = size;
    brights[i] = bright * frame.level;
    angles[i] = 0;
  }

  /** Writes layer colours for `moment` into the buffer (only when the style or colour changed). */
  function paint(moment: Moment<ThinkStyle>, counts: Record<Layer, number>): void {
    const key = `${moment.colour}|${counts.pulse}|${counts.orbit}|${counts.cloud}|${counts.funnel}`;
    if (key === colourKey) return;
    colourKey = key;
    let i = 0;
    for (const layer of Object.keys(LAYER_COLOURS) as Layer[]) {
      const palette = LAYER_COLOURS[layer];
      for (let k = 0; k < counts[layer]; k++, i++) {
        // Raw 0..1 channels, as the particle pools write them (the effect shader's convention).
        const seed = seeds[i * 4 + 3];
        const hex = moment.colour ?? palette[Math.floor(seed * palette.length) % palette.length];
        const light = moment.colour === null ? 0 : seed * 0.4;
        colours[i * 3] = channel(hex >> 16, light);
        colours[i * 3 + 1] = channel(hex >> 8, light);
        colours[i * 3 + 2] = channel(hex, light);
      }
    }
    geometry.getAttribute('aColour').needsUpdate = true;
  }

  return {
    points,
    update(moment, drama, head, t, amplitude) {
      const style = moment.style;
      const on = drama > 0.002 && style.pulse + style.orbit + style.cloud + style.funnel > 0;
      points.visible = on;
      if (!on) return;
      counts.pulse = scaled(style.pulse, moment.intensity) * 2;
      counts.orbit = scaled(style.orbit, moment.intensity);
      counts.cloud = scaled(style.cloud, moment.intensity);
      counts.funnel = scaled(style.funnel, moment.intensity);
      paint(moment, counts);
      frame.i = 0;
      frame.level = drama * (0.4 + 0.6 * amplitude) * Math.min(moment.intensity, 1.5);
      frame.x = head.x;
      frame.y = head.y;
      frame.z = head.z;

      // Pulse: two rings of points, one born each half life, growing out from the head and fading.
      const perRing = counts.pulse / 2;
      for (let ring = 0; ring < 2; ring++) {
        ringPulse(cyclePhase(t + ring * (PULSE_SECONDS / 2), PULSE_SECONDS), pulse);
        const radius = 1.1 * pulse.radius;
        for (let k = 0; k < perRing; k++) {
          const a = (k / perRing) * Math.PI * 2 + ring * 0.3;
          put(Math.cos(a) * radius, Math.sin(a) * radius * 0.92, -0.1, 0.1, 2.2 * pulse.fade);
        }
      }
      // Orbit: orbs spread over three tilted circles, each with a short faint tail behind it.
      for (let k = 0; k < counts.orbit; k++) {
        const plane = ORBIT_TILTS[k % 3];
        const a = t * ORBIT_SPEED * (1 + 0.15 * (k % 3)) + (k / counts.orbit) * Math.PI * 2;
        const r = style.orbitRadius * (1 + 0.04 * Math.sin(t * 2 + k));
        const x0 = Math.cos(a) * r;
        const y0 = 0;
        const z0 = Math.sin(a) * r;
        // Tilt about x, then about z.
        const y1 = y0 * Math.cos(plane[0]) - z0 * Math.sin(plane[0]);
        const z1 = y0 * Math.sin(plane[0]) + z0 * Math.cos(plane[0]);
        const x2 = x0 * Math.cos(plane[1]) - y1 * Math.sin(plane[1]);
        const y2 = x0 * Math.sin(plane[1]) + y1 * Math.cos(plane[1]);
        put(x2, y2, z1, 0.15 + 0.04 * Math.sin(t * 5 + k), 2.4);
      }
      // Nebula: stardust on slow spirals in a flattened shell round the head, twinkling.
      for (let k = 0; k < counts.cloud; k++) {
        const s = frame.i * 4;
        const r = CLOUD_INNER + (CLOUD_OUTER - CLOUD_INNER) * seeds[s];
        const a = seeds[s + 1] * Math.PI * 2 + t * (0.9 / r) * (seeds[s + 2] > 0.5 ? 1 : 0.8);
        const y = (seeds[s + 2] - 0.5) * 1.5 * (1.4 - r / CLOUD_OUTER);
        const twinkle = 0.55 + 0.45 * Math.sin(t * (2 + 3 * seeds[s + 3]) + k);
        put(Math.cos(a) * r, y + 0.1 * Math.sin(t + k), Math.sin(a) * r * 0.75, 0.05 + 0.09 * seeds[s + 3], 1.1 * twinkle);
      }
      // Vortex: points ride a spiral from wide and low up into the head, brightening as they arrive.
      for (let k = 0; k < counts.funnel; k++) {
        const s = frame.i * 4;
        const u = cyclePhase(t * (0.32 + 0.18 * seeds[s]) + seeds[s + 1], 1);
        const radius = FUNNEL_TOP_RADIUS + FUNNEL_WIDTH * (1 - u) ** 1.6;
        const a = seeds[s + 2] * Math.PI * 2 + u * Math.PI * 7;
        const y = -FUNNEL_DEPTH * (1 - u) ** 1.2 + 0.25;
        const fade = Math.min(u * 6, 1) * (1 - Math.max(u - 0.9, 0) * 10);
        put(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.8, 0.035 + 0.075 * u, (0.6 + 1.7 * u) * fade);
      }
      geometry.setDrawRange(0, frame.i);
      geometry.getAttribute('position').needsUpdate = true;
      geometry.getAttribute('aSize').needsUpdate = true;
      geometry.getAttribute('aBright').needsUpdate = true;
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      points.removeFromParent();
    },
  };
}

/** One 0..1 colour channel from the low byte of `bits`, lightened toward white by `light`. */
function channel(bits: number, light: number): number {
  const c = (bits & 255) / 255;
  return c + (1 - c) * light;
}
