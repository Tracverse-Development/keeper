import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cardLines, coverRect, fitSize } from './keeper-card.ts';

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
