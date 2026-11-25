/**
 * Memory sparks: what the person sees when something is written to the DKG.
 *
 * `launch` reserves a new node in the halo and sends a bright spark with a fading
 * comet trail from the chest heart-light, up along an arc (a quadratic Bezier toward
 * the camera) to that node. The target is re-read every frame because the halo keeps
 * orbiting; on arrival the halo reveals the node, which flashes and links into the graph.
 *
 * Points are kept in world space (the group sits at the scene origin, unrotated).
 */
import { BufferAttribute, BufferGeometry, Group, Points, Vector3 } from 'three';
import { disposeTree } from '../dispose-tree';
import { createGlowPointsMaterial } from './glow-points-material';
import type { Halo } from './halo';

const MAX_SPARKS = 8;
const TRAIL = 18;
const TRAIL_SPACING = 0.022;
const FLIGHT_SECONDS = 1.25;

interface Spark {
  node: number;
  startedAt: number;
  origin: Vector3;
}

export interface MemorySparks {
  readonly group: Group;
  /** Sends one spark from `origin` (world space) into a new halo node. */
  launch(origin: Vector3, time: number): void;
  setPointScale(scale: number): void;
  update(time: number, glow: number): void;
  dispose(): void;
}

export function createMemorySparks(halo: Halo): MemorySparks {
  const group = new Group();
  group.name = 'memory-sparks';
  const count = MAX_SPARKS * TRAIL;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brights = new Float32Array(count);
  const phases = new Float32Array(count);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aBright', new BufferAttribute(brights, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = createGlowPointsMaterial(0);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  let sparks: Spark[] = [];
  const target = new Vector3();
  const control = new Vector3();
  const point = new Vector3();

  function bezier(origin: Vector3, t: number, out: Vector3): Vector3 {
    const u = 1 - t;
    return out
      .copy(origin)
      .multiplyScalar(u * u)
      .addScaledVector(control, 2 * u * t)
      .addScaledVector(target, t * t);
  }

  function update(time: number, glow: number): void {
    brights.fill(0);
    const arrived: Spark[] = [];
    sparks.forEach((spark, s) => {
      const progress = (time - spark.startedAt) / FLIGHT_SECONDS;
      if (progress >= 1) {
        arrived.push(spark);
        return;
      }
      halo.nodeWorldPosition(spark.node, target);
      control.copy(spark.origin).lerp(target, 0.5).add(point.set(0, 1.1, 0.9));
      for (let k = 0; k < TRAIL; k++) {
        const t = easeOutCubic(Math.max(progress - k * TRAIL_SPACING, 0));
        const i = s * TRAIL + k;
        bezier(spark.origin, t, point).toArray(positions, i * 3);
        const fade = 1 - k / TRAIL;
        sizes[i] = (k === 0 ? 0.14 : 0.075) * fade + 0.02;
        brights[i] = (k === 0 ? 4 : 2.2) * fade * fade;
      }
    });
    for (const spark of arrived) halo.revealNode(spark.node, time);
    if (arrived.length) sparks = sparks.filter((spark) => !arrived.includes(spark));
    material.uniforms.uGlow.value = Math.max(glow, 0.6);
    for (const name of ['position', 'aSize', 'aBright']) geometry.getAttribute(name).needsUpdate = true;
  }

  return {
    group,
    launch(origin, time) {
      if (sparks.length >= MAX_SPARKS) {
        const oldest = sparks.shift();
        if (oldest) halo.revealNode(oldest.node, time);
      }
      sparks.push({ node: halo.reserveNode(), startedAt: time, origin: origin.clone() });
    },
    setPointScale(scale) {
      material.uniforms.uScale.value = scale;
    },
    update,
    dispose: () => disposeTree(group),
  };
}

function easeOutCubic(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - x) ** 3;
}
