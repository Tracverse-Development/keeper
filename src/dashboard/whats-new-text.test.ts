import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeLine } from './whats-new-text.ts';

// FIX-0041: the What's new sheet showed the changelog's ** marks as text.
test('a bold lead-in is drawn bold, never as asterisks', () => {
  assert.deepEqual(changeLine('**Edit in Keeper, then save.** Ask a keeper.'), [
    { text: 'Edit in Keeper, then save.', bold: true },
    { text: ' Ask a keeper.', bold: false },
  ]);
});

test('fix numbers are dropped and plain lines stay whole', () => {
  assert.deepEqual(changeLine('A reminder was said twice (FIX-0039).'), [{ text: 'A reminder was said twice.', bold: false }]);
  assert.deepEqual(changeLine('Two fixes (FIX-0001, FIX-0002) here'), [{ text: 'Two fixes here', bold: false }]);
});
