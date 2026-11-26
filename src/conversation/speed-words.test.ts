import assert from 'node:assert/strict';
import { test } from 'node:test';

import { speedWords } from './speed-words.ts';

test('the speed line says how fast the first words came and who answered', () => {
  assert.equal(speedWords({ recallMs: 0, firstMs: 950, thinkMs: 2000, totalMs: 2100, source: 'claude' }), 'First words in 950 ms · done in 2.1 s · claude');
  assert.equal(speedWords({ recallMs: 0, firstMs: 1500, panelMs: 4200, thinkMs: 10000, totalMs: 10400, source: 'claude' }), 'First words in 1.5 s · first picture 4.2 s · done in 10.4 s · claude');
  assert.equal(speedWords({ recallMs: 0, firstMs: null, thinkMs: 3, totalMs: 4, source: 'cache' }), 'Answered in 4 ms · from memory');
});
