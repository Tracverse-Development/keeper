import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Experience, StudioInfo } from '../kernel/ipc-studio.ts';
import { coatOn, finishLock, habitWeight, habitWords, levelProgress, levelUpLine, lockedUntil, rarityOf, saveWords, setCoat, setZone } from './studio-view.ts';

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

test('a level up says what opened', () => {
  assert.equal(levelUpLine('Pup', 4, [{ name: 'Rare items' }]), 'Pup reached level 4! I can now wear rare items.');
  assert.equal(levelUpLine('Pup', 5, [{ name: 'A pendant with your own photo' }]), 'Pup reached level 5! I can now have a pendant with your own photo.');
  assert.equal(levelUpLine('Pup', 7, []), 'Pup reached level 7!');
  assert.equal(levelUpLine('Pup', 6, [{ name: 'Celebration effects' }, { name: 'Idle effects' }]), 'Pup reached level 6! New for me: celebration effects and idle effects.');
});

test('studio: the save line says where things stand', () => {
  assert.equal(saveWords(false, false), 'Everything is saved');
  assert.equal(saveWords(true, false), 'Saving in a moment…');
  assert.equal(saveWords(true, true), 'Saving…');
});

test('studio: the coat switch paints every coat zone and takes it off again, keeping colours', () => {
  const coat = { material: 'fur', zones: ['head', 'ears', 'body'] };
  const start = { ears: { color: '#c98a34' }, eyes: { color: '#9ad0ff', material: 'gloss' }, body: { material: 'metal' } };
  assert.ok(!coatOn(start, coat));
  const furred = setCoat(start, coat, true);
  assert.ok(coatOn(furred, coat));
  assert.deepEqual(furred.ears, { color: '#c98a34', material: 'fur' });
  assert.deepEqual(furred.eyes, start.eyes, 'the eyes are not a coat zone');
  const smooth = setCoat(furred, coat, false);
  assert.ok(!coatOn(smooth, coat));
  assert.equal(smooth.ears?.color, '#c98a34');
  assert.equal(smooth.ears?.material, undefined);
  assert.ok(!('head' in smooth), 'a zone that only had the coat goes back to the standard body');
  assert.deepEqual(setCoat({ body: { material: 'metal' } }, coat, false), { body: { material: 'metal' } }, 'off never touches another material');
  assert.ok(!coatOn({}, { material: 'fur', zones: [] }), 'a body with no coat has no switch to be on');
});

test('studio: a coat finish needs the coat obtained, never only a level', () => {
  const materials = [{ id: 'fur', obtainedOnly: true }, { id: 'gloss' }];
  const mythical = { id: 'mythical', name: 'Mythical', level: 15, color: '#c25cf0' };
  const fleece = { rarity: 'mythical', look: [['body', '#e0a64a', 'fur']] as [string, string, string][] };
  assert.equal(finishLock(fleece, materials, [], mythical, 99), 'obtain', 'a high level does not open a coat');
  assert.equal(finishLock(fleece, materials, ['fur'], mythical, 99), null);
  assert.deepEqual(finishLock({ rarity: 'mythical', look: [['body', '#000000', 'gloss']] }, materials, [], mythical, 3), { level: 15 });
});
