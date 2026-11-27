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

test('trying a piece on carries its rarity, so a mythical piece shows its tier before it is earned', () => {
  const item = { ...wardrobe.items[1], rarity: 'mythical' } as never;
  const out = tryOn([], item, w);
  assert.equal(out[0].rarity, 'mythical');
});

test('trying a whole set on: one piece per slot, its slots cleared, glowing as a set from three pieces', async () => {
  const { tryOnSet } = await import('./wardrobe-view.ts');
  const piece = (id: string, slot: string, part: string) => ({ id, name: id, part, slot, effects: {}, oneOfAKind: false, source: 'official', rarity: 'rare', wornBy: [], set: 'park' });
  const pieces = [piece('official:a', 'torso', 'ark-jacket'), piece('official:b', 'torso', 'ark-jacket'), piece('official:c', 'back', 'trail-pack'), piece('official:d', 'halo', 'memory-halo')] as never[];
  const out = tryOnSet([{ part: 'memory-halo' }, { part: 'ark-jacket' }], pieces, w, 'park');
  assert.deepEqual(out.map((p) => p.item), ['official:a', 'official:c', 'official:d'], 'the first torso piece wins; the old halo and jacket come off');
  assert.ok(out.every((p) => p.set === 'park'), 'three pieces on: they glow together');
  const two = tryOnSet([], pieces.slice(0, 1).concat(pieces.slice(2, 3)), w, 'park');
  assert.ok(two.every((p) => p.set === undefined), 'two pieces do not glow');
});

test('trying on in a colour applies that swatch over the item, and an unknown colour is its own', () => {
  const jacket = { ...wardrobe.items[2], colours: [{ id: 'navy', name: 'Navy', effects: { color: '#151c33', trim: '#d39744' } }] } as never;
  const navy = tryOn([{ part: 'memory-halo' }], jacket, w, 'navy');
  assert.deepEqual(navy[1], { part: 'ark-jacket', effects: { color: '#151c33', trim: '#d39744' }, item: 'kit:trini-jacket', colour: 'navy' });
  assert.deepEqual(tryOn([], jacket, w, 'crimson')[0], { part: 'ark-jacket', effects: { color: '#e2425f' }, item: 'kit:trini-jacket' });
});
