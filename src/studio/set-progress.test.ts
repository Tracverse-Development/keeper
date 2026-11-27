import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Rarity, Wardrobe } from '../kernel/ipc';
import { levelBefore, levelUpNotes, loadoutChanges, modesWearing, newPieces, openPieces } from './set-progress.ts';

const rarities: Rarity[] = [
  { id: 'common', name: 'Common', level: 1, color: '#999999' },
  { id: 'rare', name: 'Rare', level: 4, color: '#4a8df0' },
  { id: 'legendary', name: 'Legendary', level: 10, color: '#e3b06a' },
];
const item = (id: string, rarity: string, set: string) => ({ id, name: id, part: 'p', slot: 's', effects: {}, oneOfAKind: false, source: 'official', rarity, set, wornBy: [] });
const wardrobe = {
  complete: true,
  slots: [],
  items: [item('official:a', 'common', 'gala'), item('official:b', 'rare', 'gala'), item('official:c', 'legendary', 'gala'), item('official:d', 'rare', 'gala'), item('official:x', 'rare', 'linen')],
  keepers: [{ id: 'k1', name: 'Amara', species: 'woman', slots: [], wears: ['official:a', 'official:b', 'official:c', 'official:x'] }],
  sets: [
    { id: 'gala', name: 'Gala Night', who: ['woman'], theme: '', bonus: '', reward: 'c' },
    { id: 'linen', name: 'Island Linen', who: ['man'], theme: '', bonus: '', reward: 'x' },
  ],
} as unknown as Wardrobe;

test('pieces open by body and level; a level up names the sets it moved forward', () => {
  assert.deepEqual(openPieces(wardrobe, rarities, 'k1', 'gala', 3), ['official:a'], 'd does not fit this body, b needs level 4');
  assert.deepEqual(levelUpNotes(wardrobe, rarities, 'k1', 3, 4), ['Gala Night: 2 of 3 ready', 'Island Linen: every piece ready']);
  assert.deepEqual(levelUpNotes(wardrobe, rarities, 'k1', 4, 9), [], 'nothing new between 5 and 9');
  assert.deepEqual(levelUpNotes(wardrobe, rarities, 'k1', 9, 10), ['Gala Night: every piece ready']);
});

test('new pieces are the open ones not seen yet', () => {
  assert.deepEqual([...newPieces(['a', 'b', 'c'], new Set(['b']))], ['a', 'c']);
});

test('tying a set to a mode unties its old mode first, and picking none unties it', () => {
  const loadouts = { researcher: 'explorer', tutor: 'scholar' };
  assert.deepEqual(modesWearing(loadouts, 'explorer'), ['researcher']);
  assert.deepEqual(loadoutChanges(loadouts, 'explorer', 'assistant'), [{ mode: 'researcher', set: null }, { mode: 'assistant', set: 'explorer' }]);
  assert.deepEqual(loadoutChanges(loadouts, 'explorer', ''), [{ mode: 'researcher', set: null }]);
  assert.deepEqual(loadoutChanges(loadouts, 'explorer', 'researcher'), [], 'already tied: nothing to save');
  assert.deepEqual(loadoutChanges(loadouts, 'gala', 'tutor'), [{ mode: 'tutor', set: 'gala' }], 'taking a mode from another set replaces it (one set per mode)');
});

test('a jump of several levels counts every piece opened on the way', () => {
  // Level 3 to 10 at once: b (rare, 4) and c (legendary, 10) open together, x (rare) too.
  const from = levelBefore({ level: 10, from: 3 });
  assert.equal(from, 3);
  assert.deepEqual(levelUpNotes(wardrobe, rarities, 'k1', from, 10), ['Gala Night: every piece ready', 'Island Linen: every piece ready']);
  assert.deepEqual(levelUpNotes(wardrobe, rarities, 'k1', 10 - 1, 10), ['Gala Night: every piece ready'], 'the old one-level guess missed Island Linen');
  assert.equal(levelBefore({ level: 5 }), 4, 'an event without from: the level below');
  assert.equal(levelBefore({ level: 5, from: 'x' }), 4);
  assert.equal(levelBefore({ level: 5, from: 7 }), 4, 'a from above the level is not believed');
});
