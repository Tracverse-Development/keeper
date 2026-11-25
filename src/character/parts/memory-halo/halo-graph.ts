/**
 * The memory halo's graph: the keeper's knowledge graph drawn as a slow orbit of tiny gold
 * nodes, neighbours joined by faint edges, inside two hair-thin orbit rings. The tilt and
 * height come from the slot it is worn in (the species' halo anchor), not from here.
 *
 * It orbits faster while thinking, swells and brightens with the voice while listening
 * and dims when asleep (the part passes eased values to `update`). While the keeper works
 * (`flow` 0..1) the nodes twinkle harder and the edges flicker like data flowing. New memories
 * arrive through `reserveNode` + `revealNode`: the spark (memory-spark.ts) reserves a
 * slot, flies to its world position and reveals it on arrival, when the node flashes
 * and joins the graph. Once the capacity is full the oldest learned node is recycled.
 * While the keeper thinks (`think` 0..1) waves of light travel around the nodes and sparks
 * stream from them into the head (`halo-stream.ts`); `gotIt` flashes every node at once.
 *
 * Node positions are recomputed on the CPU each frame (a gentle per-node wobble and the
 * voice swell): a few hundred points is cheaper than a second shader path.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  TorusGeometry,
  Vector3,
} from 'three';
import { disposeTree } from '../../dispose-tree';
import { PALETTE } from '../../palette';
import { createGlowPointsMaterial } from '../../stage/glow-points-material';
import type { SparkTarget } from '../part';
import { nodeWave } from '../../thinking';
import { tintColour } from '../tint';
import { addHaloStream } from './halo-stream';

const CAPACITY = 240;
const ORBIT_RADIUS = 2.05;
const EDGE_REACH = 0.62;
const EDGES_PER_NODE = 2;
const FLASH_SECONDS = 1.6;

export interface HaloFrame {
  dt: number;
  time: number;
  /** Orbit speed in rad/s, already eased. */
  speed: number;
  /** Brightness multiplier. */
  glow: number;
  /** Radius multiplier (mood scale and voice swell combined). */
  scale: number;
  /** Amplitude multiplier for wobble (reduced motion). */
  amplitude: number;
  /** Work 0..1: harder twinkle and flickering edges ("data flowing"); 0 changes nothing. */
  flow: number;
  /** Thinking drama 0..1: travelling node waves and sparks streaming into `head`; 0 changes nothing. */
  think: number;
  /** The "got it" flash 0..1: every node lights up at once; 0 changes nothing. */
  gotIt: number;
  /** The head's centre in world space (where the thinking sparks stream to). */
  head: Readonly<Vector3>;
  /** Speed multiplier for the thinking waves and stream (reduced motion: slower). */
  pace: number;
}

export interface HaloOptions {
  /** The chosen colour (0xrrggbb); gold500 is the shipped look. */
  colour: number;
  /** How many nodes the graph starts with. */
  seedNodes: number;
}

/** Spark target: reserve a slot, follow it as it orbits, reveal it when the spark lands. */
export interface Halo extends SparkTarget {
  readonly group: Group;
  setPointScale(scale: number): void;
  update(frame: HaloFrame): void;
  dispose(): void;
}

interface NodeSeed {
  angle: number;
  radius: number;
  height: number;
  phase: number;
  base: number;
}

const TWINKLE = 0.3;
/** Thinking: how bright a node gets on a passing wave, the wave speed (rad/s), the "got it" flash. */
const WAVE_BRIGHT = 3.2;
const WAVE_SPEED = 3.4;
const GOT_IT_BRIGHT = 3;

