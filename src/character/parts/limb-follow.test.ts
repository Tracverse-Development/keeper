import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alongLimb, elbowWeight } from './limb-follow.ts';

test('the forearm weight is 0 above the elbow, 1 below it, smooth and monotonic across it', () => {
  assert.ok(Math.abs(elbowWeight(0, 0.3, 0.1) - 0) < 1e-9);
  assert.ok(Math.abs(elbowWeight(0.2, 0.3, 0.1) - 0) < 1e-9);
  assert.ok(Math.abs(elbowWeight(0.3, 0.3, 0.1) - 0.5) < 1e-9);
  assert.ok(Math.abs(elbowWeight(0.4, 0.3, 0.1) - 1) < 1e-9);
  assert.ok(Math.abs(elbowWeight(0.9, 0.3, 0.1) - 1) < 1e-9);
  let last = 0;
  for (let a = 0.2; a <= 0.4; a += 0.01) {
    const w = elbowWeight(a, 0.3, 0.1);
    assert.ok(w >= last - 1e-12);
    last = w;
  }
});

test('distance down a limb follows its tilt', () => {
  const limb = { position: [0.4, -0.15, 0] as const, radius: 0.1, length: 0.5, tilt: 0 };
  assert.ok(Math.abs(alongLimb(limb, [0.4, -0.45, 0]) - 0.3) < 1e-12);
  const tilted = { ...limb, tilt: Math.PI / 2 };
  assert.ok(Math.abs(alongLimb(tilted, [0.4, -0.15, -0.3]) - 0.3) < 1e-12);
});
