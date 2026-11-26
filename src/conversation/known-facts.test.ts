import assert from 'node:assert/strict';
import { test } from 'node:test';

import { knownLine, stillKnown } from './known-facts.ts';

const fact = (id: string) => ({ id, text: `fact ${id}`, category: 'general', at: '2026-11-26T00:00:00Z' });

test('known facts: a forgotten fact leaves the list', () => {
  assert.deepEqual(
    stillKnown([fact('a'), fact('b')], new Set(['a'])).map((f) => f.id),
    ['b'],
  );
});

test('known facts: the chip counts what is left and says when nothing is', () => {
  assert.equal(knownLine(3, 3), 'Knew 3 things about you');
  assert.equal(knownLine(1, 2), 'Knew 1 thing about you');
  assert.equal(knownLine(0, 1), 'Forgot the one thing it knew');
  assert.equal(knownLine(0, 4), 'Forgot all 4 things it knew');
});
