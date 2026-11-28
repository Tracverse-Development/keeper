/** Run: node --test --experimental-strip-types src/voice/attention.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionFrom, attentionWords, OVERHEARD_MS, WOKEN_MS } from './attention.ts';

test('a keeper woken by its name says it is listening, then lapses', () => {
  const a = attentionFrom('woken', 1000);
  assert.equal(a.until, 1000 + WOKEN_MS);
  assert.equal(attentionWords(a, 'Kofi', 2000), 'Yes? Kofi is listening.');
  assert.equal(attentionWords(a, 'Kofi', 1000 + WOKEN_MS), null);
});

test('after an answer it says the conversation is still open for the window the core opened', () => {
  const a = attentionFrom('following', 0, 5);
  assert.equal(attentionWords(a, 'Kofi', 4999), 'Still listening. Just keep talking.');
  assert.equal(attentionWords(a, 'Kofi', 5000), null);
  assert.equal(attentionWords(null, 'Kofi', 0), null);
});

test('a sentence without its name is shown for a moment, with the name to say', () => {
  const a = attentionFrom('overheard', 0, undefined, 'what time is it');
  assert.equal(attentionWords(a, 'Trini Boi', 100), 'I heard “what time is it”. Say “Trini Boi” first, then what you need.');
  assert.equal(attentionWords(a, 'Trini Boi', OVERHEARD_MS), null);
});
