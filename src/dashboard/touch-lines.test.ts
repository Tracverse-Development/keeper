import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nameFromFacts, touchLine } from './touch-lines.ts';

test('a touch line never repeats the last one', () => {
  let last: string | null = null;
  for (let i = 0; i < 50; i++) {
    const line = touchLine('poke', { name: 'Kofi', you: 'Ada', last });
    assert.notEqual(line, last);
    last = line;
  }
});

test('names are woven in and placeholders never leak', () => {
  for (let i = 0; i < 40; i++) {
    const line = touchLine(i % 2 ? 'pat' : 'poke', { name: 'Kofi', you: null, last: null, random: () => (i % 10) / 10 });
    assert.ok(!line.includes('{'), line);
  }
});

test('the first name comes from the identity fact', () => {
  assert.equal(nameFromFacts([{ text: 'Your name is Ada Lovelace', category: 'identity' }]), 'Ada');
  assert.equal(nameFromFacts([{ text: 'You love sorrel', category: 'preference' }]), null);
});
