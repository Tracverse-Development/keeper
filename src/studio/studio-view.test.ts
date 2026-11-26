import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Experience, StudioInfo } from '../kernel/ipc-studio.ts';
import { habitWeight, habitWords, levelProgress, lockedUntil, rarityOf, setZone } from './studio-view.ts';

const rarities = [
  { id: 'common', name: 'Common', level: 1, color: '#9aa3b5' },
  { id: 'rare', name: 'Rare', level: 4, color: '#4a8df0' },
  { id: 'mythical', name: 'Mythical', level: 15, color: '#c25cf0' },
];
const info = { rarities, partRarity: { 'memory-halo': 'rare' } } as unknown as StudioInfo;

test('the level bar runs from this level to the next', () => {
  const e = { xp: 1045, levelXp: 1000, nextXp: 1500 } as Experience;
  assert.equal(levelProgress(e), 0.09);
  assert.equal(levelProgress({ xp: 0, levelXp: 0, nextXp: 100 } as Experience), 0);
});

test('rarity locks by level; unlisted parts are common', () => {
  assert.equal(rarityOf(info, { part: 'memory-halo' }).id, 'rare');
  assert.equal(rarityOf(info, { part: 'crew-cap' }).id, 'common');
  assert.equal(rarityOf(info, { part: 'crew-cap', rarity: 'mythical' }).id, 'mythical', "an official item's own rarity wins");
  assert.equal(lockedUntil(rarities[1], 3), 4);
  assert.equal(lockedUntil(rarities[1], 4), null);
  assert.equal(lockedUntil(rarities[0], 0), null, 'a brand-new keeper wears common items');
});

test('a zone merges changes and an empty zone goes back to the species colour', () => {
  let look = setZone({}, 'ears', { color: '#e2425f' });
  look = setZone(look, 'ears', { material: 'fur' });
  assert.deepEqual(look, { ears: { color: '#e2425f', material: 'fur' } });
  assert.deepEqual(setZone(look, 'ears', null), {});
});

test('habits default to sometimes and read in words', () => {
  assert.equal(habitWeight(undefined, 'sleep'), 1);
  assert.equal(habitWeight({ sleep: 0 }, 'sleep'), 0);
  assert.deepEqual([0, 1, 2, 3].map(habitWords), ['Never', 'Sometimes', 'Often', 'All the time']);
});