export function createHaloGraph(options: HaloOptions, random: () => number = Math.random): Halo {
  const seedNodes = Math.min(Math.max(Math.round(options.seedNodes), 1), CAPACITY);
  const group = new Group();
  group.name = 'memory-halo';
  const orbit = new Group();
  group.add(orbit);

  const seeds: NodeSeed[] = [];
  const bornAt = new Float32Array(CAPACITY).fill(-100);
  const positions = new Float32Array(CAPACITY * 3);
  const sizes = new Float32Array(CAPACITY);
  const brights = new Float32Array(CAPACITY);
  const phases = new Float32Array(CAPACITY);

  const makeSeed = (): NodeSeed => {
    const ring = random() < 0.7 ? 0 : (random() - 0.5) * 0.5;
    return {
      angle: random() * Math.PI * 2,
      radius: ORBIT_RADIUS * (1 + ring + (random() - 0.5) * 0.14),
      height: (random() - 0.5) * 0.32,
      phase: random(),
      base: 0.55 + random() * 0.75,
    };
  };

  for (let i = 0; i < seedNodes; i++) {
    seeds.push(makeSeed());
    sizes[i] = 0.035 + random() * 0.035;
    brights[i] = seeds[i].base;
    phases[i] = seeds[i].phase;
  }
  let used = seedNodes;
  let recycleCursor = seedNodes;

  const pointsGeometry = new BufferGeometry();
  pointsGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  pointsGeometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  pointsGeometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  pointsGeometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const pointsMaterial = createGlowPointsMaterial(TWINKLE);
  pointsMaterial.uniforms.uWarm.value.copy(tintColour(PALETTE.gold500, options.colour));
  const points = new Points(pointsGeometry, pointsMaterial);
  points.frustumCulled = false;
  orbit.add(points);
  const stream = addHaloStream(orbit, pointsMaterial.uniforms.uWarm.value);

  const edgeCapacity = CAPACITY * EDGES_PER_NODE;
  let edges: [number, number][] = [];
  const edgePositions = new Float32Array(edgeCapacity * 6);
  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute('position', new BufferAttribute(edgePositions, 3));
  const edgeColour = tintColour(PALETTE.gold400, options.colour).multiplyScalar(0.55);
  const edgeMaterial = new LineBasicMaterial({
    color: edgeColour,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const edgeLines = new LineSegments(edgeGeometry, edgeMaterial);
  edgeLines.frustumCulled = false;
  orbit.add(edgeLines);

  const ringMaterial = new MeshBasicMaterial({
    color: tintColour(PALETTE.gold500, options.colour).multiplyScalar(0.7),
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const rings = [ORBIT_RADIUS * 0.985, ORBIT_RADIUS * 1.12].map((radius, i) => {
    const ring = new Mesh(new TorusGeometry(radius, 0.0045, 8, 256), ringMaterial);
    ring.rotation.x = Math.PI / 2 + (i === 0 ? 0 : 0.06);
    group.add(ring);
    return ring;
  });

  /** Recomputes the edge list: each node to its nearest neighbours within reach. */
  const rebuildEdges = (): void => {
    const next: [number, number][] = [];
    const seen = new Set<number>();
    for (let a = 0; a < used; a++) {
      if (brights[a] <= 0) continue;
      const near: { b: number; d: number }[] = [];
      for (let b = 0; b < used; b++) {
        if (b === a || brights[b] <= 0) continue;
        const d = restDistance(seeds[a], seeds[b]);
        if (d < EDGE_REACH) near.push({ b, d });
      }
      near.sort((x, y) => x.d - y.d);
      for (const { b } of near.slice(0, EDGES_PER_NODE)) {
        const key = Math.min(a, b) * CAPACITY + Math.max(a, b);
        if (seen.has(key) || next.length >= edgeCapacity) continue;
        seen.add(key);
        next.push([a, b]);
      }
    }
    edges = next;
    edgeGeometry.setDrawRange(0, edges.length * 2);
  };
  rebuildEdges();

  const local = new Vector3();
  let swell = 1;

  function writeNode(i: number, time: number, amplitude: number): void {
    const s = seeds[i];
    const wobble = Math.sin(time * 0.6 + s.phase * 6.283) * 0.04 * amplitude;
    const r = s.radius * swell + wobble;
    positions[i * 3] = Math.cos(s.angle) * r;
    positions[i * 3 + 1] = s.height + Math.cos(time * 0.45 + s.phase * 9.1) * 0.03 * amplitude;
    positions[i * 3 + 2] = Math.sin(s.angle) * r;
  }

  function update(frame: HaloFrame): void {
    swell = frame.scale;
    orbit.rotation.y += frame.speed * frame.dt;
    for (const ring of rings) ring.scale.setScalar(frame.scale);
    ringMaterial.opacity = 0.32 * Math.min(frame.glow, 1.6);
    // Data flowing: two beating sines make the edges flicker unevenly (0 at rest).
    const flicker = 0.5 + 0.5 * Math.sin(frame.time * 29) * Math.sin(frame.time * 7.3 + 1.1);
    edgeMaterial.opacity = 0.5 * Math.min(frame.glow, 1.8) * (1 + frame.flow * (0.3 + 1.1 * flicker));
    pointsMaterial.uniforms.uTwinkle.value = TWINKLE + 0.55 * frame.flow;
    pointsMaterial.uniforms.uTime.value = frame.time;
    pointsMaterial.uniforms.uGlow.value = 1.6 * frame.glow;

    for (let i = 0; i < used; i++) {
      writeNode(i, frame.time, frame.amplitude);
      if (brights[i] > 0) {
        const sinceBirth = frame.time - bornAt[i];
        const flash = sinceBirth < FLASH_SECONDS ? (1 - sinceBirth / FLASH_SECONDS) ** 2 * 5 : 0;
        brights[i] = seeds[i].base + flash;
        if (frame.think > 0) brights[i] += frame.think * WAVE_BRIGHT * nodeWave(seeds[i].angle, frame.time * frame.pace, WAVE_SPEED);
        if (frame.gotIt > 0) brights[i] += frame.gotIt * GOT_IT_BRIGHT;
      }
    }
    stream.update(frame.think, frame.time * frame.pace, positions, used, frame.head);
    for (let e = 0; e < edges.length; e++) {
      const [a, b] = edges[e];
      edgePositions.set(positions.subarray(a * 3, a * 3 + 3), e * 6);
      edgePositions.set(positions.subarray(b * 3, b * 3 + 3), e * 6 + 3);
    }
    pointsGeometry.setDrawRange(0, used);
    markDirty(pointsGeometry, 'position', 'aBright', 'aSize');
    markDirty(edgeGeometry, 'position');
  }

  return {
    group,
    reserveNode() {
      let index: number;
      if (used < CAPACITY) {
        index = used++;
        seeds.push(makeSeed());
      } else {
        index = recycleCursor;
        recycleCursor = recycleCursor + 1 >= CAPACITY ? seedNodes : recycleCursor + 1;
        seeds[index] = makeSeed();
      }
      sizes[index] = 0.05 + random() * 0.03;
      brights[index] = 0;
      phases[index] = seeds[index].phase;
      rebuildEdges();
      return index;
    },
    nodeWorldPosition(index, out) {
      local.fromArray(positions, index * 3);
      return orbit.localToWorld(out.copy(local));
    },
    revealNode(index, time) {
      bornAt[index] = time;
      brights[index] = seeds[index].base;
      rebuildEdges();
    },
    setPointScale(scale) {
      pointsMaterial.uniforms.uScale.value = scale;
      stream.setPointScale(scale);
    },
    update,
    dispose: () => disposeTree(group),
  };
}

/** Distance between two nodes at rest (no wobble), used to pick graph neighbours. */
function restDistance(a: NodeSeed, b: NodeSeed): number {
  const dx = Math.cos(a.angle) * a.radius - Math.cos(b.angle) * b.radius;
  const dz = Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius;
  const dy = a.height - b.height;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function markDirty(geometry: BufferGeometry, ...names: string[]): void {
  for (const name of names) geometry.getAttribute(name).needsUpdate = true;
}
