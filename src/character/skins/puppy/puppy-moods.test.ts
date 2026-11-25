/**
 * Tests for the puppy's mood table and blend (pure).
 * Run: node --test --experimental-strip-types src/character/skins/puppy/puppy-moods.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Mood } from '../../contract.ts';
import { PUPPY_TABLE, blendPuppyDials, puppyDials } from './puppy-moods.ts';

const only = (mood: Mood): Record<Mood, number> => ({
  idle: 0,
  listening: 0,
  thinking: 0,
  speaking: 0,
  happy: 0,
  asleep: 0,
  [mood]: 1,
});

test('every mood has a row with the same finite dials', () => {
  const keys = Object.keys(PUPPY_TABLE.idle).sort();
  assert.deepEqual(Object.keys(PUPPY_TABLE).sort(), ['asleep', 'happy', 'idle', 'listening', 'speaking', 'thinking']);
  for (const row of Object.values(PUPPY_TABLE)) {
    assert.deepEqual(Object.keys(row).sort(), keys);
    for (const value of Object.values(row)) assert.ok(Number.isFinite(value));
  }
});

test('the moods read like a puppy', () => {
  const t = PUPPY_TABLE;
  assert.ok(t.listening.earPerk > t.idle.earPerk && t.listening.headTilt !== 0, 'listening: ears up, head tilt');
  assert.ok(t.thinking.earTwitch > 0, 'thinking: ear twitch');
  assert.ok(t.happy.tailWag > 2 * t.idle.tailWag && t.happy.tailSpeed > t.idle.tailSpeed, 'happy: tail wags hard');
  assert.ok(t.happy.tongue > 0 && t.speaking.tongue > 0, 'tongue shows when happy or speaking');
  assert.ok(t.asleep.curl === 1 && t.asleep.tailWag === 0 && t.asleep.earPerk < 0, 'asleep: curled, still, ears down');
});

test('one-hot weights give the row; a mix lands in between', () => {
  assert.deepEqual(blendPuppyDials(only('happy'), puppyDials()), PUPPY_TABLE.happy);
  const half = blendPuppyDials({ ...only('idle'), happy: 1 }, puppyDials());
  assert.ok(Math.abs(half.tailWag - (PUPPY_TABLE.idle.tailWag + PUPPY_TABLE.happy.tailWag) / 2) < 1e-9);
});

test('zero or broken weights fall back to idle', () => {
  const zero = { idle: 0, listening: 0, thinking: 0, speaking: 0, happy: 0, asleep: 0 };
  assert.deepEqual(blendPuppyDials(zero, puppyDials()), PUPPY_TABLE.idle);
  assert.deepEqual(blendPuppyDials({ ...zero, asleep: -3 }, puppyDials()), PUPPY_TABLE.idle);
});
