import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canUndo, UNDO_MS, waitingWords } from './undo-view.ts';

test('undo: offered for thirty seconds after a fact leaves memory, then not', () => {
  assert.equal(canUndo(1000, 1000), true);
  assert.equal(canUndo(1000, 1000 + UNDO_MS - 1), true);
  assert.equal(canUndo(1000, 1000 + UNDO_MS), false);
  assert.equal(canUndo(5000, 1000), false, 'a clock that went back offers nothing');
});

test('undo: a note when something waits to be written, none otherwise', () => {
  assert.equal(waitingWords(0), null);
  assert.match(waitingWords(2) ?? '', /reaches your memory/);
});
