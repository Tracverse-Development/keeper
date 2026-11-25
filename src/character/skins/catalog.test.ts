/**
 * Tests for the skin catalogue (pure data, no three.js).
 * Run: node --test --experimental-strip-types src/character/skins/catalog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SKIN_ID, SKINS, isSkinId, resolveSkinId } from './catalog.ts';

test('the catalogue lists the robot (default) and the puppy', () => {
  assert.deepEqual(
    SKINS.map((skin) => skin.id),
    ['robot', 'puppy'],
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
