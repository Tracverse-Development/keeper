/**
 * Tests for the draft panel's pure helpers.
 * Run: node --test --experimental-strip-types src/stage/draft-view.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DraftLine } from '../kernel/ipc-drafts.ts';
import { changeOpening, changeWords, readDraftView, revealOrder, stepMs, REVEAL_MS } from './draft-view.ts';

/** What the core sends for "teh" fixed to "the" (the shape `sdk::drafts::DraftView` serialises). */
const fromCore = {
  draft: '0123456789abcdef', name: 'notes.txt', folder: '/tmp/keeper-bench', path: '/private/tmp/keeper-bench/notes.txt', why: 'fixed 1 spelling',
  text: 'Dear Sam,\nthe end\n', added: 1, removed: 1, changed: true,
  lines: [
    { kind: 'same', text: 'Dear Sam,' },
    { kind: 'removed', text: 'teh end', parts: [{ text: 'teh', changed: true }, { text: ' end', changed: false }] },
    { kind: 'added', text: 'the end', parts: [{ text: 'the', changed: true }, { text: ' end', changed: false }] },
    { kind: 'gap', text: '', skipped: 12 },
  ],
};

test('draft: the core\'s view is read, and anything else is refused', () => {
  assert.equal(readDraftView(fromCore)?.name, 'notes.txt');
  assert.equal(readDraftView({ ...fromCore, why: null })?.why, null, 'no why is fine');
  assert.equal(readDraftView(null), null);
  assert.equal(readDraftView({ ...fromCore, lines: [{ kind: 'html', text: '<b>' }] }), null);
  assert.equal(readDraftView({ ...fromCore, lines: [{ kind: 'added', text: 'x', parts: [{ text: 1 }] }] }), null);
  assert.equal(readDraftView({ ...fromCore, added: '1' }), null);
});

test('draft: changed lines appear one after another; the rest are there at once', () => {
  assert.deepEqual(revealOrder(fromCore.lines as DraftLine[]), [-1, 0, 1, -1]);
  assert.equal(stepMs(1), 140);
  assert.ok(stepMs(200) * 200 <= REVEAL_MS, 'a long edit still arrives quickly');
});

test('draft: what changed is said in a few words', () => {
  assert.equal(changeWords({ added: 1, removed: 1, changed: true }), '1 line changed');
  assert.equal(changeWords({ added: 3, removed: 1, changed: true }), '1 line changed, 2 lines added');
  assert.equal(changeWords({ added: 0, removed: 2, changed: true }), '2 lines taken out');
  assert.equal(changeWords({ added: 0, removed: 0, changed: false }), 'No changes yet');
  assert.equal(changeOpening('notes.txt'), 'About notes.txt: ', 'what the core reads back as the same draft');
});
