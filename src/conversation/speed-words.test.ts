import assert from 'node:assert/strict';
import { test } from 'node:test';

import { costWords, fellBackWords, speedWords } from './speed-words.ts';

test('the cost of an answer is said in plain words, and only when there was one', () => {
  assert.equal(costWords(0.004), 'under 1¢');
  assert.equal(costWords(0.031), 'about 3¢');
  assert.equal(costWords(1.2), 'about $1.20');
  assert.equal(costWords(0), '');
  assert.equal(speedWords({ recallMs: 0, firstMs: null, thinkMs: 3, totalMs: 900, source: 'claude', costUsd: 0.02 }), 'Answered in 900 ms · Claude Code · about 2¢');
  assert.match(fellBackWords("this month's spending limit is reached"), /^This month's spending limit is reached/);
  assert.equal(fellBackWords('Claude: signed out'), 'The chosen mind did not answer (Claude: signed out), so the built-in mind replied.');
});

test('the speed line says how fast the first words came and who answered', () => {
  assert.equal(speedWords({ recallMs: 0, firstMs: 950, thinkMs: 2000, totalMs: 2100, source: 'claude' }), 'First words in 950 ms · done in 2.1 s · Claude Code');
  assert.equal(speedWords({ recallMs: 0, firstMs: 1500, panelMs: 4200, thinkMs: 10000, totalMs: 10400, source: 'claude' }), 'First words in 1.5 s · first picture 4.2 s · done in 10.4 s · Claude Code');
  assert.equal(speedWords({ recallMs: 0, firstMs: null, thinkMs: 3, totalMs: 4, source: 'cache' }), 'Answered in 4 ms · from memory');
});
