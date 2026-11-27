/**
 * The thinking aura: what the worn thinking effect (`moments.ts`) draws round the head while the
 * keeper thinks, beyond the shipped thinking look: two rings of light pulsing out (pulse), orbs
 * circling on three tilted orbits (orbit), a swirling cloud of stardust (nebula), a vortex of
 * light spiralling up into the head from below (vortex), a comet looping the head on a long
 * tail (comet), a beacon turning over the head with two sweeping beams (beacon), a ring of sound
 * bars pulsing round the head (wave) and a compass rose whose needle swings and settles (compass).
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
import { AURA_CAPACITY, BAR_POINTS, COMPASS_POINTS, scaled, type Moment, type ThinkStyle } from './moments';
import { AURA_SHAPE } from './particle-kinds';

/** The shipped thinking colours each layer uses when the worn effect keeps its default colour. */
const LAYER_COLOURS = {
  pulse: [PALETTE.workCyanEdge, PALETTE.workCyanCore],
  orbit: [PALETTE.workCyanCore, PALETTE.gold300],
  cloud: [PALETTE.workCyanEdge, PALETTE.gold400, PALETTE.cream50],
  funnel: [PALETTE.workCyanEdge, PALETTE.workCyanCore, PALETTE.gold300],
  comet: [PALETTE.cream50, PALETTE.workCyanCore],
  beacon: [PALETTE.heatAmber, PALETTE.heatCore],
  bars: [PALETTE.workCyanEdge, PALETTE.gold300],
  compass: [PALETTE.gold300, PALETTE.cream50],
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
/** The comet: its loop radius, speed (rad/s), tilt, and how far back along the loop the tail reaches. */
const COMET_RADIUS = 1.55;
const COMET_SPEED = 2.1;
const COMET_TILT = 0.5;
const COMET_TAIL = 3.2;
/** The beacon: its height over the face, turning speed (rad/s) and how far each beam reaches. */
const BEACON_HEIGHT = 0.85;
const BEACON_SPEED = 3.2;
const BEACON_REACH = 2.6;
/** The sound bars: the circle they stand on (behind the head, facing out), the longest bar, the
 * spacing of a bar's points. */
const BAR_RING = 0.98;
const BAR_LENGTH = 0.6;
const BAR_BACK = -0.45;
/** The compass: where it hovers (up and to the side of the face), its radius, seconds per swing. */
const COMPASS_AT = [1.2, 0.62, 0.15] as const;
const COMPASS_RADIUS = 0.42;
const COMPASS_SWING = 4;
/** The compass rose's parts: ring points, points per cardinal and diagonal arm, needle points. */
const ROSE_RING = 24;
const ROSE_CARDINAL = 6;
const ROSE_DIAGONAL = 3;
const ROSE_NEEDLE = COMPASS_POINTS - ROSE_RING - 4 * ROSE_CARDINAL - 4 * ROSE_DIAGONAL;

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
  const counts: Record<Layer, number> = { pulse: 0, orbit: 0, cloud: 0, funnel: 0, comet: 0, beacon: 0, bars: 0, compass: 0 };
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
    const key = `${moment.colour}|${(Object.keys(counts) as Layer[]).map((l) => counts[l]).join('|')}`;
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

  /** Comet: a bright head on a tilted loop round the head, its tail thinning and fading behind it. */
  function drawComet(n: number, t: number): void {
    for (let k = 0; k < n; k++) {
      const back = k / Math.max(n - 1, 1);
      const a = t * COMET_SPEED - back * COMET_TAIL;
      const r = COMET_RADIUS * (1 + 0.06 * Math.sin(a * 2));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const head = k === 0 ? 1 : 0;
      put(x, z * Math.sin(COMET_TILT) + 0.15, z * Math.cos(COMET_TILT), 0.06 + 0.24 * (1 - back) ** 2 + 0.08 * head, (0.2 + 2 * (1 - back) ** 1.5) * (1 + 0.4 * head));
    }
  }

  /** Beacon: a pulsing lamp over the head and two opposite beams sweeping round, widening outward. */
  function drawBeacon(n: number, t: number): void {
    if (n === 0) return;
    put(0, BEACON_HEIGHT, -0.2, 0.34 + 0.06 * Math.sin(t * 9), 2.6);
    const perBeam = (n - 1) / 2;
    for (let beam = 0; beam < 2; beam++) {
      const a = t * BEACON_SPEED + beam * Math.PI;
      for (let k = 1; k <= perBeam; k++) {
        const d = (k / perBeam) * BEACON_REACH;
        // Seen from the front, the beam is brightest as it swings toward the viewer.
        const facing = 0.45 + 0.55 * Math.max(Math.sin(a), 0);
        put(Math.cos(a) * d, BEACON_HEIGHT - d * 0.12, Math.sin(a) * d - 0.2, 0.12 + 0.16 * d, 1.9 * facing * (1 - (d / BEACON_REACH) * 0.75));
      }
    }
  }

  /** Wave: a circle of sound bars behind the head, each standing out from it to its own beat,
   * like a music visualiser round the head. */
  function drawBars(bars: number, t: number): void {
    const step = BAR_LENGTH / (BAR_POINTS - 1);
    for (let b = 0; b < bars; b++) {
      const a = (b / bars) * Math.PI * 2 + t * 0.25;
      const beat = Math.abs(Math.sin(t * 5.5 + b * 0.9)) * (0.55 + 0.45 * Math.sin(t * 2.1 + b * 0.37));
      const length = 0.12 + (BAR_LENGTH - 0.12) * beat;
      for (let k = 0; k < BAR_POINTS; k++) {
        const d = BAR_RING + k * step;
        put(Math.cos(a) * d, Math.sin(a) * d, BAR_BACK, 0.22, k * step <= length ? 1.3 + 1.2 * (k * step) / BAR_LENGTH : 0);
      }
    }
  }

  /** Compass: a rose hovering beside the head (ring, four long points, four short) and a needle
   * that swings wide, then settles on north, every `COMPASS_SWING` seconds. */
  function drawCompass(t: number): void {
    const [x0, y0, z0] = COMPASS_AT;
    for (let k = 0; k < ROSE_RING; k++) {
      const a = (k / ROSE_RING) * Math.PI * 2;
      put(x0 + Math.cos(a) * COMPASS_RADIUS, y0 + Math.sin(a) * COMPASS_RADIUS, z0, 0.11, 1.4);
    }
    for (let arm = 0; arm < 8; arm++) {
      const long = arm % 2 === 0;
      const a = (arm / 8) * Math.PI * 2;
      const count = long ? ROSE_CARDINAL : ROSE_DIAGONAL;
      const reach = COMPASS_RADIUS * (long ? 1.35 : 0.75);
      for (let k = 1; k <= count; k++) {
        const d = (k / count) * reach;
        put(x0 + Math.sin(a) * d, y0 + Math.cos(a) * d, z0, long ? 0.15 - 0.07 * (k / count) : 0.08, long ? 1.6 : 1.1);
      }
    }
    const phase = cyclePhase(t, COMPASS_SWING);
    const needle = 1.6 * Math.exp(-3.2 * phase) * Math.cos(phase * 14);
    for (let k = 0; k < ROSE_NEEDLE; k++) {
      const d = ((k / (ROSE_NEEDLE - 1)) * 2 - 1) * COMPASS_RADIUS * 0.95;
      const north = d > 0;
      put(x0 + Math.sin(needle) * d, y0 + Math.cos(needle) * d, z0 + 0.05, north ? 0.16 : 0.11, north ? 2.8 : 1);
    }
  }

  return {
    points,
    update(moment, drama, head, t, amplitude) {
      const style = moment.style;
      counts.pulse = scaled(style.pulse, moment.intensity) * 2;
      counts.orbit = scaled(style.orbit, moment.intensity);
      counts.cloud = scaled(style.cloud, moment.intensity);
      counts.funnel = scaled(style.funnel, moment.intensity);
      counts.comet = scaled(style.comet, moment.intensity);
      counts.beacon = style.beacon > 0 ? scaled(style.beacon, moment.intensity) * 2 + 1 : 0;
      counts.bars = scaled(style.bars, moment.intensity) * BAR_POINTS;
      counts.compass = style.compass ? COMPASS_POINTS : 0;
      const on = drama > 0.002 && (Object.keys(counts) as Layer[]).some((l) => counts[l] > 0);
      points.visible = on;
      if (!on) return;
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
      drawComet(counts.comet, t);
      drawBeacon(counts.beacon, t);
      drawBars(counts.bars / BAR_POINTS, t);
      if (counts.compass) drawCompass(t);
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
