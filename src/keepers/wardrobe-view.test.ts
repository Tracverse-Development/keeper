import { test } from 'node:test';
import assert from 'node:assert/strict';

import { giveTargets, missingSlotLine, slotGroups, swatches, tryOn, wornLine } from './wardrobe-view.ts';

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

test('items grouped by slot for one keeper: what it wears, who else does, which slots its body offers', () => {
  const groups = slotGroups(w, 'k2');
  assert.deepEqual(groups.map((g) => [g.slot.id, g.offered, g.items.length]), [['halo', true, 1], ['torso', true, 2], ['back', false, 1]]);
  const halo = groups[0].items[0];
  assert.equal(halo.wornHere, true);
  assert.deepEqual(halo.others, ['Trini Boi']);
  assert.equal(wornLine(halo, 'Pup'), 'Worn by Pup and Trini Boi');
  assert.equal(wornLine(groups[1].items[0], 'Pup'), '');
});

test('a body without the slot says so in a sentence', () => {
  const back = slotGroups(w, 'k2')[2];
  assert.equal(missingSlotLine(wardrobe.keepers[1] as never, back.slot), 'Pup has no back to wear these on.');
});

test('trying on replaces whatever was in that slot, keeps the rest, and records the item', () => {
  const outfit = tryOn([{ part: 'memory-halo' }, { part: 'ark-jacket', item: 'part:ark-jacket' }], wardrobe.items[2] as never, w);
  assert.deepEqual(outfit, [{ part: 'memory-halo' }, { part: 'ark-jacket', effects: { color: '#e2425f' }, item: 'kit:trini-jacket' }]);
  assert.deepEqual(tryOn([{ part: 'memory-halo' }], null, w), [{ part: 'memory-halo' }]);
});

test('swatches: the item colours over the part defaults, colours only', () => {
  assert.deepEqual(swatches(wardrobe.items[2] as never, { color: '#f4eee2', trim: '#d39744', sway: 1 }), ['#e2425f', '#d39744']);
});

test('an item can be given to every other keeper', () => {
  assert.deepEqual(giveTargets(w, 'k1').map((k) => k.name), ['Pup', 'Rex']);
});
