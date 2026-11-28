/** Run: node --test --experimental-strip-types src/kernel/mind-words.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mindName } from './mind-words.ts';

test('what answered reads as a name, never an internal id', () => {
  assert.equal(mindName('claude'), 'Claude Code');
  assert.equal(mindName('reflex'), 'built-in mind');
  assert.equal(mindName('instant'), 'instant answer');
  assert.equal(mindName('newengine'), 'newengine');
  assert.equal(mindName(undefined), '');
});
