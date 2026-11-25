import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rank, type Command } from './rank.ts';

const c = (id: string, title: string, keywords?: string[]): Command => ({ id, title, keywords, run: () => {} });
const all = [c('new', 'New chat'), c('brief', 'Brief me', ['morning', 'day']), c('pup', 'Switch to Pup', ['change', 'keeper']), c('settings', 'Open settings', ['preferences'])];

test('every typed word must start a word of the command, best first', () => {
  assert.deepEqual(rank(all, 'sw pup').map((x) => x.id), ['pup']);
  assert.deepEqual(rank(all, 'morning').map((x) => x.id), ['brief']);
  assert.deepEqual(rank(all, 'new').map((x) => x.id), ['new']);
  assert.deepEqual(rank(all, 'zebra'), []);
});

test('nothing typed lists everything in its order', () => {
  assert.deepEqual(rank(all, '').map((x) => x.id), ['new', 'brief', 'pup', 'settings']);
});
