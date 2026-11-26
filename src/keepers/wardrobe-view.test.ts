import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tryOn } from './wardrobe-view.ts';

const wardrobe = {
  complete: true,
  slots: [
    { id: 'halo', name: 'Halo', kind: 'floating' },
    { id: 'torso', name: 'Torso', kind: 'worn' },
    { id: 'back', name: 'Back', kind: 'worn' },
  ],
  keepers: [
    { id: 'k1', name: 'Trini Boi', species: 'robot', slots: ['halo', 'torso', 'back'] },
    { id: 'k2', name: 'Pup', species: 'ghost', slots: ['halo', 'torso'] },
    { id: 'k3', name: 'Rex', species: 'puppy', slots: ['halo', 'torso', 'back'] },
  ],
  items: [
    { id: 'part:memory-halo', name: 'Memory Halo', part: 'memory-halo', slot: 'halo', effects: {}, oneOfAKind: false, source: 'built-in', wornBy: ['k1', 'k2'] },
    { id: 'part:ark-jacket', name: 'Ark Jacket', part: 'ark-jacket', slot: 'torso', effects: {}, oneOfAKind: false, source: 'built-in', wornBy: [] },
    { id: 'kit:trini-jacket', name: "Trini Boi's Jacket", part: 'ark-jacket', slot: 'torso', effects: { color: '#e2425f' }, oneOfAKind: true, source: 'yours', wornBy: ['k1'] },
    { id: 'part:trail-pack', name: 'Trail Pack', part: 'trail-pack', slot: 'back', effects: {}, oneOfAKind: false, source: 'built-in', wornBy: [] },
  ],
} as const;
const w = wardrobe as never;

test('trying on replaces whatever was in that slot, keeps the rest, and records the item', () => {
  const outfit = tryOn([{ part: 'memory-halo' }, { part: 'ark-jacket', item: 'part:ark-jacket' }], wardrobe.items[2] as never, w);
  assert.deepEqual(outfit, [{ part: 'memory-halo' }, { part: 'ark-jacket', effects: { color: '#e2425f' }, item: 'kit:trini-jacket' }]);
  assert.deepEqual(tryOn([{ part: 'memory-halo' }], null, w), [{ part: 'memory-halo' }]);
});
