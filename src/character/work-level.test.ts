/**
 * Tests for the work dial helpers: clamping, easing, ramps, thinking boost, eye tint (pure).
 * Run: node --test --experimental-strip-types src/character/work-level.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { band, clampWork, easeWork, effectiveWork, mix, workTint } from './work-level.ts';

test('clampWork keeps 0..1 and turns junk into 0', () => {
  assert.equal(clampWork(0.4), 0.4);
  assert.equal(clampWork(3), 1);
  assert.equal(clampWork(-1), 0);
  assert.equal(clampWork(Number.NaN), 0);
  assert.equal(clampWork(Infinity), 0);
});

test('easeWork glides without overshoot and is frame-rate independent', () => {
  let a = 0;
  for (let i = 0; i < 60; i++) a = easeWork(a, 1, 1 / 60);
  let b = 0;
  for (let i = 0; i < 30; i++) b = easeWork(b, 1, 1 / 30);
  assert.ok(Math.abs(a - b) < 1e-9, 'same after one second at 60 and 30 fps');
  assert.ok(a > 0.85 && a < 1, `rises most of the way in a second (${a})`);
  let down = 1;
  for (let i = 0; i < 60; i++) down = easeWork(down, 0, 1 / 60);
  assert.ok(1 - down < a, 'cools more slowly than it heats');
  assert.equal(easeWork(0.3, 1, 0), 0.3, 'no time, no change');
  assert.equal(easeWork(0, 0, 1 / 60), 0, 'idle stays exactly 0');
});

test('band ramps smoothly between its edges and is exactly 0 at rest', () => {
  assert.equal(band(0, 0.3, 1), 0);
  assert.equal(band(0.3, 0.3, 1), 0);
  assert.equal(band(1, 0.3, 1), 1);
  assert.ok(Math.abs(band(0.65, 0.3, 1) - 0.5) < 1e-12);
  let last = 0;
  for (let w = 0; w <= 1; w += 0.05) {
    const v = band(w, 0.2, 0.8);
    assert.ok(v >= last - 1e-12 && v >= 0 && v <= 1);
    last = v;
  }
});

test('thinking amplifies work but never past 1, and never creates work from nothing', () => {
  assert.equal(effectiveWork(0, 1, 0.35), 0);
  assert.equal(effectiveWork(0.5, 0, 0.35), 0.5);
  assert.ok(Math.abs(effectiveWork(0.5, 1, 0.35) - 0.675) < 1e-12);
  assert.equal(effectiveWork(0.9, 1, 0.35), 1);
});

test('workTint: cool first, then hot; nothing at rest', () => {
  const ranges = { coolFrom: 0.04, coolTo: 0.45, hotFrom: 0.62, hotTo: 1 };
  const t = { cool: -1, hot: -1 };
  assert.deepEqual(workTint(0, ranges, t), { cool: 0, hot: 0 });
  assert.deepEqual(workTint(0.5, ranges, t), { cool: 1, hot: 0 });
  assert.deepEqual(workTint(1, ranges, t), { cool: 1, hot: 1 });
  assert.equal(mix(2, 4, 0.5), 3);
});
