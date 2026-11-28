/** Run: node --test --experimental-strip-types src/conversation/trail-words.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trailWords } from './trail-words.ts';

test('the memory trail says one thing and many things', () => {
  assert.equal(trailWords(1, 1, 0), '1 DKG query · 1 record · 0 written');
  assert.equal(trailWords(3, 42, 2), '3 DKG queries · 42 records · 2 written');
});
