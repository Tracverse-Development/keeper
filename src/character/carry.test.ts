import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addCarry, easeCarry, readCarry, restingCarry } from './carry.ts';
import { restingExpression } from './expression-frame.ts';

test('carry: nothing carried leaves the frame exactly as it was', () => {
  assert.deepEqual(addCarry(restingExpression(), restingCarry()), restingExpression());
});

test('carry: picked up it lifts, stretches, looks surprised and trails the hand', () => {
  const right = addCarry(restingExpression(), { x: 0.5, y: 0.2, held: 1 });
  assert.ok(right.lift > 0.2 && right.squash > 0 && right.wide > 0.5 && right.mouthO > 0);
  assert.ok(right.roll < 0 && right.swing > 0, 'pulled right, the body trails left');
  const left = addCarry(restingExpression(), { x: -0.5, y: 0, held: 1 });
  assert.ok(left.roll > 0 && left.swing < 0);
});

test('carry: it follows the hand, and settles back to rest when let go', () => {
  const carry = restingCarry();
  for (let i = 0; i < 60; i++) easeCarry(carry, { x: 0.6, y: -0.3 }, 1 / 60);
  assert.ok(Math.abs(carry.x - 0.6) < 0.01 && Math.abs(carry.y + 0.3) < 0.01 && carry.held > 0.99);
  for (let i = 0; i < 240; i++) easeCarry(carry, null, 1 / 60);
  assert.deepEqual(carry, restingCarry(), 'exactly at rest again');
});

test('carry: outside values are clamped, and anything else means not carried', () => {
  assert.deepEqual(readCarry({ x: 9, y: Number.NaN }), { x: 1, y: 0 });
  assert.equal(readCarry(null), null);
  assert.equal(readCarry('up'), null);
});
