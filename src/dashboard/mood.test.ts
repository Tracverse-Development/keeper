import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moodFor, phaseWords } from './mood.ts';

const base = { speaking: false, listening: false, phase: null, happyUntil: 0, now: 1000 };

test('mood priority', () => {
  assert.equal(moodFor(base), 'idle');
  assert.equal(moodFor({ ...base, phase: 'recalling' }), 'thinking');
  assert.equal(moodFor({ ...base, phase: 'done', happyUntil: 2000 }), 'happy');
  assert.equal(moodFor({ ...base, listening: true, phase: 'thinking' }), 'listening');
  assert.equal(moodFor({ ...base, speaking: true, listening: true }), 'speaking');
});

test('the recall phase names the graph', () => {
  assert.match(phaseWords('recalling', 'umoja-desk-abc'), /umoja-desk-abc/);
  assert.equal(phaseWords('done', 'x'), '');
});
