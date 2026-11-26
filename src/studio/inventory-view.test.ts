import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Wardrobe, WardrobeItem } from '../kernel/ipc-wardrobe.ts';
import { inventory } from './inventory-view.ts';

const item = (id: string, slot: string, rarity: string, extra: Partial<WardrobeItem> = {}): WardrobeItem => ({ id, name: id, part: id, slot, effects: {}, oneOfAKind: false, source: 'built-in', wornBy: [], rarity, ...extra });
const w = {
  complete: true,
  keepers: [],
  slots: [{ id: 'torso', name: 'Torso', kind: 'worn' }, { id: 'halo', name: 'Halo', kind: 'floating' }, { id: 'thinking', name: 'Thinking', kind: 'effect' }],
  items: [item('jacket', 'torso', 'common', { wornBy: ['k1'] }), item('vortex', 'thinking', 'mythical'), item('halo', 'halo', 'rare'), item('mine', 'torso', 'common', { source: 'yours' })],
} as unknown as Wardrobe;
const rarity = (i: WardrobeItem) => i.rarity ?? 'common';

test('rarest first, then what the keeper wears', () => {
  assert.deepEqual(inventory(w, 'k1', 'all', '', rarity).map((i) => i.id), ['vortex', 'halo', 'jacket', 'mine']);
});

test('filters and search', () => {
  assert.deepEqual(inventory(w, 'k1', 'effects', '', rarity).map((i) => i.id), ['vortex']);
  assert.deepEqual(inventory(w, 'k1', 'wearing', '', rarity).map((i) => i.id), ['jacket']);
  assert.deepEqual(inventory(w, 'k1', 'yours', '', rarity).map((i) => i.id), ['mine']);
  assert.deepEqual(inventory(w, 'k1', 'all', 'HAL', rarity).map((i) => i.id), ['halo']);
});
