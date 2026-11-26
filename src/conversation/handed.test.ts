import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstDropped, HANDED_ASKS, handedSize, saidWith } from './handed.ts';

test('handed: the size line says how much will be read', () => {
  assert.equal(handedSize(3200, false), '3,200 characters');
  assert.equal(handedSize(1, false), '1 character');
  assert.equal(handedSize(90000, true), "90,000 characters. I'll read the first 24,000.");
});

test('handed: a message is shown with the name of what came with it', () => {
  assert.equal(saidWith('Summarise this for me.', 'notes.txt'), 'Summarise this for me. (notes.txt)');
});

test('handed: a drop means its first file, and says how many more there were', () => {
  assert.deepEqual(firstDropped(['/a/one.txt', '/a/two.txt']), { path: '/a/one.txt', more: 1 });
  assert.equal(firstDropped([]), null);
  assert.equal(firstDropped(['  ']), null);
});

test('handed: every ready-made request is a full sentence with its own label', () => {
  assert.equal(new Set(HANDED_ASKS.map((a) => a.id)).size, HANDED_ASKS.length);
  for (const a of HANDED_ASKS) assert.ok(a.label && /[.?]$/.test(a.say), a.id);
});
