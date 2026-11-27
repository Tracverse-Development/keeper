import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardLines, cardOutfit, coverRect, fitSize } from './keeper-card.ts';

test('keeper card: the words under the picture', () => {
  assert.deepEqual(cardLines({ name: 'Trini Boi', level: 4, soulName: 'Sunny Pup', species: 'robot' }), { title: 'Trini Boi', sub: 'Level 4 · Sunny Pup · Robot', foot: 'My keeper · Keeper by Umoja Ark' });
  assert.equal(cardLines({ name: ' ', level: 0, soulName: '', species: '' }).sub, 'Level 1 · Its own soul · Keeper');
});

test('keeper card: the picture is cropped from its centre to fill the frame', () => {
  assert.deepEqual(coverRect(2000, 1000, 1000, 1000), { sx: 500, sy: 0, sw: 1000, sh: 1000 });
  assert.deepEqual(coverRect(1000, 2000, 1000, 1000), { sx: 0, sy: 500, sw: 1000, sh: 1000 });
  assert.deepEqual(coverRect(0, 0, 100, 100), { sx: 0, sy: 0, sw: 0, sh: 0 });
});

test('keeper card: a long name takes the largest size that still fits', () => {
  const width = (size: number) => size * 10;
  assert.equal(fitSize([96, 72, 56], 800, width), 72);
  assert.equal(fitSize([96, 72, 56], 100, width), 56, 'the smallest when nothing fits');
});

test('keeper card: the outfit band shows the glowing set and the rarest piece, or nothing', () => {
  const rarities = [
    { id: 'common', name: 'Common', level: 1, color: '#999999' },
    { id: 'rare', name: 'Rare', level: 4, color: '#4a8df0' },
    { id: 'legendary', name: 'Legendary', level: 10, color: '#e3b06a' },
  ];
  const items = [{ id: 'official:gown', name: 'Evening Gown' }, { id: 'official:shawl', name: 'Starlight Shawl' }, { id: 'part:memory-halo', name: 'Memory Halo' }];
  const sets = [{ id: 'gala-night', name: 'Gala Night' }];
  const worn = [{ item: 'part:memory-halo', rarity: 'rare' }, { item: 'official:shawl', rarity: 'rare', set: 'gala-night' }, { item: 'official:gown', rarity: 'legendary', set: 'gala-night' }];
  assert.deepEqual(cardOutfit(worn, items, sets, rarities), { set: 'Gala Night', rarest: { name: 'Evening Gown', rarity: 'Legendary', colour: '#e3b06a' } });
  assert.deepEqual(cardOutfit([{ item: 'official:shawl', rarity: 'rare' }], items, sets, rarities), { set: null, rarest: { name: 'Starlight Shawl', rarity: 'Rare', colour: '#4a8df0' } });
  assert.equal(cardOutfit([{ item: 'part:memory-halo', rarity: 'common' }], items, sets, rarities), undefined, 'only common pieces and no set: no band');
});
