import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handOf, reachArm, type Vec3 } from './arm-reach.ts';

const UPPER = 0.29;
const LOWER = 0.37;
const POLE: Vec3 = [-0.5, -1, -0.4];
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('a reachable target is reached exactly', () => {
  for (const target of [
    [0.3, 0.2, 0.4],
    [0.1, -0.3, 0.45],
    [0.2, 0.35, 0.25],
    [-0.1, -0.5, 0.2],
  ] as Vec3[]) {
    const r = reachArm(target, UPPER, LOWER, POLE);
    assert.equal(r.miss, 0);
    assert.ok(distance(handOf(r, UPPER, LOWER), target) < 1e-6, `reached ${target}`);
  }
});

test('the elbow bends forward (never backward) and the shoulder turn is a unit quaternion', () => {
  const r = reachArm([0.25, 0.1, 0.4], UPPER, LOWER, POLE);
  assert.ok(r.elbow < 0);
  assert.ok(Math.abs(Math.hypot(...r.shoulder) - 1) < 1e-9);
});

test('a target out of reach is approached along its own line, never stretched past', () => {
  const target: Vec3 = [0.4, 1.2, 0.6];
  const r = reachArm(target, UPPER, LOWER, POLE);
  const hand = handOf(r, UPPER, LOWER);
  assert.ok(r.miss > 0);
  assert.ok(Math.hypot(...hand) <= UPPER + LOWER + 1e-9);
  const along = (hand[0] * target[0] + hand[1] * target[1] + hand[2] * target[2]) / (Math.hypot(...hand) * Math.hypot(...target));
  assert.ok(along > 0.9999, 'hand on the line to the target');
});

test('the elbow points toward the pole', () => {
  const r = reachArm([0.1, 0.1, 0.5], UPPER, LOWER, [0, -1, 0]);
  // The elbow is the hand of a zero-length forearm: below the line from shoulder to hand.
  const elbow = handOf({ shoulder: r.shoulder, elbow: 0 }, UPPER, 0);
  assert.ok(elbow[1] < 0.1 * (UPPER / Math.hypot(0.1, 0.1, 0.5)));
});

test('the rest pose (hand straight down) needs almost no bend', () => {
  const r = reachArm([0, -(UPPER + LOWER) * 0.999, 0.01], UPPER, LOWER, POLE);
  assert.ok(Math.abs(r.elbow) < 0.2);
});
