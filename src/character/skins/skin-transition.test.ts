/**
 * Tests for the skin swap timeline (pure).
 * Run: node --test --experimental-strip-types src/character/skins/skin-transition.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SWAP_SECONDS, swapPose } from './skin-transition.ts';

test('a swap starts with only the old skin and ends with only the new one', () => {
  assert.deepEqual(swapPose(0), { outgoing: 1, incoming: 0, done: false });
  assert.deepEqual(swapPose(SWAP_SECONDS), { outgoing: 0, incoming: 1, done: true });
  assert.deepEqual(swapPose(Number.NaN), { outgoing: 0, incoming: 1, done: true }, 'bad input finishes the swap');
});

test('mid-swap both skins are partly there, and nothing goes negative', () => {
  const mid = swapPose(SWAP_SECONDS * 0.4);
  assert.ok(mid.outgoing > 0 && mid.outgoing < 1);
  assert.ok(mid.incoming > 0 && mid.incoming < 1);
  for (let t = 0; t <= SWAP_SECONDS; t += 0.01) {
    const pose = swapPose(t);
    assert.ok(pose.outgoing >= 0 && pose.outgoing <= 1, `outgoing at ${t}`);
    assert.ok(pose.incoming >= 0 && pose.incoming < 1.1, `incoming at ${t}`);
  }
});
