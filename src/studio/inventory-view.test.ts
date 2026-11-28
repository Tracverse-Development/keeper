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

// FIX-0055: what this keeper can put on now comes before what it cannot (locked or not its kind).
test('what the keeper can put on now comes first', () => {
  const item = (id: string, rarity: string) => ({ id, name: id, part: id, slot: 'halo', effects: {}, oneOfAKind: false, source: 'official' as const, rarity, wornBy: [] });
  const w = { items: [item('wings', 'mythical'), item('halo', 'common')], slots: [{ id: 'halo', kind: 'floating' }] } as unknown as Parameters<typeof inventory>[0];
  const order = inventory(w, 'k', 'all', '', (i) => i.rarity ?? 'common', (i) => i.id !== 'wings').map((i) => i.id);
  assert.deepEqual(order, ['halo', 'wings']);
});
