/**
 * Tests for the rarity tiers (pure data): the five tiers in order, every effect grows (or holds)
 * from common to mythical, common adds nothing, and anything unknown is common.
 * Run: node --test --experimental-strip-types src/character/parts/rarity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOURISH, RARITIES, resolveRarity, tierOf } from './rarity.ts';

test('five tiers, common to mythical, in that order', () => {
  assert.deepEqual(RARITIES.map((r) => r.id), ['common', 'uncommon', 'rare', 'legendary', 'mythical']);
  assert.deepEqual(RARITIES.map((r) => tierOf(r.id)), [0, 1, 2, 3, 4]);
});

test('each tier is grander than the one before: no effect ever shrinks going up', () => {
  const numbers = ['glow', 'sparkles', 'rings', 'rays', 'motes', 'flare', 'light', 'reach'] as const;
  for (let i = 1; i < RARITIES.length; i++) {
    const lower = FLOURISH[RARITIES[i - 1].id];
    const higher = FLOURISH[RARITIES[i].id];
    for (const key of numbers) assert.ok(higher[key] >= lower[key], `${RARITIES[i].id}.${key} >= ${RARITIES[i - 1].id}.${key}`);
    assert.ok(numbers.some((key) => higher[key] > lower[key]), `${RARITIES[i].id} adds something`);
  }
  const c = FLOURISH.common;
  assert.equal(c.glow + c.sparkles + c.rings + c.rays + c.motes + c.flare + c.light, 0, 'common is the item as it is');
  assert.ok(FLOURISH.mythical.shift && FLOURISH.mythical.burstEvery > 0, 'mythical shifts colour and bursts');
  assert.ok(!FLOURISH.legendary.shift, 'only mythical shifts colour');
});

test('an unknown or missing rarity is common', () => {
  assert.equal(resolveRarity('mythical'), 'mythical');
  for (const bad of [undefined, null, 'shiny', 3, 'Mythical']) assert.equal(resolveRarity(bad), 'common');
});
