import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Wardrobe, WardrobeItem } from '../kernel/ipc';
import type { StudioInfo } from '../kernel/ipc-studio';
import { filtered, listingAction, listings, packPreview, earningOrder, standing } from './market-view.ts';

const info = {
  experience: { level: 4 },
  rarities: [
    { id: 'common', name: 'Common', level: 1, color: '#999999' },
    { id: 'rare', name: 'Rare', level: 4, color: '#4a8df0' },
    { id: 'legendary', name: 'Legendary', level: 10, color: '#e3b06a' },
  ],
  partRarity: {},
} as unknown as StudioInfo;
const item = (id: string, slot: string, rarity: string, more: Partial<WardrobeItem> = {}): WardrobeItem => ({ id, name: id, part: 'p', slot, effects: {}, oneOfAKind: false, source: 'official', rarity, wornBy: [], ...more });
const wardrobe: Wardrobe = {
  complete: true,
  slots: [{ id: 'neck', name: 'Neck', kind: 'worn' }, { id: 'halo', name: 'Halo', kind: 'floating' }, { id: 'paws', name: 'Paws', kind: 'worn' }],
  items: [
    item('scarf', 'neck', 'common', { blurb: 'Soft blue knit', effects: { color: '#7fb4e8', sway: 2 } }),
    item('halo', 'halo', 'rare', { wornBy: ['k1'] }),
    item('crown', 'halo', 'legendary'),
    item('nails', 'paws', 'common'),
    item('mine', 'neck', 'common', { source: 'yours' }),
  ],
  keepers: [{ id: 'k1', name: 'Pup', species: 'puppy', slots: ['neck', 'halo'] }],
} as unknown as Wardrobe;

test('listings: only official items, with lock, fit, wearing and colours', () => {
  const all = listings(wardrobe, info, 'k1');
  assert.deepEqual(all.map((l) => l.item.id), ['scarf', 'halo', 'crown', 'nails']);
  const by = Object.fromEntries(all.map((l) => [l.item.id, l]));
  assert.deepEqual(by.scarf.colours, ['#7fb4e8']);
  assert.equal(by.halo.wearing, true);
  assert.equal(by.crown.locked, 10);
  assert.equal(by.nails.fits, false);
  assert.equal(by.nails.slotName, 'Paws');
});

test('filters, search and the earning order', () => {
  const all = listings(wardrobe, info, 'k1');
  assert.deepEqual(filtered(all, wardrobe, 'ready', '').map((l) => l.item.id), ['scarf', 'halo']);
  assert.deepEqual(filtered(all, wardrobe, 'body', '').map((l) => l.item.id), ['halo', 'crown']);
  assert.deepEqual(filtered(all, wardrobe, 'all', 'BLUE').map((l) => l.item.id), ['scarf']);
  assert.deepEqual(earningOrder(info, [...all].reverse()).map((l) => l.item.id), ['nails', 'scarf', 'halo', 'crown']);
});

test('standing: what the level opens and what opens next', () => {
  const s = standing(info, listings(wardrobe, info, 'k1'));
  assert.equal(s.open, 3);
  assert.equal(s.total, 4);
  assert.equal(s.next?.id, 'legendary');
  assert.equal(standing({ ...info, experience: { level: 20 } } as unknown as StudioInfo, []).next, null);
});

test('the button says why an item cannot be worn', () => {
  const by = Object.fromEntries(listings(wardrobe, info, 'k1').map((l) => [l.item.id, listingAction(l)]));
  assert.deepEqual(by.scarf, { label: 'Wear', can: true });
  assert.deepEqual(by.halo, { label: 'Wearing', can: false });
  assert.deepEqual(by.crown, { label: 'Unlocks at level 10', can: false });
  assert.deepEqual(by.nails, { label: 'No paws to wear it on', can: false });
});

test('a pack is described before it is added', () => {
  const keeper = packPreview(JSON.stringify({ kind: 'keeper', format: 'keeper-pack/1', keeper: { name: 'Halo  Dog', species: 'puppy', role: 'companion', soul: { name: 'Sunny' }, wearables: [{}, {}], look: { ears: {} } } }));
  assert.deepEqual(keeper, { ok: true, kind: 'keeper', title: 'A keeper', name: 'Halo Dog', carries: ['Its body (puppy) and job (companion)', 'Its soul (Sunny)', '2 outfit items', 'Its own colours'] });
  const soul = packPreview(JSON.stringify({ kind: 'soul', format: 'keeper-pack/1', soul: { name: 'Calm', traits: ['kind'] } }));
  assert.deepEqual(soul, { ok: true, kind: 'soul', title: 'A soul', name: 'Calm', carries: ['How it speaks and what it is like', '1 trait'] });
  const variant = packPreview(JSON.stringify({ kind: 'variant', format: 'keeper-pack/1', variant: { name: 'Ruby Halo', part: 'memory-halo' } }));
  assert.equal(variant.ok && variant.carries[0], 'One item for the wardrobe (memory halo)');
});

test('a file that is not a pack is refused in plain words', () => {
  assert.deepEqual(packPreview('not json'), { ok: false, why: "That isn't a keeper pack (or it's damaged)." });
  assert.deepEqual(packPreview('[1]'), { ok: false, why: "That isn't a keeper pack (or it's damaged)." });
  assert.deepEqual(packPreview(JSON.stringify({ kind: 'keeper', format: 'keeper-pack/9', keeper: { name: 'x' } })), { ok: false, why: 'This pack is for a different Keeper version (keeper-pack/9).' });
  assert.deepEqual(packPreview(JSON.stringify({ kind: 'script', format: 'keeper-pack/1' })), { ok: false, why: "That isn't a keeper pack (or it's damaged)." });
  assert.deepEqual(packPreview(JSON.stringify({ kind: 'keeper', format: 'keeper-pack/1', keeper: { name: ' ' } })), { ok: false, why: 'The keeper in this pack has no name.' });
  assert.equal(packPreview('x'.repeat(64 * 1024 + 1)).ok, false);
});
