import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ordered, searchable } from './chat-list-view.ts';

const chat = (id: string, pinned = false) => ({ id, title: id, at: '2026-11-26T10:00:00Z', pinned });

test('chats: pinned ones come first and each group keeps its order', () => {
  assert.deepEqual(ordered([chat('a'), chat('b', true), chat('c'), chat('d', true)]).map((c) => c.id), ['b', 'd', 'a', 'c']);
  assert.deepEqual(ordered([]), []);
});

test('chats: a search needs two characters', () => {
  assert.equal(searchable(' r '), false);
  assert.equal(searchable('ri'), true);
});
