/**
 * The effect layer: one pooled `Points` draw per effect kind (sparkles, hearts, puffs, data
 * motes, confetti, "z"s), living in world space beside the character.
 *
 * `burst` throws a handful at once, `emit` streams them at a rate (fractional particles carry
 * over between frames, so a rate of 3/s at 60 fps still releases exactly 3 a second) and
 * `update` moves every live pool. A kind with nothing alive is hidden (no draw call) and its
 * buffers are not uploaded. Nothing allocates after creation.
 *
 * Pattern: Facade over the pools (`particle-pool.ts`) and their GPU buffers.
 */
import { BufferAttribute, BufferGeometry, Group, Points } from 'three';
import { disposeTree } from '../dispose-tree';
import { createEffectMaterial, type EffectMaterial } from './effect-material';
import { EFFECT_KINDS, SHAPES, type EffectKind } from './particle-kinds';
import { ParticlePool, type Point3 } from './particle-pool';

/** The attributes that change every frame a kind is alive (colours change only at birth). */
const MOVING_ATTRIBUTES = ['position', 'aSize', 'aBright', 'aAngle'] as const;

interface Channel {
  pool: ParticlePool;
  points: Points;
  material: EffectMaterial;
  geometry: BufferGeometry;
  /** Particles owed by `emit` that have not been whole yet. */
  carry: number;
  /** Colours changed since the last upload. */
  dirtyColours: boolean;
}

export interface EffectLayer {
  readonly group: Group;
  /** Throws `count` particles of `kind` from `at` (world space), staggered by `stagger` s each. */
  burst(kind: EffectKind, at: Point3, time: number, count: number, stagger?: number): void;
  /** Streams `kind` from `at` at `rate` particles per second over this frame's `dt`. */
  emit(kind: EffectKind, at: Point3, time: number, rate: number, dt: number): void;
  update(time: number): void;
  setPointScale(scale: number): void;
  dispose(): void;
}

export function createEffectLayer(random: () => number = Math.random): EffectLayer {
  const group = new Group();
  group.name = 'effects';
  const channels = {} as Record<EffectKind, Channel>;
  for (const kind of Object.keys(EFFECT_KINDS) as EffectKind[]) {
    const spec = EFFECT_KINDS[kind];
    const pool = new ParticlePool(spec);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(pool.positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(pool.sizes, 1));
    geometry.setAttribute('aBright', new BufferAttribute(pool.brights, 1));
    geometry.setAttribute('aAngle', new BufferAttribute(pool.angles, 1));
    geometry.setAttribute('aColour', new BufferAttribute(pool.colours, 3));
    const material = createEffectMaterial(SHAPES[kind], spec.additive);
    const points = new Points(geometry, material);
    points.name = `effect-${kind}`;
    points.frustumCulled = false;
    points.renderOrder = 4;
    points.visible = false;
    group.add(points);
    channels[kind] = { pool, points, material, geometry, carry: 0, dirtyColours: false };
  }
  const list = Object.values(channels);

  function burst(kind: EffectKind, at: Point3, time: number, count: number, stagger = 0): void {
    const channel = channels[kind];
    for (let k = 0; k < count; k++) channel.pool.spawn(at, time, random, k * stagger);
    if (count > 0) channel.dirtyColours = true;
  }

  return {
    group,
    burst,
    emit(kind, at, time, rate, dt) {
      const channel = channels[kind];
      if (!(rate > 0) || !(dt > 0)) return;
      channel.carry += rate * dt;
      const whole = Math.floor(channel.carry);
      channel.carry -= whole;
      burst(kind, at, time, whole);
    },
    update(time) {
      for (const channel of list) {
        if (!channel.pool.busy(time) && !channel.points.visible) continue;
        const live = channel.pool.update(time);
        channel.points.visible = live > 0;
        const g = channel.geometry;
        for (const name of MOVING_ATTRIBUTES) g.getAttribute(name).needsUpdate = true;
        if (channel.dirtyColours) g.getAttribute('aColour').needsUpdate = true;
        channel.dirtyColours = false;
      }
    },
    setPointScale(scale) {
      for (const channel of list) channel.material.uniforms.uScale.value = scale;
    },
    dispose: () => disposeTree(group),
  };
}
