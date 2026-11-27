/**
 * Tests for the skin catalogue (pure data, no three.js).
 * Run: node --test --experimental-strip-types src/character/skins/catalog.test.ts
 */
import { test } from 'node:test';
import { raceOf } from './races.ts';
import assert from 'node:assert/strict';
import { SLOT_IDS } from '../parts/catalog.ts';
import { DEFAULT_SKIN_ID, SKINS, isSkinId, resolveSkinId, slotsOf } from './catalog.ts';

test('the catalogue lists the robot (default), the puppy, the man, the woman, the owl and the God Keeper', () => {
  assert.deepEqual(
    SKINS.map((skin) => skin.id),
    ['robot', 'puppy', 'man', 'woman', 'owl', 'god'],
  );
  assert.equal(DEFAULT_SKIN_ID, 'robot', 'the robot stays the default look');
});

test('every row has a unique kebab-case id, a name and a short description', () => {
  const ids = new Set<string>();
  for (const skin of SKINS) {
    assert.match(skin.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, skin.id);
    assert.ok(!ids.has(skin.id), `duplicate id ${skin.id}`);
    ids.add(skin.id);
    assert.ok(skin.name.trim().length > 0, `${skin.id} has no name`);
    assert.ok(skin.description.length > 10 && skin.description.length <= 100, `${skin.id} description length`);
  }
});

test('isSkinId guards unknown strings', () => {
  assert.equal(isSkinId('puppy'), true);
  assert.equal(isSkinId('dragon'), false);
  assert.equal(isSkinId('toString'), false);
  assert.equal(isSkinId(undefined), false);
});

test('resolveSkinId falls back to the default for anything unknown', () => {
  assert.equal(resolveSkinId('puppy'), 'puppy');
  assert.equal(resolveSkinId('robot'), 'robot');
  assert.equal(resolveSkinId('retired-skin'), DEFAULT_SKIN_ID);
  assert.equal(resolveSkinId(''), DEFAULT_SKIN_ID);
  assert.equal(resolveSkinId(42), DEFAULT_SKIN_ID);
});

test('every species declares the halo, base and aura slots with finite placements', () => {
  for (const skin of SKINS) {
    const slots = Object.keys(skin.slots);
    for (const slot of slots) assert.ok((SLOT_IDS as readonly string[]).includes(slot), `${skin.id} offers unknown ${slot}`);
    for (const slot of ['halo', 'base', 'aura', 'head', 'neck', 'torso', 'back', 'thinking', 'celebrate']) assert.ok(slots.includes(slot), `${skin.id} offers ${slot}`);
    assert.equal(slots.includes('paws'), skin.id === 'puppy' || skin.id === 'god', 'only the puppy and the God Keeper have feet to wear things on');
    assert.equal(slots.includes('wrist') && slots.includes('held'), ['man', 'woman', 'god'].includes(skin.id), 'only bodies with arms and hands offer the wrist and held slots');
    assert.ok(slots.includes('face'), `${skin.id} has a face for spectacles`);
    assert.ok(raceOf(skin.id) !== '', `${skin.id} has a race`);
    for (const [slot, placement] of Object.entries(skin.slots)) {
      assert.equal(placement.position.length, 3, `${skin.id}.${slot}`);
      assert.equal(placement.rotation.length, 3, `${skin.id}.${slot}`);
      for (const n of [...placement.position, ...placement.rotation, placement.scale]) assert.ok(Number.isFinite(n), `${skin.id}.${slot}`);
      assert.ok(placement.scale > 0.2 && placement.scale < 3, `${skin.id}.${slot} scale`);
    }
  }
});

test('the halo and base anchors are where the halo and the ark always sat (the default look)', () => {
  for (const id of ['robot', 'puppy'] as const) {
    assert.deepEqual(slotsOf(id).halo, { position: [0, 0.15, 0], rotation: [0.32, 0, -0.1], scale: 1 });
    assert.deepEqual(slotsOf(id).base, { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
  }
});
