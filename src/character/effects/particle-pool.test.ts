/**
 * Tests for the pure particle pool and its motion maths.
 * Run: node --test --experimental-strip-types src/character/effects/particle-pool.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EFFECT_KINDS, SHAPES } from './particle-kinds.ts';
import { ParticlePool, coneDirection, lifeFade, travel } from './particle-pool.ts';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const ORIGIN = { x: 0, y: 1, z: 0 };

test('travel under drag approaches v/drag and equals t without drag', () => {
  assert.equal(travel(0, 2), 2);
  assert.equal(travel(3, 0), 0);
  assert.ok(Math.abs(travel(2, 50) - 0.5) < 1e-9);
  assert.ok(travel(2, 0.5) < 0.5);
});

test('lifeFade rises fast, falls to 0, and is 0 outside the life', () => {
  assert.equal(lifeFade(0), 0);
  assert.equal(lifeFade(1), 0);
  assert.equal(lifeFade(-1), 0);
  assert.ok(lifeFade(0.08) > 0.85);
  assert.ok(lifeFade(0.5) > lifeFade(0.9));
});

test('cone directions are unit length and stay inside the cone', () => {
  const out = new Float32Array(3);
  for (const r1 of [0, 0.3, 1]) {
    for (const r2 of [0, 0.25, 0.7]) {
      coneDirection([0, 1, 0], 0.5, r1, r2, out, 0);
      assert.ok(Math.abs(Math.hypot(out[0], out[1], out[2]) - 1) < 1e-5);
      assert.ok(out[1] >= Math.cos(0.5) - 1e-5);
    }
  }
  coneDirection([0, 0, 2], 0, 0.5, 0.5, out, 0);
  assert.deepEqual([...out].map((v) => Math.round(v * 1e5) / 1e5), [0, 0, 1]);
});

test('a burst rises, fades and frees the pool', () => {
  const pool = new ParticlePool(EFFECT_KINDS.sparkle);
  const random = seq([0.5, 0.2, 0.8, 0.1, 0.6, 0.4, 0.9, 0.3]);
  for (let k = 0; k < 5; k++) pool.spawn(ORIGIN, 10, random);
  assert.ok(pool.busy(10));
  assert.equal(pool.update(10.2), 5);
  const y = pool.positions[1];
  assert.ok(y > ORIGIN.y, `rose to ${y}`);
  assert.ok(pool.brights[0] > 0);
  assert.equal(pool.update(10 + EFFECT_KINDS.sparkle.life[1] + 0.01), 0);
  assert.equal(pool.brights[0], 0);
  assert.ok(!pool.busy(12));
});

test('a delayed particle stays hidden until it is born', () => {
  const pool = new ParticlePool(EFFECT_KINDS.heart);
  pool.spawn(ORIGIN, 0, () => 0.5, 0.4);
  assert.equal(pool.update(0.2), 0);
  assert.equal(pool.update(0.6), 1);
});

test('a full pool recycles the oldest slot and never grows', () => {
  const pool = new ParticlePool(EFFECT_KINDS.zzz);
  const slots = Array.from({ length: pool.capacity + 2 }, () => pool.spawn(ORIGIN, 0, () => 0.5));
  assert.deepEqual(slots.slice(-2), [0, 1]);
  assert.equal(pool.update(0.5), pool.capacity);
  assert.equal(pool.positions.length, pool.capacity * 3);
});

test('colours come from the kind list (brand palette) as 0..1 rgb', () => {
  const pool = new ParticlePool(EFFECT_KINDS.confetti);
  pool.spawn(ORIGIN, 0, () => 0);
  const hex = EFFECT_KINDS.confetti.colours[0];
  assert.ok(Math.abs(pool.colours[0] - ((hex >> 16) & 255) / 255) < 1e-6);
});

test('every kind has a distinct shape and a sane spec', () => {
  assert.equal(new Set(Object.values(SHAPES)).size, Object.keys(EFFECT_KINDS).length);
  for (const [kind, spec] of Object.entries(EFFECT_KINDS)) {
    assert.ok(spec.capacity > 0 && spec.capacity <= 128, kind);
    assert.ok(spec.life[0] > 0 && spec.life[0] <= spec.life[1], kind);
    assert.ok(spec.colours.length > 0, kind);
  }
});

test('a "z" is born upright (its angle range), not at a random turn', () => {
  const pool = new ParticlePool(EFFECT_KINDS.zzz);
  pool.spawn(ORIGIN, 0, () => 0.99);
  pool.update(0.01);
  assert.ok(Math.abs(pool.angles[0]) < 0.2, `angle ${pool.angles[0]}`);
});
